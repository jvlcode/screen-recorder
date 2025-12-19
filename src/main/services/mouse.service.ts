import { spawn } from "child_process";
import path from "path";
import { getOverlayWindow } from "../windows/overlay.window";
import { app } from "electron";
import { log } from "..";

let mouseTrackerProcess: ReturnType<typeof spawn> | null = null;

export function startMouseTracker() {
    if (mouseTrackerProcess) return; // already running

    let scriptPath: string;

    if (app.isPackaged) {
        scriptPath = path.join(process.resourcesPath, 'python', 'mouse_tracker.py');
    } else {
        scriptPath = path.join(process.cwd(), 'resources', 'python', 'mouse_tracker.py');
    }

    
    
    mouseTrackerProcess = spawn('python', [scriptPath]);

    if (mouseTrackerProcess.stdout && mouseTrackerProcess.stderr) {
        // Handle Python stdout
        mouseTrackerProcess.stdout.on('data', (data) => {
                
            try {
                const str = data.toString().trim();
                if (!str) return;

                const json = JSON.parse(str);



                /**
                 * Expected shape:
                 * { x: number, y: number, button?: string, timeMs?: number }
                 */
                // Forward to overlay renderer via IPC
                const overlay = getOverlayWindow();
                if (overlay) {
                    log('Mouse data:', json)
                    overlay.webContents.send('cursor:click', json);
                }

            } catch (e) {
                console.error('Mouse Tracker parse error:', e);
            }
        });

        mouseTrackerProcess.stderr.on('data', (data) => {
            log('Mouse Tracker error:', data.toString())
            console.error('Mouse Tracker error:', data.toString());
        });
    }

    mouseTrackerProcess.on('close', (code) => {
        console.log('Mouse Tracker exited with code', code);
        mouseTrackerProcess = null;
    });
}

export function stopMouseListener() {
    mouseTrackerProcess?.kill();
}