import { ipcMain } from 'electron';
import { getOverlayWindow } from '../windows/overlay.window';
import { startKeyListener } from '../services/keybridge.service';
import { startMouseTracker } from '../services/mouse.service';
import { log } from '..';


/**
 * Start the Python mouse tracker
 */


/**
 * Register click forwarding
 * Call this from your main process after overlay window is created
 */
export function registerCursorIPC() {
    startMouseTracker();
    startKeyListener();

    ipcMain.handle('overlay:get-bounds', () => {
        const overlay = getOverlayWindow();
        log("overlay:get-bounds before")
        if (!overlay) return null;
        log("overlay:get-bounds",overlay.getBounds())
        return overlay.getBounds();
    });
}
