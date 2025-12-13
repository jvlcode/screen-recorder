import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import ffmpegPath from 'ffmpeg-static'


export interface Click {
    x: number;
    y: number;
    timeMs: number;
}

const RIPPLE_DURATION_MS = 500;

function loadMeta(filePath: string) {
    const metaFile = filePath.replace(".mp4", ".json");
    if (!fs.existsSync(metaFile)) throw new Error("Meta file missing");

    const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
    if (!meta.startEpochMs || !meta.clicks) throw new Error("Invalid meta.json");
    return { meta, metaFile };
}

function getSegmentClicks(meta: any, startSec: number, endSec: number) {
    const recordingStartEpoch = meta.startEpochMs;
    const startMs = startSec * 1000;
    const endMs = endSec * 1000;

    return meta.clicks
        .map((c: any) => ({ ...c, timeMs: c.timeMs ?? c.epochMs - recordingStartEpoch }))
        .filter((c: any) => c.timeMs >= startMs && c.timeMs <= endMs)
        .map((c: any) => ({ ...c, timeMs: c.timeMs - startMs }));
}

function prepareTempPath(filePath: string) {
    return path.join(
        path.dirname(filePath),
        path.basename(filePath, path.extname(filePath)) + ".trimmed.mp4"
    );
}
function buildRippleFilterComplex(segmentClicks: Click[], rippleDurationMs = 500) {
    if (!segmentClicks || segmentClicks.length === 0) return { filter: "", finalLabel: "[0:v]" };

    let filterComplex = "";
    let lastLabel = "[0:v]";

    segmentClicks.forEach((click, idx) => {
        const tStart = (click.timeMs / 1000).toFixed(3);
        const tEnd = ((click.timeMs + rippleDurationMs) / 1000).toFixed(3);

        // unique label for this scaled ripple
        const rippleLabel = `[r${idx}]`;

        // scale + alpha format
        filterComplex += `[1:v]scale=50:50,format=rgba${rippleLabel};`;

        // overlay on the last video output
        const outLabel = `[v${idx}]`;
        filterComplex += `${lastLabel}${rippleLabel}overlay=x=${click.x}-25:y=${click.y}-25:enable='between(t,${tStart},${tEnd})'${outLabel};`;

        lastLabel = outLabel;
    });

    return { filter: filterComplex, finalLabel: lastLabel };
}



function buildFFmpegArgs(
    localPath: string,
    startSec: number,
    endSec: number,
    segmentClicks: Click[]
) {
    const args: string[] = ["-ss", `${startSec}`, "-to", `${endSec}`, "-i", localPath];

    if (segmentClicks.length > 0) {
        const ripplePath = path.join(process.cwd(), "resources", "circle.png");
        if (!fs.existsSync(ripplePath)) throw new Error("Ripple image missing");

        args.push("-i", ripplePath);
        const { filter, finalLabel } = buildRippleFilterComplex(segmentClicks) as { filter: string; finalLabel: string };
        args.push("-filter_complex", filter);
        args.push("-map", finalLabel, "-map", "0:a?");
        args.push(
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "14",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy"
        );
    } else {
        args.push(
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "14",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy" // keep audio untouched if no overlay
        );
    }

    return args;
}

function executeFFmpeg(ffmpegPath: string, args: string[], tempPath: string) {
    return new Promise<void>((resolve, reject) => {
        const proc = spawn(ffmpegPath, [...args, tempPath], { stdio: "inherit" });

        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with ${code}`));
        });
    });
}

function updateMeta(metaFile: string, meta: any, segmentClicks: Click[], startSec: number) {
    const startMs = startSec * 1000;
    const trimmedMeta = {
        ...meta,
        startEpochMs: meta.startEpochMs + startMs,
        clicks: segmentClicks,
    };
    fs.writeFileSync(metaFile, JSON.stringify(trimmedMeta, null, 2));
}

export async function trimSegmentFile(filePath: string, startSec: number, endSec: number) {
    if (!filePath) throw new Error("No file path provided");
    if (!ffmpegPath) throw new Error("ffmpeg binary not found");

    const localPath = filePath.startsWith("file://") ? fileURLToPath(filePath) : filePath;
    const { meta, metaFile } = loadMeta(filePath);
    const segmentClicks = getSegmentClicks(meta, startSec, endSec);
    const tempPath = prepareTempPath(localPath);

    const args = buildFFmpegArgs(localPath, startSec, endSec, segmentClicks);
    await executeFFmpeg(ffmpegPath, args, tempPath);

    fs.unlinkSync(localPath);
    fs.renameSync(tempPath, localPath);
    updateMeta(metaFile, meta, segmentClicks, startSec);
}
