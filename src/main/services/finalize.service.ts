import path from "path";
import fs from "fs";
import { segmentsDir } from "../utils/segments";
import { ffmpegService } from "./ffmpeg.service";



const compilationsDir = path.join(process.cwd(), 'compilations')

// Ensure compilations directory exists
function ensureCompilationDir() {
    if (!fs.existsSync(compilationsDir)) {
        fs.mkdirSync(compilationsDir, { recursive: true })
    }
}

// Get next compilation number
async function getNextCompilationFile(): Promise<string> {
    ensureCompilationDir()

    const files = await fs.promises.readdir(compilationsDir)

    const nums = files
        .map(f => {
            const match = f.match(/compilation_(\d+)\.mp4/)
            return match ? parseInt(match[1], 10) : null
        })
        .filter(n => n !== null) as number[]

    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1

    return path.join(compilationsDir, `compilation_${next}.mp4`)
}


export async function concatSegments(): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            // Collect all mp4 segments
            let files = (await fs.promises.readdir(segmentsDir))
                .filter(f => f.endsWith(".mp4"))
                .map(f => path.join(segmentsDir, f))
                .filter(f => fs.existsSync(f))
                .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

            if (files.length === 0) {
                return reject(new Error("No segments found"));
            }

            // Pre-process each segment: trim first/last 0.15s
            const cleanedFiles: string[] = [];
            for (const f of files) {
                const cleaned = path.join(segmentsDir, "cleaned_" + path.basename(f));

                // Use ffprobe to get duration
                const duration = await ffmpegService.probeDuration(f);
                const endSec = duration - 0.15;

                const args = [
                    "-y",
                    "-ss", "0.15",          // skip first 0.15s
                    "-to", `${endSec}`,     // stop 0.15s before end
                    "-i", f,
                    "-c", "copy",
                    cleaned
                ];

                await new Promise<void>((res, rej) => {
                    const proc = ffmpegService.spawn(args);
                    proc.on("error", rej);
                    proc.on("close", code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)));
                });

                cleanedFiles.push(cleaned);
            }

            // Build concat filelist from cleaned files
            const listFile = path.join(segmentsDir, "filelist.txt");
            const content = cleanedFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
            await fs.promises.writeFile(listFile, content);

            console.log("Concat filelist:\n", content);

            const outFile = await getNextCompilationFile();
            const outBase = path.basename(outFile, ".mp4");
            const outFolder = path.join(compilationsDir, outBase);

            await fs.promises.mkdir(outFolder, { recursive: true });

            const args = [
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", listFile,
                "-c", "copy",          // ✅ copy both audio and video streams
                "-movflags", "+faststart",
                outFile
            ];

            const proc = ffmpegService.spawn(args);

            let stderr = "";
            proc.stderr.on("data", d => {
                stderr += d.toString();
                console.log("[concat ffmpeg]", d.toString());
            });

            proc.on("error", err => reject(err));

            proc.on("close", async code => {
                if (code === 0) {
                    setTimeout(async () => {
                        try {
                            // Move originals + json files into compilation folder
                            for (const f of files) {
                                const dest = path.join(outFolder, path.basename(f));
                                await fs.promises.rename(f, dest);
                            }
                            await fs.promises.rename(listFile, path.join(outFolder, "filelist.txt"));

                            const jsonFiles = (await fs.promises.readdir(segmentsDir))
                                .filter(f => f.endsWith(".json"))
                                .map(f => path.join(segmentsDir, f));

                            for (const jf of jsonFiles) {
                                const dest = path.join(outFolder, path.basename(jf));
                                await fs.promises.rename(jf, dest);
                            }

                            // Optionally delete cleaned files if you don’t want to keep them
                            for (const cf of cleanedFiles) {
                                try { await fs.promises.unlink(cf); } catch { }
                            }

                            resolve(outFile);
                        } catch (err) {
                            reject(err);
                        }
                    }, 500);
                } else {
                    reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}
