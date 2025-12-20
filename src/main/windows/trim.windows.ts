import { BrowserWindow } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { log } from "..";

let trimWindow: BrowserWindow | null = null;

/* ---------------- CREATE ---------------- */
export function createTrimWindow(parent: BrowserWindow) {
  if (trimWindow && !trimWindow.isDestroyed()) return trimWindow;

  trimWindow = new BrowserWindow({
    width: 900,
    height: 600,
    parent,
    // modal: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });


  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    trimWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/trim`);
    // trimWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // First resolve the file path
    const indexPath = join(__dirname, "../renderer/index.html");
    // Then convert it to a proper file:// URL and append the hash
    trimWindow.loadURL(`file://${indexPath}#/trim`);
  }

  trimWindow.once("ready-to-show", () => {
    // trimWindow?.show();
  });

  trimWindow.on("closed", () => {
    trimWindow = null;
  });

  return trimWindow;
}

/* ---------------- SHOW ---------------- */
export function showTrimWindow() {
  if (trimWindow && !trimWindow.isDestroyed()) {
    trimWindow.show();
    trimWindow.setSkipTaskbar(false);
    trimWindow.focus();
  }
}

/* ---------------- HIDE ---------------- */
export function hideTrimWindow() {
  if (trimWindow && !trimWindow.isDestroyed()) {
    trimWindow.hide();
    trimWindow.setSkipTaskbar(true);
  }
}

/* ---------------- CLOSE ---------------- */
export function closeTrimWindow() {
  if (trimWindow && !trimWindow.isDestroyed()) {
    trimWindow.close();
  }
}

/* ---------------- SEND ---------------- */
export function sendToTrimWindow(channel: string, payload?: any) {
  if (!trimWindow || trimWindow.isDestroyed()) {
    log("Trim window not available:", channel, payload);
    return;
  }
  trimWindow.webContents.send(channel, payload);
}

export function getTrimWindow() {
  return trimWindow;
}