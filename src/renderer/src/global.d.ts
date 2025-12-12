export { }

declare global {
  interface Window {
    api: {
      sendClick: (x:any, y: any) => void
      // IPC invoke
      invoke: <T = any>(channel: string, data?: any) => Promise<T>

      // Desktop capture (from preload)
      getSources: (opts: Electron.SourcesOptions) => Promise<Electron.DesktopCapturerSource[]>

      // One-way send
      send: (channel: string, data?: any) => void

      // Add listener
      on: (channel: string, listener: (...args: any[]) => void) => void

      // Remove listener
      removeListener: (channel: string, listener: (...args: any[]) => void) => void
    }

    electron: {
      ipcRenderer: Electron.IpcRenderer
    }
  }
}
