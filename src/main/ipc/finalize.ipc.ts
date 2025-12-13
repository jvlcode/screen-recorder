import { ipcMain } from "electron";
import { concatSegments } from "../services/finalize.service";


export function registerFinalizeIpc() {
  ipcMain.handle("finalize", async () => {
    return await concatSegments();
  });
}
