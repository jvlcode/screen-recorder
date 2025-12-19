import { registerRecordingIpc } from './recording.ipc'
import { registerTrimIpc } from './trim.ipc'
import { registerFinalizeIpc } from './finalize.ipc'
import { registerGlobalShortcuts } from './drawing.ipc'
import { registerCursorIPC } from './click.ipc'
// import { registerOverlayShortcuts } from './combo.ipc'



export function registerIpcHandlers() {
    registerRecordingIpc()
    registerTrimIpc()
    registerFinalizeIpc();
    registerGlobalShortcuts();
    registerCursorIPC();
    // registerOverlayShortcuts();
}