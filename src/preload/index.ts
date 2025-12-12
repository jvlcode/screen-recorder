import { contextBridge,  ipcRenderer } from 'electron'

const api = {
  getSources: (opts) => ipcRenderer.invoke('get-sources', opts),
  // IPC wrapper
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
  on: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.on(channel, (event, ...args) => listener(...args)),
  removeListener: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, listener),
  sendClick: (x: number, y: number) => ipcRenderer.send('cursor-click', { x, y }),
}

// Expose to renderer
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)             // your custom API
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
