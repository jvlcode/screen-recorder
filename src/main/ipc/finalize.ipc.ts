import { ipcMain } from "electron";
import { concatSegments } from "../services/finalize.service";
import { hideTrimWindow } from "../windows/trim.windows";


export function registerFinalizeIpc() {
  ipcMain.handle("finalize", async () => {
    hideTrimWindow();
    return await concatSegments();
  });
}
