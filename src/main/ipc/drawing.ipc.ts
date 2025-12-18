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
  globalShortcut.register("F5", () => {
    console.log("F5 callec")
    drawingEnabled = !drawingEnabled
    getOverlayWindow()?.setIgnoreMouseEvents(!drawingEnabled, { forward: true })

    getOverlayWindow()?.webContents.send(
      "drawing:toggle",
      drawingEnabled
    )

    if (drawingEnabled) {
      registerDrawingShortcuts()
    } else {
      unregisterDrawingShortcuts()
    }
  })

  // Clear drawings
  globalShortcut.register("F6", () => {
    getOverlayWindow()?.webContents.send("drawing:clear")
  })
}

/* ===============================
   Cleanup
================================ */
app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})
