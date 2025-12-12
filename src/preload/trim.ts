import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('trimAPI', {
  onLoadSegment: (callback: (filePath: string) => void) =>
    ipcRenderer.on('load-segment', (_, filePath) => callback(filePath)),

  trim: (filePath: string, start: number, end: number) =>
    ipcRenderer.invoke('trim-segment', filePath, start, end)
})

