import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegPath from "ffmpeg-static";
import { ffmpegService } from "./ffmpeg.service";
import { app } from "electron";

export interface Click {
    x: number;
    y: number;
    timeMs: number;
}

const RIPPLE_DURATION_MS = 500;

/* ---------------- META ---------------- */

function loadMeta(filePath: string) {
    const metaFile = filePath.replace(".mp4", ".json");
    if (!fs.existsSync(metaFile)) throw new Error("Meta file missing");

    const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
    if (!meta.startEpochMs || !meta.clicks)
        throw new Error("Invalid meta.json");

    return { meta, metaFile };
}

function getSegmentClicks(meta: any, startSec: number, endSec: number) {
    const recordingStartEpoch = meta.startEpochMs;
    const startMs = startSec * 1000;
    const endMs = endSec * 1000;
    console.log("getSegmentClicks",recordingStartEpoch, startSec, endMs);

    return meta.clicks
        .map((c: any) => ({ ...c, timeMs: c.timeMs ?? c.timeMs - recordingStartEpoch }))
        .filter((c: any) => c.timeMs >= startMs && c.timeMs <= endMs)
        .map((c: any) => ({ ...c, timeMs: c.timeMs - startMs }));
}

/* ---------------- PATHS ---------------- */

function prepareTempPath(filePath: string) {
    return path.join(
        path.dirname(filePath),
        path.basename(filePath, path.extname(filePath)) + ".trimmed.mp4"
    );
}

/* ---------------- FILTER GRAPH ---------------- */
function buildRippleFilterComplex(
    segmentClicks: Click[],
    rippleDurationMs = RIPPLE_DURATION_MS,
    trimStartMs = 0   // pass in startSec*1000 or 150 if trim=start=0.15
) {
    if (segmentClicks.length === 0) {
        return { filter: "", finalLabel: "[0:v]" };
    }

    let filter = "";
    filter += `[0:v]setpts=PTS-STARTPTS[v0];`;
    let last = "[v0]";

    // Split the ripple image once
    filter += `[1:v]split=${segmentClicks.length}`;
    segmentClicks.forEach((_, i) => {
        filter += `[r${i}]`;
    });
    filter += `;`;

    segmentClicks.forEach((click, i) => {
        // Adjust click time relative to trimmed segment
        const adjustedMs = click.timeMs - trimStartMs;
        if (adjustedMs < 0) return;

        const tStart = (adjustedMs / 1000).toFixed(3);
        const tEnd = ((adjustedMs + rippleDurationMs) / 1000).toFixed(3);

        filter += `[r${i}]scale=50:50,format=rgba[r${i}f];`;
        filter += `${last}[r${i}f]overlay=` +
            `x=${click.x}-25:y=${click.y}-25:` +
            `enable='between(t,${tStart},${tEnd})'[v${i + 1}];`;

        last = `[v${i + 1}]`;
    });

    return { filter, finalLabel: last };
}

/* ---------------- ARGS ---------------- */

function buildFFmpegArgs(
    localPath: string,
    startSec: number,
    endSec: number,
    segmentClicks: Click[]
) {
    const args: string[] = [
        "-ss", `${startSec}`,
        "-to", `${endSec}`,
        "-i", localPath
    ];

    if (segmentClicks.length > 0) {
        
        const ripplePath =  app.isPackaged ? path.join(process.resourcesPath, "circle.png")
      : path.join(process.cwd(), "resources", "circle.png");
      
        if (!fs.existsSync(ripplePath)) throw new Error("Ripple image missing");
        args.push("-i", ripplePath);

        // Convert trim start to milliseconds
        // const trimStartMs = 0; // = 150


        const { filter, finalLabel } =
            buildRippleFilterComplex(segmentClicks, RIPPLE_DURATION_MS);

        args.push(
            "-filter_complex", filter,
            "-map", finalLabel,
            "-map", "0:a?"
        );
    }

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
    segmentClicks: Click[],
    startSec: number
) {
    const startMs = startSec * 1000;

    fs.writeFileSync(
        metaFile,
        JSON.stringify(
            {
                ...meta,
                startEpochMs: meta.startEpochMs + startMs,
                clicks: segmentClicks
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
    const segmentClicks = getSegmentClicks(meta, startSec, endSec);
    const tempPath = prepareTempPath(localPath);
    console.log("segmentClicks",segmentClicks, meta, localPath);

    const args = buildFFmpegArgs(
        localPath,
        startSec,
        endSec,
        segmentClicks
    );

    await executeFFmpeg(args, tempPath);

    fs.unlinkSync(localPath);
    fs.renameSync(tempPath, localPath);

    updateMeta(metaFile, meta, segmentClicks, startSec);

    return localPath;
}
