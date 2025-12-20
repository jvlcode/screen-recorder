import { globalShortcut, app } from "electron"
import { getOverlayWindow } from "../windows/overlay.window"

let drawingEnabled = false
let drawingShortcutsRegistered = false

/* ===============================
   Drawing Shortcuts
================================ */
function registerDrawingShortcuts() {
  if (drawingShortcutsRegistered) return

  globalShortcut.register("1", () => {
    getOverlayWindow()?.webContents.send("tool:set", "rectangle")
  })

  globalShortcut.register("2", () => {
    getOverlayWindow()?.webContents.send("tool:set", "arrow")
  })

  //   globalShortcut.register("3", () => {
  //     getOverlayWindow()?.webContents.send("tool:set", "circle")
  //   })

  //   globalShortcut.register("4", () => {
  //     getOverlayWindow()?.webContents.send("tool:set", "pen")
  //   })

  globalShortcut.register("3", () => {
    getOverlayWindow()?.webContents.send("tool:set", "freeArrow")
  })


  globalShortcut.register("CommandOrControl+Z", () => {
    getOverlayWindow()?.webContents.send("drawing:undo")
  })

  drawingShortcutsRegistered = true
}

function unregisterDrawingShortcuts() {
  if (!drawingShortcutsRegistered) return

  const keys = ["1", "2", "3", "4", "CommandOrControl+Z"]

  keys.forEach(key => {
    if (globalShortcut.isRegistered(key)) {
      globalShortcut.unregister(key)
    }
  })

  drawingShortcutsRegistered = false
}

/* ===============================
   Public API
================================ */
export function registerGlobalShortcuts() {
  // Toggle drawing mode
  // ✅ ONLY place where toggle happens
  globalShortcut.register("F5", () => {
    console.log("F5 pressed → toggle drawing mode");
    toggleDrawingMode();
  });


  // Clear drawings
  globalShortcut.register("F6", () => {
    getOverlayWindow()?.webContents.send("drawing:clear")
  })
}



export function setDrawingMode(enabled: boolean) {
  // 🔒 force state (no toggle)
  if (drawingEnabled === enabled) return;

  drawingEnabled = enabled;

  const win = getOverlayWindow();
  if (!win) return;

  win.setIgnoreMouseEvents(!enabled, { forward: true });
  win.webContents.send("drawing:toggle", enabled);

  if (enabled) {
    registerDrawingShortcuts();
  } else {
    unregisterDrawingShortcuts();
  }

  console.log("Drawing mode:", enabled ? "ON" : "OFF");
}

export function toggleDrawingMode() {
  setDrawingMode(!drawingEnabled);
}


/* ===============================
   Cleanup
================================ */
app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})
