import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  /* ===============================
     Screen capture
  =============================== */
  getSources: (opts: Electron.SourcesOptions) =>
    ipcRenderer.invoke('get-sources', opts),

  /* ===============================
     Generic IPC wrapper
  =============================== */
  invoke: (channel: string, data?: any) =>
    ipcRenderer.invoke(channel, data),

  send: (channel: string, data?: any) =>
    ipcRenderer.send(channel, data),

  on: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.on(channel, (_event, ...args) => listener(...args)),

  removeListener: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, listener),

  /* ===============================
     Cursor click effect (NEW)
  =============================== */
  sendClick: (x: number, y: number) =>
    ipcRenderer.send('cursor:click', { x, y }),

  onCursorClick: (
    callback: (
      event: Electron.IpcRendererEvent,
      pos: { x: number; y: number }
    ) => void
  ) => {
    console.log("[preload] onCursorClick registered");
    ipcRenderer.removeAllListeners('cursor:click')
    ipcRenderer.on('cursor:click', callback)
  },

  /* ===============================
     Drawing & overlay APIs
  =============================== */
  onDrawingToggle: (callback: (...args: any[]) => void) => {
    // ipcRenderer.removeAllListeners('drawing:toggle')
    ipcRenderer.on('drawing:toggle', callback)
  },

  onToolSet: (callback: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners('tool:set')
    ipcRenderer.on('tool:set', callback)
  },

  onDrawingClear: (callback: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners('drawing:clear')
    ipcRenderer.on('drawing:clear', callback)
  },

  onDrawingUndo: (callback: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners('drawing:undo')
    ipcRenderer.on('drawing:undo', callback)
  },

  onCombo: (callback: (...args: any[]) => void) => {
    ipcRenderer.removeAllListeners('overlay:combo')
    ipcRenderer.on('overlay:combo', callback)
  },

  sendMouse: (enabled: boolean) =>
    ipcRenderer.send('overlay:set-mouse', enabled),
}

/* ===============================
   Expose to renderer
================================ */
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
