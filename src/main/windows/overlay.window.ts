import { is } from "@electron-toolkit/utils";
import { BrowserWindow, screen } from "electron";
import { join } from "path";

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
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  overlayWindow.setIgnoreMouseEvents(true); // 👈 click-through

  if (is.dev) {
    // Development: use Vite dev server
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`)
  } else {
    // Production: use built file
    overlayWindow.loadFile(join(__dirname, 'out/renderer/overlay.html'))
  }

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

export function getOverlayWindow() {
  return overlayWindow;
}

export function sendOverlayCombo(combo: string) {
  overlayWindow?.webContents.send("overlay:combo", combo);
}
