import { app, BrowserWindow, globalShortcut, dialog } from "electron";
import { join } from "path";
import fs from "fs";
import path from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";

import { registerIpcHandlers } from "./ipc";
import {
  createMainWindow,
  showMainWindow,
} from "./windows/main.window";

import { stopRecording } from "./services/recorder.service";
import { createTrimWindow, sendToTrimWindow, showTrimWindow } from "./windows/trim.windows";
import { createOverlayWindow, showOverlay } from "./windows/overlay.window";

let mainWindow: BrowserWindow;
let trimWindow: BrowserWindow;
let overlayWindow: BrowserWindow;

/* ---------------- LOGGER ---------------- */

export function log(...args: any[]) {
  try {
    const logDir = app.getPath("userData");
    const logFile = path.join(logDir, "app.log");

    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] ${args
        .map(a => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ")}\n`
    );
  } catch (e) {
    // last-resort fallback
    console.error("LOG FAILED", e);
  }
}

/* ---------------- GLOBAL ERROR HANDLERS ---------------- */

process.on("uncaughtException", (err) => {
  log("UNCAUGHT_EXCEPTION:", err.stack || err.message);
});

process.on("unhandledRejection", (reason) => {
  log("UNHANDLED_REJECTION:", String(reason));
});

/* ---------------- SINGLE INSTANCE LOCK ---------------- */

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  dialog.showMessageBoxSync({
    type: "warning",
    title: "Application Already Running",
    message: "This application is already running.\nPlease use the existing window.",
    buttons: ["OK"],
  });
  app.quit();
} else {

  app.on("second-instance", () => {
    log("Second instance attempted");

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    dialog.showMessageBox({
      type: "info",
      title: "Already Running",
      message: "The application is already running. The existing window has been focused.",
      buttons: ["OK"],
    });
  });

  /* ---------------- APP READY ---------------- */

  app.whenReady().then(() => {
    log("App ready");
    log("isPackaged:", app.isPackaged);
    log("resourcesPath:", process.resourcesPath);

    electronApp.setAppUserModelId("com.electron");

    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    /* -------- VERIFY extraResources -------- */
    try {
      log(
        "Python exists:",
        fs.existsSync(path.join(process.resourcesPath, "python"))
      );
      log(
        "FFmpeg exists:",
        fs.existsSync(path.join(process.resourcesPath, "ffmpeg"))
      );
    } catch (e) {
      log("Resource check failed:", e);
    }

    /* 1️⃣ Register IPC */
    // registerIpcHandlers();
    log("IPC handlers registered");

    /* 2️⃣ Create main window */
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow();
      log("Main window created");
    }
    /* 2️⃣ Create trim window */
    if (!trimWindow || trimWindow.isDestroyed()) {
      trimWindow = createTrimWindow(mainWindow);
      log("Main window created");
    }
    /* 2️⃣ Create trim window */
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      overlayWindow = createOverlayWindow();
      showOverlay();
      log("Overlay window created");
    }

    /* 3️⃣ Load renderer */
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      log("Loading dev URL:", process.env.ELECTRON_RENDERER_URL);
      mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      const indexPath = join(__dirname, "../renderer/index.html");
      log("Loading file:", indexPath);
      mainWindow.loadFile(indexPath);
    }

    /* 🔧 OPTIONAL: Enable DevTools in production for debugging */
    // mainWindow.webContents.openDevTools({ mode: "detach" });

    /* 4️⃣ Global shortcut: STOP recording */
    globalShortcut.register("Shift+S", async () => {
      log("Shift+S pressed");

      if (!mainWindow || mainWindow.isDestroyed()) {
        log("Main window missing");
        return;
      }

      try {
        log("Stopping recording...");
        const filePath = await stopRecording();
        log("Recording saved:", filePath);

        showMainWindow();
        showTrimWindow();
        sendToTrimWindow("recording:stopped", filePath);
      } catch (err: any) {
        log("Failed to stop recording:", err?.stack || err);
      }
    });

    
  });

  /* ---------------- SHUTDOWN ---------------- */

  app.on("window-all-closed", () => {
    log("All windows closed");
    if (process.platform !== "darwin") app.quit();
  });
}
