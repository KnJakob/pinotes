import os
import shutil
import threading
import time
from datetime import datetime, timedelta

MAX_BACKUPS = 14

def backup_data_json(src="data.json", dest_dir="./data"):
    """Copy data.json to ./data/<date>.json"""
    if not os.path.exists(src):
        print(f"[backup] Warning: {src} not found, skipping backup.")
        return

    os.makedirs(dest_dir, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    dest_path = os.path.join(dest_dir, f"{date_str}.json")

    shutil.copy2(src, dest_path)
    print(f"[backup] Copied {src} -> {dest_path}")

    _cleanup_old_backups(dest_dir)


def _cleanup_old_backups(dest_dir):
    """Remove oldest backups if file count exceeds MAX_BACKUPS."""
    if not os.path.exists(dest_dir):
        return

    files = [
        os.path.join(dest_dir, f)
        for f in os.listdir(dest_dir)
        if f.endswith(".json") and os.path.isfile(os.path.join(dest_dir, f))
    ]

    while len(files) > MAX_BACKUPS:
        oldest = min(files, key=os.path.getmtime)
        try:
            os.remove(oldest)
            print(f"[backup] Removed old backup: {oldest}")
        except OSError as e:
            print(f"[backup] Error removing {oldest}: {e}")
            break
        files.remove(oldest)


def _seconds_until_next_run(hour=0, minute=0):
    """Seconds until the next occurrence of hour:minute (default midnight)."""
    now = datetime.now()
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(days=1)
    return (next_run - now).total_seconds()

def start_daily_backup_scheduler(src="data.json", dest_dir="./data", hour=0, minute=0):
    """Starts a background thread that backs up data.json once a day."""
    def loop():
        while True:
            wait_time = _seconds_until_next_run(hour, minute)
            time.sleep(wait_time)
            backup_data_json(src, dest_dir)

    thread = threading.Thread(target=loop, daemon=True)
    thread.start()
    print(f"[backup] Daily backup scheduler started (runs at {hour:02d}:{minute:02d}).")

if __name__=="__main__":
    backup_data_json()
