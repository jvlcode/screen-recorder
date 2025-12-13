from pynput import mouse
import json
import sys
import time
import os

# -----------------------------------------------------
# File location
# -----------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLICK_FILE = os.path.join(BASE_DIR, "clicks.json")

# Delete old file if exists
if os.path.exists(CLICK_FILE):
    os.remove(CLICK_FILE)

clicks = []

def save():
    with open(CLICK_FILE, "w") as f:
        json.dump(clicks, f, indent=2)
    sys.stdout.flush()

def on_click(x, y, button, pressed):
    if pressed:
        data = {
            "x": x,
            "y": y,
            "button": str(button),
            "timeMs": int(time.time() * 1000)
        }
        clicks.append(data)

        # Save after every click
        save()

        # Send event to Electron
        print("CLICK " + json.dumps(data))
        sys.stdout.flush()

with mouse.Listener(on_click=on_click) as listener:
    listener.join()
