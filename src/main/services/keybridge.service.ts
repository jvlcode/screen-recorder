
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { app } from "electron";
import { sendOverlayCombo } from "../windows/overlay.window";

let pyProc: ReturnType<typeof spawn> | null = null;

export function startKeyListener() {
    let script: string;

    if (app.isPackaged) {
        // ✔ Packaged app: resources/
        script = path.join(
            process.resourcesPath,
            "python",
            "key_listener.py"
        );
    } else {
        // ✔ Dev mode: project root /python
        script = path.join(
            app.getAppPath(),
            "resources",
            "python",
            "key_listener.py"
        );
    }

    console.log("Python script path:", script);
    console.log("Script exists:", fs.existsSync(script));

    const pythonExe = "python"; // replace with full path if needed

    pyProc = spawn(pythonExe, [script], {
        windowsHide: false
    });
    if(pyProc.stdout && pyProc.stderr) {
        pyProc.stdout.on("data", (data) => {
            const text = data.toString();
            console.log("PY STDOUT:", text);
    
            try {
                const msg = JSON.parse(text);
                if (msg.type === "keycombo") {
                    sendOverlayCombo(msg.combo);
                }
            } catch {
                // non-JSON logs are OK
            }
        });
    
        pyProc.stderr.on("data", (data) => {
            console.error("PY STDERR:", data.toString());
        });
    }

    pyProc.on("error", (err) => {
        console.error("PY PROCESS ERROR:", err);
    });

    pyProc.on("exit", (code, signal) => {
        console.log("Key listener stopped", { code, signal });
    });
}


export function stopKeyListener() {
    pyProc?.kill();
}
