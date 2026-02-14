from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HIDEOUT_DATA_PATH = DATA_DIR / "hideout_data.json"
PROGRESS_PATH = DATA_DIR / "progress.json"

app = Flask(__name__)

## HELPERS ##
def _load_json(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def _save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/hideout")
def api_hideout():
    """
    Returns hideout module structure + requirements.
    You will populate hideout_data.json from your Excel-derived data.
    """
    data = _load_json(HIDEOUT_DATA_PATH, {"modules": []})
    return jsonify({"ok": True, "data": data})

@app.get("/api/progress")
def api_get_progress():
    """
    Returns saved levels per module.
    """
    progress = _load_json(PROGRESS_PATH, {"levels": {}})
    return jsonify({"ok": True, "progress": progress})

@app.post("/api/progress")
def api_set_progress():
    """
    Expects: { "module_id": "generator", "level": 2 }
    Saves locally and returns updated progress.
    """
    payload = request.get_json(silent=True) or {}
    module_id = (payload.get("module_id") or "").strip()
    level = payload.get("level")

    if not module_id or not isinstance(level, int) or level < 0:
        return jsonify({"ok": False, "error": "invalid_payload"}), 400

    progress = _load_json(PROGRESS_PATH, {"levels": {}})
    progress.setdefault("levels", {})
    progress["levels"][module_id] = level

    _save_json(PROGRESS_PATH, progress)
    return jsonify({"ok": True, "progress": progress})

@app.get("/api/summary")
def api_summary():
    hideout = _load_json(HIDEOUT_DATA_PATH, {"modules": []})
    progress = _load_json(PROGRESS_PATH, {"levels": {}})

    levels = progress.get("levels", {})

    total_levels = 0
    done_levels = 0

    remaining = {}  # item -> qty remaining
    remaining_fir = {}  # item -> qty remaining where FIR is ever required

    for m in hideout.get("modules", []):
        mid = m["id"]
        max_level = int(m.get("max_level") or 0)
        cur = int(levels.get(mid, 0) or 0)

        total_levels += max_level
        done_levels += min(cur, max_level)

        # Remaining: sum requirements for levels > cur
        upgrades = m.get("upgrades", {})
        for lvl_str, reqs in upgrades.items():
            lvl = int(lvl_str)
            if lvl <= cur:
                continue
            for r in reqs:
                item = r.get("item", "").strip()
                qty = int(r.get("qty") or 0)
                if not item or qty <= 0:
                    continue
                remaining[item] = remaining.get(item, 0) + qty
                if r.get("fir") is True:
                    remaining_fir[item] = remaining_fir.get(item, 0) + qty

    pct = 100.0 if total_levels == 0 else round((done_levels / total_levels) * 100, 2)

    return jsonify({
        "ok": True,
        "completion": {
            "done_levels": done_levels,
            "total_levels": total_levels,
            "percent": pct
        },
        "remaining": remaining,
        "remaining_fir": remaining_fir
    })


if __name__ == "__main__":
    # Local dev defaults
    port = int(os.getenv("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=True)
