"""Record a GIF of RDFCraft's AI mapping assistant on a FOAF mapping.

Flow: empty canvas -> AI-generated mapping -> SHACL validation -> LLM auto-repair -> apply + re-validate.

Prereqs: backend on :8000, frontend on :5173, LLM settings filled in.
The "FOAF Demo" workspace is recreated by setup_workspace.py on every run.

Usage:
    uv run --no-project --with playwright --with pillow python make_gif.py [out.gif] [--no-repair]
"""

import asyncio
import io
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

APP = "http://localhost:5173"
API = "http://localhost:8000/api"
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
REPAIR = "--no-repair" not in sys.argv  # record the LLM auto-repair loop
OUT = Path(ARGS[0] if ARGS else Path(__file__).parent / "ai-mapping-demo.gif")
VIEWPORT = {"width": 1440, "height": 860}
GIF_WIDTH = 1100
FRAME_MS = 120  # capture interval during interactive phases
WAIT_PHASE_MAX_MS = 3500  # each LLM/validation wait is compressed to at most this long in the GIF
GENERATE_TIMEOUT_S = 300
VALIDATE_TIMEOUT_S = 180
REPAIR_TIMEOUT_S = 900
REPAIR_ITERATIONS = 6

# Fake cursor + click ripple; headless Chromium does not render the OS pointer.
CURSOR_JS = """
(() => {
 const install = () => {
  if (window.__demoCursor) return;
  const c = document.createElement('div');
  c.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z"
    fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  Object.assign(c.style, {position:'fixed', left:'-50px', top:'-50px', zIndex: 2147483647,
    pointerEvents:'none', transform:'translate(-3px,-2px)'});
  document.documentElement.appendChild(c);
  window.__demoCursor = c;
  document.addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', e => {
    const r = document.createElement('div');
    Object.assign(r.style, {position:'fixed', left:(e.clientX-14)+'px', top:(e.clientY-14)+'px', width:'28px',
      height:'28px', borderRadius:'50%', background:'rgba(255,200,0,.55)', zIndex:2147483646,
      pointerEvents:'none', transition:'transform .35s, opacity .35s'});
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 400);
  }, true);
 };
 if (document.body) install(); else document.addEventListener('DOMContentLoaded', install);
})();
"""

# Caption banner at the bottom of the viewport.
CAPTION_JS = """
(text) => {
  let b = document.getElementById('__demoCaption');
  if (!b) {
    b = document.createElement('div');
    b.id = '__demoCaption';
    Object.assign(b.style, {position:'fixed', left:'50%', bottom:'22px', transform:'translateX(-50%)',
      background:'rgba(17,20,24,.88)', color:'#fff', font:'600 20px system-ui, sans-serif',
      padding:'10px 22px', borderRadius:'10px', zIndex:2147483645, pointerEvents:'none',
      boxShadow:'0 4px 18px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.15)'});
    document.documentElement.appendChild(b);
  }
  b.textContent = text;
  b.style.display = text ? 'block' : 'none';
}
"""


def api(path):
    with urllib.request.urlopen(f"{API}{path}") as r:
        return json.loads(r.read())


class Recorder:
    def __init__(self, page):
        self.page = page
        self.frames: list[tuple[bytes, str]] = []  # (png, phase)
        self.phase = "normal"
        self._waits = 0
        self._task = None
        self._stop = False

    def begin_wait(self):
        # Each wait gets its own label so write_gif compresses it independently.
        self._waits += 1
        self.phase = f"wait{self._waits}"

    def end_wait(self):
        self.phase = "normal"

    async def _loop(self):
        while not self._stop:
            t = time.monotonic()
            try:
                png = await self.page.screenshot(type="png")
                self.frames.append((png, self.phase))
            except Exception:
                pass
            interval = 0.6 if self.phase != "normal" else FRAME_MS / 1000
            await asyncio.sleep(max(0, interval - (time.monotonic() - t)))

    def start(self):
        self._task = asyncio.create_task(self._loop())

    async def stop(self):
        self._stop = True
        await self._task


async def move_click(page, locator, pause=0.35):
    await locator.wait_for(state="visible")
    box = await locator.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    await page.mouse.move(x, y, steps=18)
    await asyncio.sleep(pause)
    await page.mouse.down()
    await page.mouse.up()
    await asyncio.sleep(0.2)


async def park_mouse(page):
    """Move the cursor somewhere neutral so tooltips close."""
    await page.mouse.move(VIEWPORT["width"] * 0.6, VIEWPORT["height"] * 0.45, steps=15)


async def caption(page, text):
    await page.evaluate(CAPTION_JS, text)


async def hold(seconds):
    await asyncio.sleep(seconds)


async def wait_until(check, timeout_s, what):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if await check():
            return
        await asyncio.sleep(0.5)
    raise TimeoutError(f"{what} did not finish within {timeout_s}s")


async def is_busy(button):
    return await button.evaluate("b => b.classList.contains('bp5-loading') || b.disabled")


async def fail(page, rec, msg):
    await rec.stop()
    shot = OUT.with_suffix(".error.png")
    await page.screenshot(path=str(shot))
    sys.exit(f"{msg}, see {shot}")


async def run():
    # Recreate the workspace every run so the mapping canvas starts empty.
    subprocess.run([sys.executable, str(Path(__file__).parent / "setup_workspace.py"), API], check=True)
    ws = next(w for w in api("/workspaces/") if w["name"] == "FOAF Demo")
    wid, mid = ws["uuid"], ws["mappings"][0]

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
        await ctx.add_init_script(CURSOR_JS)
        page = await ctx.new_page()

        await page.goto(f"{APP}/workspaces/{wid}/mapping/{mid}")
        await page.get_by_role("button", name="Save").wait_for()
        await page.locator(".react-flow").wait_for()
        await page.evaluate(CURSOR_JS)
        await page.mouse.move(VIEWPORT["width"] / 2, VIEWPORT["height"] / 2)

        rec = Recorder(page)
        rec.start()

        # --- 1. Empty canvas + source columns -------------------------------------
        await caption(page, "Empty mapping: people.csv → FOAF ontology")
        await hold(1.6)
        await move_click(page, page.locator('button[title="Source References"]'))
        await caption(page, "Source columns available to the assistant")
        await hold(2.0)

        # --- 2. Generate mapping with the LLM -------------------------------------
        await caption(page, "Open the AI Mapping Assistant")
        await move_click(page, page.locator('button[title="AI"]'))
        generate = page.get_by_role("button", name="Generate Mapping with AI")
        await generate.wait_for()
        await wait_until(lambda: _not(is_busy(generate)), 60, "AI assistant init")
        await hold(1.0)

        await caption(page, "One click: LLM proposes the full mapping graph")
        await move_click(page, generate, pause=0.6)
        await park_mouse(page)
        rec.begin_wait()
        await caption(page, "Generating mapping…")
        await hold(1.0)
        await wait_until(lambda: _not(is_busy(generate)), GENERATE_TIMEOUT_S, "LLM generation")
        rec.end_wait()

        if await page.get_by_text("Error", exact=True).count() or not await page.locator(".react-flow__node").count():
            await fail(page, rec, "Generation failed")

        await caption(page, "Classes, properties and URI templates mapped to FOAF")
        await hold(0.6)
        await move_click(page, page.locator(".react-flow__controls-fitview"))
        await park_mouse(page)
        await hold(2.4)

        await caption(page, "Inspect any generated node")
        await move_click(page, page.locator(".react-flow__node-entity").first)
        await hold(2.4)

        # --- 3. SHACL validation (editor's Validate button saves, then validates) ----
        await caption(page, "Validate: save + check the generated graph against SHACL shapes")
        await move_click(page, page.locator(".bp5-navbar").get_by_role("button", name="Validate", exact=True))
        row = page.locator(".bp5-card").filter(has_text="People").first
        row_validate = row.get_by_role("button", name="Validate", exact=True)
        tag = row.get_by_text(re.compile(r"\d+ violation\(s\)"))
        await row_validate.wait_for()
        await park_mouse(page)
        rec.begin_wait()
        await caption(page, "Running RML mapper + SHACL validation…")
        await wait_until(tag.is_visible, VALIDATE_TIMEOUT_S, "SHACL validation")
        await wait_until(lambda: _not(is_busy(row_validate)), VALIDATE_TIMEOUT_S, "SHACL validation")
        rec.end_wait()

        async def count_violations():
            return int(re.match(r"\d+", await tag.inner_text()).group(0))

        violations = await count_violations()
        await caption(page, f"{violations} SHACL violation(s) found" if violations else "Graph conforms to the shapes ✓")
        await hold(3.5)

        # --- 4. LLM auto-repair loop (only if there is something to fix) ------------
        if violations and REPAIR:
            await caption(page, "Auto-Repair: LLM locates and fixes violations, re-validating every fix")
            iterations = row.locator("input").first
            await move_click(page, iterations)
            await iterations.fill(str(REPAIR_ITERATIONS))
            repair = row.get_by_role("button", name="Auto-Repair")
            await move_click(page, repair, pause=0.6)
            await park_mouse(page)
            cancel = row.get_by_role("button", name="Cancel")
            rec.begin_wait()
            await hold(1.5)  # repair may be quick; don't require catching Cancel enabled
            await wait_until(cancel.is_disabled, REPAIR_TIMEOUT_S, "Auto-Repair")
            rec.end_wait()
            await caption(page, "Repair log: every accepted fix was verified by re-validation")
            await hold(3.5)

            apply = row.get_by_role("button", name="Apply")
            if await apply.is_enabled():
                await caption(page, "Apply the repaired mapping and re-validate")
                await move_click(page, apply)
                await hold(1.2)
                await move_click(page, row_validate)
                await park_mouse(page)
                rec.begin_wait()
                await hold(1.0)
                await wait_until(lambda: _not(is_busy(row_validate)), VALIDATE_TIMEOUT_S, "SHACL re-validation")
                rec.end_wait()
                await caption(page, f"Violations: {violations} → {await count_violations()}")
                await hold(3.5)

        await caption(page, "")
        await hold(0.4)
        await rec.stop()
        await browser.close()

    write_gif(rec.frames)


async def _not(awaitable):
    return not await awaitable


def write_gif(frames):
    # Keep all interactive frames; resample each wait segment into a short clip.
    wait_ms = FRAME_MS * 4
    segments: dict[str, list[int]] = {}
    for i, (_, ph) in enumerate(frames):
        if ph != "normal":
            segments.setdefault(ph, []).append(i)
    keep_wait = set()
    for idx in segments.values():
        n = max(1, min(len(idx), WAIT_PHASE_MAX_MS // wait_ms))
        step = len(idx) / n
        keep_wait |= {idx[int(k * step)] for k in range(n)}

    images, durations = [], []
    prev = None
    for i, (png, ph) in enumerate(frames):
        if ph != "normal" and i not in keep_wait:
            continue
        dur = wait_ms if ph != "normal" else FRAME_MS
        im = Image.open(io.BytesIO(png)).convert("RGB")
        im = im.resize((GIF_WIDTH, round(im.height * GIF_WIDTH / im.width)), Image.LANCZOS)
        if prev is not None and im.tobytes() == prev.tobytes():
            durations[-1] += dur  # merge identical consecutive frames
            continue
        images.append(im)
        durations.append(dur)
        prev = im
    durations[-1] += 1500  # linger on the final frame before looping

    # Shared palette built from frames sampled across the whole recording, so colors stay stable.
    samples = images[:: max(1, len(images) // 12)]
    mosaic = Image.new("RGB", (GIF_WIDTH, sum(im.height for im in samples)))
    y = 0
    for im in samples:
        mosaic.paste(im, (0, y))
        y += im.height
    palette_src = mosaic.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    quantized = [im.quantize(palette=palette_src, dither=Image.Dither.NONE) for im in images]
    quantized[0].save(
        OUT, save_all=True, append_images=quantized[1:], duration=durations, loop=0, optimize=True, disposal=1
    )
    print(f"wrote {OUT} ({len(images)} frames, {sum(durations) / 1000:.1f}s, {OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    asyncio.run(run())
