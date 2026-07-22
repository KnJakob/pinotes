from flask import Flask, jsonify, request, render_template
import json
import os
import uuid
from datetime import datetime
from backup_daemon import start_daily_backup_scheduler

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")

DEFAULT_DATA = {
    "folders": {
        "quick-notes": {
            "name": "Quick Notes",
            "icon": "⚡",
            "notes": []
        }
    },
    "notes": {}
}


def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_DATA)
        return DEFAULT_DATA
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# Folders

@app.route("/api/folders", methods=["GET"])
def get_folders():
    data = load_data()
    folders = []
    for fid, folder in data["folders"].items():
        folders.append({
            "id": fid,
            "name": folder["name"],
            "icon": folder.get("icon", "📁"),
            "note_count": len(folder["notes"])
        })
    return jsonify(folders)


@app.route("/api/folders", methods=["POST"])
def create_folder():
    data = load_data()
    body = request.get_json()
    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    fid = name.lower().replace(" ", "-") + "-" + str(uuid.uuid4())[:4]
    data["folders"][fid] = {
        "name": name,
        "icon": body.get("icon", "📁"),
        "notes": []
    }
    save_data(data)
    return jsonify({"id": fid, "name": name, "icon": data["folders"][fid]["icon"], "note_count": 0})


@app.route("/api/folders/<folder_id>", methods=["DELETE"])
def delete_folder(folder_id):
    data = load_data()
    if folder_id == "quick-notes":
        return jsonify({"error": "Cannot delete Quick Notes"}), 400
    if folder_id not in data["folders"]:
        return jsonify({"error": "Not found"}), 404
    # delete contained notes
    for nid in data["folders"][folder_id]["notes"]:
        data["notes"].pop(nid, None)
    del data["folders"][folder_id]
    save_data(data)
    return jsonify({"ok": True})


# Notes

@app.route("/api/folders/<folder_id>/notes", methods=["GET"])
def get_notes(folder_id):
    data = load_data()
    if folder_id not in data["folders"]:
        return jsonify({"error": "Not found"}), 404
    notes = []
    for nid in data["folders"][folder_id]["notes"]:
        note = data["notes"].get(nid)
        if note:
            notes.append({
                "id": nid,
                "title": note["title"],
                "preview": note.get("preview", ""),
                "updated": note["updated"]
            })
    # newest first
    notes.sort(key=lambda n: n["updated"], reverse=True)
    return jsonify(notes)


@app.route("/api/notes/<note_id>", methods=["GET"])
def get_note(note_id):
    data = load_data()
    note = data["notes"].get(note_id)
    if not note:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"id": note_id, **note})


@app.route("/api/folders/<folder_id>/notes", methods=["POST"])
def create_note(folder_id):
    data = load_data()
    if folder_id not in data["folders"]:
        return jsonify({"error": "Folder not found"}), 404
    nid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    data["notes"][nid] = {
        "title": "New Note",
        "content": "",
        "preview": "",
        "updated": now,
        "folder_id": folder_id
    }
    data["folders"][folder_id]["notes"].insert(0, nid)
    save_data(data)
    return jsonify({"id": nid, **data["notes"][nid]})


@app.route("/api/notes/<note_id>", methods=["PUT"])
def update_note(note_id):
    data = load_data()
    if note_id not in data["notes"]:
        return jsonify({"error": "Not found"}), 404
    body = request.get_json()
    note = data["notes"][note_id]
    if "title" in body:
        note["title"] = body["title"]
    if "content" in body:
        note["content"] = body["content"]
        # plain-text preview (strip HTML tags)
        import re
        plain = re.sub(r"<[^>]+>", " ", body["content"])
        plain = re.sub(r"\s+", " ", plain).strip()
        note["preview"] = plain[:120]
    note["updated"] = datetime.utcnow().isoformat()
    save_data(data)
    return jsonify({"id": note_id, **note})


@app.route("/api/notes/<note_id>", methods=["DELETE"])
def delete_note(note_id):
    data = load_data()
    if note_id not in data["notes"]:
        return jsonify({"error": "Not found"}), 404
    folder_id = data["notes"][note_id].get("folder_id")
    del data["notes"][note_id]
    if folder_id and folder_id in data["folders"]:
        data["folders"][folder_id]["notes"] = [
            n for n in data["folders"][folder_id]["notes"] if n != note_id
        ]
    save_data(data)
    return jsonify({"ok": True})


@app.route("/api/notes/<note_id>/move", methods=["POST"])
def move_note(note_id):
    data = load_data()
    if note_id not in data["notes"]:
        return jsonify({"error": "Not found"}), 404
    body = request.get_json()
    new_folder = body.get("folder_id")
    if new_folder not in data["folders"]:
        return jsonify({"error": "Target folder not found"}), 404
    old_folder = data["notes"][note_id].get("folder_id")
    if old_folder and old_folder in data["folders"]:
        data["folders"][old_folder]["notes"] = [
            n for n in data["folders"][old_folder]["notes"] if n != note_id
        ]
    data["folders"][new_folder]["notes"].insert(0, note_id)
    data["notes"][note_id]["folder_id"] = new_folder
    save_data(data)
    return jsonify({"ok": True})


if __name__ == "__main__":
    start_daily_backup_scheduler()
    app.run(host="0.0.0.0", port=5000, debug=False)
