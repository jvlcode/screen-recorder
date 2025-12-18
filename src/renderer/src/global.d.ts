export {}

declare global {
  interface Window {
    api: {
      sendClick: (x: number, y: number) => void
      invoke: <T = any>(channel: string, data?: any) => Promise<T>
      getSources: (opts: Electron.SourcesOptions) => Promise<Electron.DesktopCapturerSource[]>
      send: (channel: string, data?: any) => void
      on: (channel: string, listener: (...args: any[]) => void) => void
      removeListener: (channel: string, listener: (...args: any[]) => void) => void

      // Drawing & overlay APIs
      onDrawingToggle: (callback: (...args: any[]) => void) => void
      onToolSet: (callback: (...args: any[]) => void) => void
      onDrawingClear: (callback: (...args: any[]) => void) => void
      onDrawingUndo: (callback: (...args: any[]) => void) => void
      onCombo: (callback: (...args: any[]) => void) => void
      sendMouse: (enabled: boolean) => void
    }

    electron: {
      ipcRenderer: Electron.IpcRenderer
    }
  }
}
