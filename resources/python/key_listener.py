from pynput import keyboard
import json
import time

# ---------- STATE ----------
pressed = set()
last_sent = None
last_time = 0

# ---------- MODIFIERS ----------
MODIFIER_MAP = {
    keyboard.Key.ctrl_l: "Ctrl",
    keyboard.Key.ctrl_r: "Ctrl",
    keyboard.Key.shift: "Shift",
    keyboard.Key.shift_r: "Shift",
    keyboard.Key.alt_l: "Alt",
    keyboard.Key.alt_r: "Alt",
    keyboard.Key.cmd: "Cmd"
}

MODIFIERS = set(MODIFIER_MAP.values())
ORDER = ["Ctrl", "Shift", "Alt", "Cmd"]

# ---------- VK SYMBOL MAP (Windows) ----------
VK_SYMBOL_MAP = {
    192: "`",   # backtick
    189: "-",
    187: "=",
    219: "[",
    221: "]",
    220: "\\",
    186: ";",
    222: "'",
    188: ",",
    190: ".",
    191: "/"
}

# ---------- HELPERS ----------
def has_real_modifier():
    return any(m in pressed for m in ["Ctrl", "Alt", "Cmd"])

def normalize_combo():
    mods = [m for m in ORDER if m in pressed]
    keys = sorted(k for k in pressed if k not in MODIFIERS)
    return " + ".join(mods + keys)

# ---------- HANDLERS ----------
def on_press(key):
    global last_sent, last_time

    name = None

    # Modifier keys
    if key in MODIFIER_MAP:
        name = MODIFIER_MAP[key]

    # Letters (A–Z)
    elif hasattr(key, "vk") and 65 <= key.vk <= 90:
        name = chr(key.vk)

    # Numbers (0–9)
    elif hasattr(key, "vk") and 48 <= key.vk <= 57:
        name = chr(key.vk)

    # Symbols (backtick, [, ], etc.)
    elif hasattr(key, "vk") and key.vk in VK_SYMBOL_MAP:
        name = VK_SYMBOL_MAP[key.vk]

    if not name:
        return

    pressed.add(name)

    # ❌ Ignore typing (no modifier)
    if not has_real_modifier():
        return

    # Require at least modifier + one key
    if len(pressed) < 2:
        return

    combo = normalize_combo()
    now = time.time()

    # Debounce repeated events
    if combo == last_sent and (now - last_time) < 0.35:
        return

    last_sent = combo
    last_time = now

    print(json.dumps({
        "type": "keycombo",
        "combo": combo,
        "ts": now
    }), flush=True)

def on_release(key):
    if key in MODIFIER_MAP:
        pressed.discard(MODIFIER_MAP[key])
    elif hasattr(key, "vk") and 65 <= key.vk <= 90:
        pressed.discard(chr(key.vk))
    elif hasattr(key, "vk") and 48 <= key.vk <= 57:
        pressed.discard(chr(key.vk))
    elif hasattr(key, "vk") and key.vk in VK_SYMBOL_MAP:
        pressed.discard(VK_SYMBOL_MAP[key.vk])

# ---------- LISTENER ----------
with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
    print("KEY LISTENER READY", flush=True)
    listener.join()
