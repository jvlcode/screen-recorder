import { registerRecordingIpc } from './recording.ipc'
import { registerTrimIpc } from './trim.ipc'
import { registerFinalizeIpc } from './finalize.ipc'
// import { registerOverlayShortcuts } from './combo.ipc'



export function registerIpcHandlers() {
    registerRecordingIpc()
    registerTrimIpc()
    registerFinalizeIpc();
    // registerOverlayShortcuts();
}