import { globalShortcut } from "electron";
import { sendOverlayCombo } from "../windows/overlay.window";

function normalize(combo: string) {
  return combo
    .replace("CommandOrControl", "Ctrl")
    .replace(/\+/g, " + ");
}

export function registerOverlayShortcuts() {
  const combos = [
    "CommandOrControl+P",
    
  ];

  combos.forEach(c => {
    globalShortcut.register(c, () => {
      sendOverlayCombo(normalize(c));
    });
  });
}
