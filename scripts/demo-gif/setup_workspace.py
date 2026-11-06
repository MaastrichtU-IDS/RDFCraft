"""Create a FOAF demo workspace (ontology + SHACL shapes + people.csv mapping) in a running RDFCraft backend."""

import base64
import json
import sys
import urllib.request
from pathlib import Path

API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api"
HERE = Path(__file__).parent
WS_NAME = "FOAF Demo"


def call(method, path, body=None):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def b64(p):
    return base64.b64encode((HERE / p).read_bytes()).decode()


existing = [w for w in call("GET", "/workspaces/") if w["name"] == WS_NAME]
for w in existing:
    call("DELETE", f"/workspaces/{w['uuid']}")

call("POST", "/workspaces/", {"name": WS_NAME, "description": "FOAF people mapping demo", "type": "local"})
ws = next(w for w in call("GET", "/workspaces/") if w["name"] == WS_NAME)
wid = ws["uuid"]

call("POST", f"/workspaces/{wid}/prefix", {"prefix": "foaf", "uri": "http://xmlns.com/foaf/0.1/"})
call("POST", f"/workspaces/{wid}/prefix", {"prefix": "ex", "uri": "http://example.org/people/"})
call("POST", f"/workspaces/{wid}/ontology", {
    "name": "FOAF",
    "description": "Friend of a Friend vocabulary",
    "base_uri": "http://xmlns.com/foaf/0.1/",
    "content": b64("foaf.ttl"),
})
call("POST", f"/workspaces/{wid}/shapes", {
    "name": "FOAF Person shapes",
    "description": "Constraints on foaf:Person and foaf:Organization",
    "content": b64("foaf-shapes.ttl"),
})
call("POST", f"/workspaces/{wid}/mapping", {
    "name": "People",
    "description": "Map people, their contact details, organizations and who they know to FOAF",
    "content": b64("people.csv"),
    "source_type": "csv",
    "extra": {},
})
ws = call("GET", f"/workspaces/{wid}")
print(json.dumps({"workspace": wid, "mapping": ws["mappings"][0]}))
