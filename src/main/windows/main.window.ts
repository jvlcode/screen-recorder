import { app, BrowserWindow, dialog, shell } from "electron";
import { join } from "path";
import icon from "../../../resources/icon.png?asset";
import { startKeyListener, stopKeyListener } from "../services/keybridge.service";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false; // guard flag

export function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    startKeyListener();
    mainWindow!.show()
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept the close event
  mainWindow.on("close", async (e) => {
    if (isQuitting) return; // already confirmed

    e.preventDefault();
    if (!mainWindow) return;

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Yes", "No"],
      defaultId: 1,
      title: "Confirm Exit",
      message: "Are you sure you want to quit?",
    });

    if (response === 0) {
      isQuitting = true;
      stopKeyListener();
      app.quit(); // quit once, no recursion
    }
    // If "No", do nothing
  });

  return mainWindow;
}

export function showMainWindow() {
  mainWindow?.show();
  mainWindow?.setSkipTaskbar(false);
  mainWindow?.focus();
}

export function hideMainWindow() {
  mainWindow?.hide();
  mainWindow?.setSkipTaskbar(true);
}