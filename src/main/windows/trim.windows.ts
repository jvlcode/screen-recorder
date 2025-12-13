import { BrowserWindow } from "electron";
import { join } from "path";

let trimWindow: BrowserWindow | null = null;
let isReady = false;

// Queue messages until renderer is ready
const pendingMessages: Array<{ channel: string; payload: any }> = [];

/* ---------------- OPEN WINDOW ---------------- */

export function openTrimWindow(parent: BrowserWindow) {
  if (!trimWindow || trimWindow.isDestroyed()) {
    trimWindow = new BrowserWindow({
      width: 900,
      height: 600,
      parent,
      modal: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        webSecurity: false
      }
    });

    isReady = false;

    trimWindow.on("close", e => {
      e.preventDefault();
      trimWindow!.hide();
    });

    const url = process.env.ELECTRON_RENDERER_URL
      ? `${process.env.ELECTRON_RENDERER_URL}/#/trim`
      : join(__dirname, "../renderer/index.html");

    trimWindow.loadURL(url);

    trimWindow.webContents.on("did-finish-load", () => {
      isReady = true;

      // 🔥 flush queued messages
      pendingMessages.forEach(m =>
        trimWindow!.webContents.send(m.channel, m.payload)
      );
      pendingMessages.length = 0;
    });
  }

  trimWindow.show();
  trimWindow.focus();
}

/* ---------------- SAFE SEND ---------------- */

export function sendToTrimWindow(channel: string, payload?: any) {
  if (!trimWindow || trimWindow.isDestroyed()) {
    console.warn("Trim window not available:", channel);
    return;
  }

  if (!isReady) {
    // queue until React is ready
    pendingMessages.push({ channel, payload });
    return;
  }

  trimWindow.webContents.send(channel, payload);
}

/* ---------------- HIDE ---------------- */

export function hideTrimWindow() {
  trimWindow?.hide();
  trimWindow?.setSkipTaskbar(true);
}
