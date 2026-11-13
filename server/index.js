import express from "express";
import youtubedl from "yt-dlp-exec";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pattern = /^[\w-]{11}$/;

app.disable("x-powered-by");
app.use(express.static(path.join(root, "public")));

function videoId(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    let id = null;

    if (host === "youtu.be") id = url.pathname.split("/")[1];
    if (["youtube.com", "youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (/^\/(shorts|live|embed)\//.test(url.pathname)) id = url.pathname.split("/")[2];
    }
    return id && pattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function extract(id) {
  return youtubedl(`https://www.youtube.com/watch?v=${id}`, {
    dumpSingleJson: true,
    noPlaylist: true,
    noWarnings: true,
    skipDownload: true,
    socketTimeout: 15,
    extractorArgs: "youtube:player_client=android,web"
  });
}

function formatsOf(data) {
  const formats = (data.formats || [])
    .filter(f => f.url && f.ext === "mp4" && f.vcodec !== "none" && f.acodec !== "none")
    .map(f => ({
      id: f.format_id,
      height: f.height || 0,
      label: f.height ? `${f.height}p` : "MP4",
      size: f.filesize || f.filesize_approx || null
    }))
    .sort((a,b) => b.height - a.height || (b.size || 0) - (a.size || 0));
  const seen = new Set();
  return formats.filter(f => !seen.has(f.label) && seen.add(f.label));
}

app.get("/api/info", async (req, res) => {
  const id = videoId(req.query.url || "");
  if (!id) return res.status(400).json({error:"Paste a valid YouTube video link."});
  try {
    const video = await extract(id);
    const formats = formatsOf(video);
    res.set("Cache-Control", "no-store");
    res.json({
      id, title: video.title || "Untitled video",
      uploader: video.uploader || "YouTube",
      duration: video.duration || 0,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      formats
    });
  } catch {
    res.status(502).json({error:"Couldn't load that video. Try another public link."});
  }
});

app.get("/api/open", async (req, res) => {
  const id = typeof req.query.id === "string" && pattern.test(req.query.id) ? req.query.id : null;
  const formatId = typeof req.query.format === "string" && /^[\w-]{1,24}$/.test(req.query.format) ? req.query.format : null;
  if (!id || !formatId) return res.status(400).send("Invalid video or format.");
  try {
    const video = await extract(id);
    const format = (video.formats || []).find(f =>
      f.format_id === formatId && f.url &&
      f.ext === "mp4" && f.vcodec !== "none" && f.acodec !== "none"
    );
    if (!format) return res.status(404).send("This format is no longer available. Refresh the video.");
    const dest = new URL(format.url);
    if (dest.protocol !== "https:" || !/(^|\.)googlevideo\.com$/.test(dest.hostname)) {
      return res.status(502).send("Unsupported media host.");
    }
    res.set("Cache-Control", "no-store");
    return res.redirect(302, dest.href);
  } catch {
    return res.status(502).send("Couldn't open the video. Refresh and try again.");
  }
});

app.listen(PORT, () => console.log(`cheetah running at http://localhost:${PORT}`));
