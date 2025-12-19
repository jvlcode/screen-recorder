import { BrowserWindow, screen } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

let overlayWindow: BrowserWindow | null = null;

export function createOverlayWindow() {
	const { width, height, x, y } = screen.getPrimaryDisplay().bounds;

	overlayWindow = new BrowserWindow({
		x,
		y,
		width,
		height,
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

	overlayWindow.setIgnoreMouseEvents(true);

	if (is.dev && process.env.ELECTRON_RENDERER_URL) {
		overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
		overlayWindow.webContents.openDevTools({ mode: "detach" });
	} else {
		const indexPath = join(__dirname, "../renderer/overlay.html");
		overlayWindow.loadURL(`file://${indexPath}`);
	}

	// // Provide overlay bounds to renderer
	// ipcMain.handle('overlay:get-bounds', () => {
	// 	if (!overlayWindow) return null;
	// 	return overlayWindow.getBounds();
	// });

	return overlayWindow;
}

export function getOverlayWindow() {
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
