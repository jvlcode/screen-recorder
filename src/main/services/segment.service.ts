import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegPath from "ffmpeg-static";
import { ffmpegService } from "./ffmpeg.service";

export interface Click {
    x: number;
    y: number;
    timeMs: number;
}

/* ---------------- META ---------------- */

function loadMeta(filePath: string) {
    const metaFile = filePath.replace(".mp4", ".json");
    if (!fs.existsSync(metaFile)) throw new Error("Meta file missing");

    const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
    if (!meta.startEpochMs)
        throw new Error("Invalid meta.json");

    return { meta, metaFile };
}



/* ---------------- PATHS ---------------- */

function prepareTempPath(filePath: string) {
    return path.join(
        path.dirname(filePath),
        path.basename(filePath, path.extname(filePath)) + ".trimmed.mp4"
    );
}


/* ---------------- ARGS ---------------- */

function buildFFmpegArgs(
    localPath: string,
    startSec: number,
    endSec: number,
) {
    const args: string[] = [
        "-ss", `${startSec}`,
        "-to", `${endSec}`,
        "-i", localPath
    ];

    

    args.push(
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "14",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy"
    );

    return args;
}


/* ---------------- EXEC ---------------- */

function executeFFmpeg(args: string[], output: string) {
    return new Promise<void>((resolve, reject) => {
        if (!ffmpegPath) throw new Error("ffmpeg binary not found");

        const proc = ffmpegService.spawn([...args, output]);

        proc.on("error", reject);
        proc.on("close", code =>
            code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
        );
    });
}

/* ---------------- META UPDATE ---------------- */

function updateMeta(
    metaFile: string,
    meta: any,
    startSec: number
) {
    const startMs = startSec * 1000;

    fs.writeFileSync(
        metaFile,
        JSON.stringify(
            {
                ...meta,
                startEpochMs: meta.startEpochMs + startMs,
            },
            null,
            2
        )
    );
}

/* ---------------- PUBLIC API ---------------- */

export async function trimSegmentFile(
    filePath: string,
    startSec: number,
    endSec: number
) {
    const localPath = filePath.startsWith("file://")
        ? fileURLToPath(filePath)
        : filePath;

    const { meta, metaFile } = loadMeta(localPath);
    const tempPath = prepareTempPath(localPath);

    const args = buildFFmpegArgs(
        localPath,
        startSec,
        endSec,
    );

    await executeFFmpeg(args, tempPath);

    fs.unlinkSync(localPath);
    fs.renameSync(tempPath, localPath);

    updateMeta(metaFile, meta, startSec);

    return localPath;
}

/* ---------------- DISCARD SERVICE ---------------- */

export async function discardSegmentFile(filePath: string) {
    const localPath = filePath.startsWith("file://")
        ? fileURLToPath(filePath)
        : filePath;

    const metaFile = localPath.replace(".mp4", ".json");

    if (!fs.existsSync(localPath)) {
        throw new Error("Video file not found");
    }

    fs.unlinkSync(localPath);

    if (fs.existsSync(metaFile)) {
        fs.unlinkSync(metaFile);
    }

    return {
        discarded: true,
        file: localPath
    };
}


