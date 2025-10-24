'use client';

import { Editor } from '@monaco-editor/react';
import { IKeyboardEvent, editor } from 'monaco-editor';

import { useEffect, useRef, useState } from 'react';

const OneLineMonaco = ({
  value,
  language = 'mapping',
  onChange,
  disabled,
  ...rest
}: {
  value: string;
  language?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  [key: string]: unknown;
}) => {
  const editorRef = useRef<editor.ICodeEditor | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [focused, setFocused] = useState(false);
  const [fixedPos, setFixedPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [widthPx, setWidthPx] = useState<number>(150);

  const onEnter = (e: IKeyboardEvent) => {
    if (editorRef.current === null) return;
    // prevent new lines
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
    }
  };

  function handleEditorDidMount(ed: editor.ICodeEditor) {
    editorRef.current = ed;

    ed.onKeyDown(onEnter);

    // focus/blur events to toggle popover behavior
    // these events exist on the monaco editor instance; guard in case API differs
    type FocusableEditor = {
      onDidFocusEditorWidget?: (cb: () => void) => void;
      onDidBlurEditorWidget?: (cb: () => void) => void;
    };

    const maybeFocusable = ed as unknown as FocusableEditor;
    maybeFocusable.onDidFocusEditorWidget?.(() => {
      // compute position and width and clamp inside viewport
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();

        // measure text width now to avoid relying on stale state
        const padding = 24;
        const measured = computeTextWidth(value || '', '15px monospace');
        let w = Math.min(1000, Math.max(64, measured + padding));

        // ensure we don't shrink smaller than the wrapper's current rendered width
        const currentRenderedWidth =
          wrapperRef.current.getBoundingClientRect().width;
        if (currentRenderedWidth && currentRenderedWidth > w) {
          w = Math.min(currentRenderedWidth, 1000);
        }

        // If the container/parent is wider than measured content,
        // expand the popup to at least the parent's width (so it doesn't shrink)
        const parent = wrapperRef.current.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        const parentWidth = parentRect?.width ?? undefined;
        if (parentWidth && parentWidth > w) {
          // leave a small viewport margin when expanding
          w = Math.min(parentWidth, 1000);
        }

        // clamp horizontal position
        const margin = 8;
        const viewportW = window.innerWidth;
        let left = rect.left;

        // if we're using parent's width, align to parent's left when possible
        if (parentRect && parentWidth && parentWidth >= w) {
          left = parentRect.left;
        }

        if (left + w + margin > viewportW) {
          left = Math.max(margin, viewportW - w - margin);
        }
        left = Math.max(margin, left);

        // clamp vertical position so popup stays visible
        const viewportH = window.innerHeight;
        const editorH = wrapperRef.current.offsetHeight || 23;
        let top = rect.top;
        if (top + editorH + margin > viewportH) {
          top = Math.max(margin, viewportH - editorH - margin);
        }

        setWidthPx(w);
        setFixedPos({ left, top });
      }
      setFocused(true);
    });

    maybeFocusable.onDidBlurEditorWidget?.(() => {
      setFocused(false);
      setFixedPos(null);
    });
  }

  // compute pixel width from text content using canvas measure
  function computeTextWidth(text: string, font = '15px monospace') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 150;
      ctx.font = font;
      const metrics = ctx.measureText(text || '');
      return Math.ceil(metrics.width);
    } catch {
      return Math.max(50, Math.min(800, (text || '').length * 8 + 20));
    }
  }

  useEffect(() => {
    // when value changes, recompute width
    const padding = 24; // some padding for cursor and padding in editor
    const measured = computeTextWidth(value || '', '15px monospace');
    const w = Math.min(1000, Math.max(64, measured + padding));
    setWidthPx(w);
  }, [value]);

  // Prevent new lines

  const wrapperStyle: React.CSSProperties = {
    display: focused ? 'inline-block' : 'block',
    // when focused, pop over using fixed positioning and large z-index
    position: focused && fixedPos ? 'fixed' : 'relative',
    left: focused && fixedPos ? fixedPos.left : undefined,
    top: focused && fixedPos ? fixedPos.top : undefined,
    zIndex: focused ? 9999 : undefined,
    // boxShadow: focused ? '0 6px 18px rgba(0,0,0,0.25)' : undefined,
    background: focused ? '#1e1e1e' : undefined,
    borderRadius: 4,
    // when focused use measured px width, otherwise fill parent
    width: focused ? `${widthPx}px` : '100%',
    // ensure we don't overflow the viewport if the parent is wider than the viewport
    maxWidth: focused ? undefined : 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    // small horizontal margin when not focused so it's not flush to the viewport edge
    margin: focused ? undefined : '0 8px 0 0',
    // also apply a small translate to visually shift from the absolute viewport edge
    transform: focused ? undefined : 'translateX(6px)',
  };

  return (
    <div
      ref={wrapperRef}
      style={wrapperStyle}
      className='one-line-monaco-wrapper'
    >
      <Editor
        language={language}
        theme='vs-dark'
        value={disabled ? '' : value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        loading={''}
        height='23px'
        width={focused ? `${widthPx}px` : '100%'}
        className='nodrag noscroll'
        options={{
          lineDecorationsWidth: 0,
          glyphMargin: false,
          lineNumbers: 'off',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          readOnly: disabled || false,
          minimap: {
            enabled: false,
          },
          lineNumbersMinChars: 0,
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollBeyondLastColumn: 0,
          folding: false,
          fixedOverflowWidgets: true,
          scrollbar: {
            horizontal: 'hidden',
            vertical: 'hidden',
            // avoid can not scroll page when hover monaco
            alwaysConsumeMouseWheel: false,
          },
          fontFamily: 'monospace',
          fontSize: 15,
        }}
        {...rest}
      />
    </div>
  );
};

export default OneLineMonaco;
