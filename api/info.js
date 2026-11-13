import { getPost,TikTokError } from "../lib/tiktok.js";
export default async function handler(req,res) {
  if (req.method!=="GET") return res.status(405).end("Method not allowed");
  try {
    const post=await getPost(req.query.url || "");
    res.setHeader("Cache-Control","no-store");
    res.json({
      id:post.id,title:post.title,uploader:post.uploader,
      duration:post.duration,thumbnail:post.thumbnail,
      available:{
        clean:Boolean(post.sources.clean),
        watermarked:Boolean(post.sources.watermarked)
      }
    });
  } catch(error) {
    res.status(error instanceof TikTokError ? error.status : 502).json({
      error:error instanceof TikTokError ? error.message : "Couldn't load this TikTok right now."
    });
  }
}
