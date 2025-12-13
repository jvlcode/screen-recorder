import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import ffmpegPath from "ffmpeg-static";

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
    rippleDurationMs = RIPPLE_DURATION_MS
) {
    if (segmentClicks.length === 0)
        return { filter: "", finalLabel: "[0:v]" };

    let filter = "";
    let last = "[0:v]";

    segmentClicks.forEach((click, i) => {
        const tStart = (click.timeMs / 1000).toFixed(3);
        const tEnd = ((click.timeMs + rippleDurationMs) / 1000).toFixed(3);

        const ripple = `[r${i}]`;
        const out = `[v${i}]`;

        filter += `[1:v]scale=50:50,format=rgba${ripple};`;
        filter += `${last}${ripple}overlay=` +
            `x=${click.x}-25:y=${click.y}-25:` +
            `enable='between(t,${tStart},${tEnd})'${out};`;

        last = out;
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
        const ripplePath = path.join(
            process.cwd(),
            "resources",
            "circle.png"
        );

        if (!fs.existsSync(ripplePath))
            throw new Error("Ripple image missing");

        args.push("-i", ripplePath);

        const { filter, finalLabel } =
            buildRippleFilterComplex(segmentClicks);

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

        const proc = spawn(ffmpegPath, [...args, output], {
            stdio: "inherit"
        });

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
