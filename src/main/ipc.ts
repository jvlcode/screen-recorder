import { ipcMain, desktopCapturer, BrowserWindow } from 'electron'
import { trimSegmentFile, concatSegments } from './recorder'
import { hideWindowCompletely } from '.'

let _mainWindow: BrowserWindow | null = null

export function setMainWindowForIpc(win: BrowserWindow) {
  _mainWindow = win
}

/**
 * Register IPC handlers. Call this early (before renderer loads).
 * Handlers that need mainWindow will use _mainWindow (set later by index.ts).
 */
export function registerIpcHandlers() {
  // Expose desktopCapturer sources
  ipcMain.handle('get-sources', async (_, opts) => {
    return await desktopCapturer.getSources(opts)
  })

  // Request to trim a saved segment (from trim-window renderer)
  ipcMain.handle('trim-segment', async (_, args: { filePath: string; startSec: number; endSec: number }) => {
    const { filePath, startSec, endSec } = args
    console.log('trim-segment', startSec, endSec, filePath)
    await trimSegmentFile(filePath, startSec, endSec)
    // tell main UI to resume recording
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('recording:resume')
       hideWindowCompletely();
    }
    return true
  })

  // Finalize (concat) segments
  ipcMain.handle('finalize', async () => {
    console.log("finalize");
    const out = await concatSegments()
    return out
  })

  
}
