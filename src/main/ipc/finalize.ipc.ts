import { ipcMain } from "electron";
import { concatSegments } from "../services/finalize.service";
import { hideTrimWindow } from "../windows/trim.windows";
import { log } from "..";


  export function registerFinalizeIpc() {
  ipcMain.handle("finalize", async () => {
    hideTrimWindow();
    try {
      const result = await concatSegments();
      console.log("[finalize] Compilation created:", result);
      return result;
    } catch (err) {
      if (err instanceof Error) {
        log("[finalize] concatSegments failed:", err.message);
        console.error(err.stack);
      } else {
        log("[finalize] concatSegments failed:", err);
      }
      // propagate the error back to the renderer
      throw err;
    }
  }); 
}
