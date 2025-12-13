import { BrowserWindow, shell } from "electron";
import { join } from "path";
import icon from "../../../resources/icon.png?asset";

let mainWindow: BrowserWindow | null = null;

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
      webSecurity: false
    }
  });

  mainWindow.on("ready-to-show", () => mainWindow!.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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
