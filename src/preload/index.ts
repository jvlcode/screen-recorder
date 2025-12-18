import { contextBridge, ipcRenderer, } from 'electron'
import { electronAPI } from '@electron-toolkit/preload';

const api = {
  getSources: (opts) => ipcRenderer.invoke('get-sources', opts),
  // IPC wrapper
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
  on: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.on(channel, (_event, ...args) => listener(...args)),
  removeListener: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, listener),
  sendClick: (x: number, y: number) => ipcRenderer.send('cursor-click', { x, y }),

  onDrawingToggle: (callback) => {
    ipcRenderer.removeAllListeners("drawing:toggle")
    ipcRenderer.on("drawing:toggle", callback)
  },
  onToolSet: (callback) => {
    ipcRenderer.removeAllListeners("tool:set")
    ipcRenderer.on("tool:set", callback)
  },
  onDrawingClear: (callback) => {
    ipcRenderer.removeAllListeners("drawing:clear")
    ipcRenderer.on("drawing:clear", callback)
  },
  onDrawingUndo: (callback) => {
    ipcRenderer.removeAllListeners("drawing:undo")
    ipcRenderer.on("drawing:undo", callback)
  },
  onCombo: (callback) => {
    ipcRenderer.removeAllListeners("overlay:combo")
    ipcRenderer.on("overlay:combo", callback)
  },
  sendMouse: (enabled) => ipcRenderer.send("overlay:set-mouse", enabled),
};

// Expose to renderer
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
  // your custom API
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
