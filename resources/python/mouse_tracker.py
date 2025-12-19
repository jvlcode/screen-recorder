from pynput import mouse
import json
import sys
import time

clicks = []

def on_click(x, y, button, pressed):
    if pressed:
        data = {
            "x": x,
            "y": y,
            "button": str(button),
            "timeMs": int(time.time() * 1000)
        }
        clicks.append(data)

        # Send event to Electron (stdout only)
        print(json.dumps(data))
        sys.stdout.flush()

with mouse.Listener(on_click=on_click) as listener:
    listener.join()