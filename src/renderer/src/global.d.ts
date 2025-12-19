export {};

declare global {
  interface Window {
    api: {
      /* ===============================
         Generic IPC helpers
      =============================== */
      invoke: <T = any>(channel: string, data?: any) => Promise<T>;
      send: (channel: string, data?: any) => void;
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (
        channel: string,
        listener: (...args: any[]) => void
      ) => void;

      /* ===============================
         Screen capture
      =============================== */
      getSources: (
        opts: Electron.SourcesOptions
      ) => Promise<Electron.DesktopCapturerSource[]>;

      /* ===============================
         Cursor click effect (NEW)
      =============================== */
      sendClick: (x: number, y: number) => void;
      onCursorClick: (
        callback: (
          event: Electron.IpcRendererEvent,
          pos: { x: number; y: number }
        ) => void
      ) => void;

      /* ===============================
         Drawing & overlay APIs
      =============================== */
      onDrawingToggle: (callback: (...args: any[]) => void) => void;
      onToolSet: (callback: (...args: any[]) => void) => void;
      onDrawingClear: (callback: (...args: any[]) => void) => void;
      onDrawingUndo: (callback: (...args: any[]) => void) => void;
      onCombo: (callback: (...args: any[]) => void) => void;
      sendMouse: (enabled: boolean) => void;
    };

    electron: {
      ipcRenderer: Electron.IpcRenderer;
    };
  }
}
