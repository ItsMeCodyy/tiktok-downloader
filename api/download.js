import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import { getPost, openMedia, resolveSource, TikTokError } from "../lib/tiktok.js";

const AUDIO_BITRATES = new Set(["128", "192", "256"]);

async function streamMp3(upstream, res, bitrate, abort) {
  if (!ffmpegPath) throw new TikTokError("Audio conversion isn't available on this server.");

  const ffmpeg = spawn(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-threads", "2",
    "-i", "pipe:0",
    "-map", "0:a:0", "-vn",
    "-codec:a", "libmp3lame",
    "-b:a", bitrate + "k",
    "-id3v2_version", "3",
    "-f", "mp3", "pipe:1"
  ], { stdio: ["pipe", "pipe", "pipe"] });

  let stderr = "";
  ffmpeg.stderr.on("data", chunk => {
    stderr = (stderr + String(chunk)).slice(-2500);
  });

  const stopped = () => ffmpeg.kill("SIGTERM");
  abort.signal.addEventListener("abort", stopped, { once: true });

  const completed = new Promise((resolve, reject) => {
    ffmpeg.once("error", reject);
    ffmpeg.once("close", code => {
      if (code === 0) resolve();
      else reject(new Error("FFmpeg exited with status " + code + ": " + stderr));
    });
  });

  try {
    await Promise.all([
      pipeline(Readable.fromWeb(upstream.body), ffmpeg.stdin),
      pipeline(ffmpeg.stdout, res),
      completed
    ]);
  } catch (error) {
    stopped();
    throw error;
  } finally {
    abort.signal.removeEventListener("abort", stopped);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");

  const mode = req.query.mode;
  const format = req.query.format || "mp4";
  const quality = req.query.quality || "best";
  if (!["clean", "watermarked"].includes(mode)) {
    return res.status(400).json({ error: "Invalid watermark setting." });
  }
  if (!["mp3", "mp4"].includes(format)) {
    return res.status(400).json({ error: "Choose MP3 or MP4." });
  }
  if (format === "mp3" && !AUDIO_BITRATES.has(String(quality))) {
    return res.status(400).json({ error: "Choose 128, 192, or 256 kbps." });
  }

  const abort = new AbortController();
  let conversion;
  req.on("aborted", () => abort.abort());
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    const post = await getPost(req.query.url || "");
    const source = format === "mp3"
      ? (post.sources.cleanOptions[0]?.url || post.sources.watermarkedOptions[0]?.url)
      : resolveSource(post, mode, quality);

    if (!source) {
      return res.status(404).json({ error: "No downloadable file was available." });
    }

    const upstream = await openMedia(source, abort.signal, post.cookie);
    if (!upstream.body) throw new TikTokError("The video stream was empty.");

    const filename = "cheetah-" + post.id + (format === "mp4"
      ? "-" + (mode === "clean" ? "no-watermark" : "with-watermark")
      : "") + "." + format;

    res.setHeader("Content-Type", format === "mp3" ? "audio/mpeg" : "video/mp4");
    res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '"');
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (format === "mp3") {
      await streamMp3(upstream, res, String(quality), abort);
    } else {
      await pipeline(Readable.fromWeb(upstream.body), res);
    }
  } catch (error) {
    if (res.headersSent || res.writableEnded) {
      console.error("Download interrupted:", error.message);
      res.destroy(error);
      return;
    }

    res.status(error instanceof TikTokError ? error.status : 502).json({
      error: error instanceof TikTokError
        ? error.message
        : "Couldn't convert or download this TikTok right now."
    });
  }
}
