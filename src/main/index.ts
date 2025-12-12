import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers, setMainWindowForIpc } from './ipc'
import { startRecording, startRecordingSeparate, stopRecording, stopRecordingAndMerge } from './ffmpeg'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'

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

  globalShortcut.register('CommandOrControl+Shift+S', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  

  console.log("CommandOrControl+Shift+S hotkey pressed");

  try {
    // const filePath = await stopRecordingAndMerge();
    if (pythonProcess) {
    pythonProcess.kill("SIGINT");  // triggers save clicks.json
    pythonProcess = null;
  }
    const filePath = await stopRecording();
    console.log("Recording saved to:", filePath);

    mainWindow.show();
    mainWindow.setSkipTaskbar(false);
    mainWindow.focus();

    // Notify renderer (optional)
    mainWindow.webContents.send('recording:stopped', filePath);

    // Open trim window
    openTrimWindow(mainWindow, filePath);
  } catch (err) {
    console.error("Failed to stop recording:", err);
  }
});


  
  // e.g. handling 'save-segment' could be here or in ipc.ts — keep where it makes sense
// ipcMain.handle('save-segment', async (_, buffers: { video: Uint8Array, audio: Uint8Array }, suggestedName?: string) => {
//   const filePath = await saveSegmentFile(buffers, suggestedName);
//   console.log("save-segment handled", filePath);

//   // open trim window after saving
//   if (mainWindow) openTrimWindow(mainWindow, filePath);

//   return filePath;
// });
let pythonProcess: ChildProcessWithoutNullStreams | null = null;
ipcMain.handle('recording:started', async () => {
    await startRecording()
    hideWindowCompletely()

    const scriptPath = is.dev
  ? join(__dirname, "../../resources/python/mouse_tracker.py") // dev mode
  : join(process.resourcesPath, "mouse_tracker.py");           // packaged app
    console.log("Launching mouse tracker:", scriptPath);

    pythonProcess = spawn("python", ["-u", scriptPath]);

    pythonProcess.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      console.log("PYTHON DATA:", msg);
      if (msg.startsWith("CLICK")) {
        try {
          const json = JSON.parse(msg.replace("CLICK ", ""));
          if (mainWindow) mainWindow.webContents.send("mouse-click-event", json);
        } catch (err) {
          console.error("Failed to parse click JSON:", err, msg);
        }
      }
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start Python:", err);
    });

    pythonProcess.on("exit", (code, signal) => {
      console.log("Python exited", { code, signal });
    });

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
