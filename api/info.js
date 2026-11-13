import { getPost, TikTokError } from "../lib/tiktok.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");

  try {
    const post = await getPost(req.query.url || "");
    res.setHeader("Cache-Control", "no-store");
    res.json({
      id: post.id,
      title: post.title,
      uploader: post.uploader,
      duration: post.duration,
      thumbnail: post.thumbnail,
      available: {
        clean: post.sources.cleanOptions.length > 0,
        watermarked: post.sources.watermarkedOptions.length > 0
      },
      qualities: {
        clean: post.sources.cleanOptions.map(({ id, label }) => ({ id, label })),
        watermarked: post.sources.watermarkedOptions.map(({ id, label }) => ({ id, label }))
      }
    });
  } catch (error) {
    res.status(error instanceof TikTokError ? error.status : 502).json({
      error: error instanceof TikTokError ? error.message : "Couldn't load this TikTok right now."
    });
  }
}
