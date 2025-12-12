import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers, setMainWindowForIpc } from './ipc'
import { saveSegmentFile } from './recorder'

let mainWindow: BrowserWindow | null = null
let trimWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    fullscreen: false,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return mainWindow
}

/** Create or reuse the trim window. It will be hidden instead of closed. */
export function openTrimWindow(parent: BrowserWindow, filePath: string) {
  if (!trimWindow || trimWindow.isDestroyed()) {
    trimWindow = new BrowserWindow({
      width: 900,
      height: 600,
      parent,
      modal: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity:false
      }
    });

    // Prevent closing permanently
    trimWindow.on("close", (e) => {
      e.preventDefault();
      trimWindow!.hide();
    });
     // Always reload route
    if (process.env['ELECTRON_RENDERER_URL']) {
      trimWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/trim`);
    } else {
      trimWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { trim: '1' }
      });
    }

    trimWindow.webContents.on("did-finish-load", () => {
      const fileUrl = filePath.replace(/\\/g, '/');
      console.log("Sending load-segment:", fileUrl);
      trimWindow!.webContents.send('load-segment', fileUrl);
    });

  } else {
     // Now React ALREADY running → simply send segment
    const fileUrl = filePath.replace(/\\/g, '/');
    trimWindow.webContents.send("load-segment", fileUrl);
  }


  trimWindow.show();
  trimWindow.focus();
}



export function hideWindowCompletely() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
    mainWindow.setSkipTaskbar(true)
  }

  if (trimWindow && !trimWindow.isDestroyed()) {
    trimWindow.hide()
    trimWindow.setSkipTaskbar(true)
  }
}


app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers first (they won't rely on mainWindow variable yet)
  registerIpcHandlers()

  // Create main window instance (but we will load content after we pass mainWindow to ipc code)
  mainWindow = createMainWindow()

  // Give ipc module a reference to mainWindow so handlers can send messages later
  setMainWindowForIpc(mainWindow)

  // Now load the renderer content (after handlers are ready and mainWindow exists)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Hotkey to stop recording — restore UI and tell renderer to stop
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("CommandOrControl+Shift+S hotkey");
        mainWindow.webContents.send('recording:stop');
        mainWindow.show();
         mainWindow.setSkipTaskbar(false)
        mainWindow.focus();
    }
  })

  
  // e.g. handling 'save-segment' could be here or in ipc.ts — keep where it makes sense
  ipcMain.handle('save-segment', async (_, buffer: Uint8Array, suggestedName?: string) => {
    const filePath = await saveSegmentFile(Buffer.from(buffer), suggestedName);
    console.log("save-segment handled", filePath);
    // open trim window after saving
    if (mainWindow) openTrimWindow(mainWindow, filePath)
    return filePath
  })

  ipcMain.handle('recording:started', async () => {
    hideWindowCompletely();
  })


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })


})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
