import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
import {getPost,openMedia,TikTokError} from "../lib/tiktok.js";

export default async function handler(req,res) {
  if (req.method!=="GET") return res.status(405).end("Method not allowed");
  const mode=req.query.mode;
  if (!["clean","watermarked"].includes(mode)) return res.status(400).json({error:"Invalid watermark setting."});
  const abort=new AbortController();
  res.on("close",()=>abort.abort());
  try {
    const post=await getPost(req.query.url || "");
    const source=post.sources[mode];
    if (!source) return res.status(404).json({error:"This video doesn't offer that version."});
    const upstream=await openMedia(source,abort.signal,post.cookie);
    if (!upstream.body) throw new TikTokError("The video stream was empty.");
    const filename="cheetah-"+post.id+"-"+(mode==="clean"?"no-watermark":"with-watermark")+".mp4";
    res.setHeader("Content-Type","video/mp4");
    res.setHeader("Content-Disposition",'attachment; filename="'+filename+'"');
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    await pipeline(Readable.fromWeb(upstream.body),res);
  } catch(error) {
    if (res.headersSent || res.writableEnded) { res.destroy(error); return; }
    res.status(error instanceof TikTokError ? error.status : 502).json({
      error:error instanceof TikTokError ? error.message : "Couldn't stream this TikTok right now."
    });
  }
}
