import { app, BrowserWindow, globalShortcut } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";

import { registerIpcHandlers } from "./ipc";

import {
  createMainWindow,
  showMainWindow,
} from "./windows/main.window";



import { stopRecording } from "./services/recorder.service";
import { openTrimWindow, sendToTrimWindow } from "./windows/trim.windows";



let mainWindow: BrowserWindow;

/* ---------------- APP READY ---------------- */

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  /* 1️⃣ Register IPC (NO window dependency) */
  registerIpcHandlers();

  /* 2️⃣ Create main window */
  mainWindow = createMainWindow();

  /* 3️⃣ Load renderer */
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  /* 4️⃣ Global shortcut: STOP recording */
  globalShortcut.register("CommandOrControl+Shift+S", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    console.log("Stop recording shortcut pressed");

    try {
      // await stopMouseTracker();

      const filePath = await stopRecording();
      console.log("Recording saved:", filePath);

      showMainWindow();
      openTrimWindow(mainWindow);
      // mainWindow.webContents.send("recording:stopped", filePath);
      sendToTrimWindow("recording:stopped", filePath)
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  });

  /* 5️⃣ Renderer-triggered start recording */
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

/* ---------------- IPC-LIKE START RECORDING (EVENT) ---------------- */
/**
 * Renderer should invoke:
 * ipcRenderer.invoke("recording:start")
 * (handled in recording.ipc.ts)
 *
 * That IPC handler should call:
 *   startRecording()
 *   startMouseTracker()
 *   hideMainWindow()
 *   hideTrimWindow()
 */

/* ---------------- SHUTDOWN ---------------- */

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
function stopMouseTracker() {
    throw new Error("Function not implemented.");
}

