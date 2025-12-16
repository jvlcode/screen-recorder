import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, screen } from "electron";
import path from "path";

let overlayWindow: BrowserWindow | null = null;

export function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  overlayWindow.setIgnoreMouseEvents(true); // 👈 click-through
overlayWindow.loadFile(
  path.join(app.getAppPath(), "out/renderer/overlay.html")
);
   overlayWindow.webContents.once("did-finish-load", () => {
    if (is.dev && overlayWindow) {
      overlayWindow.webContents.openDevTools({ mode: "detach" });
    }
  });
  return overlayWindow;
}

export function showOverlay() {
  overlayWindow?.showInactive();
}

export function hideOverlay() {
  overlayWindow?.hide();
}

export function sendOverlayCombo(combo: string) {
  overlayWindow?.webContents.send("overlay:combo", combo);
}
