const PAGE_HOSTS = new Set(["www.tiktok.com","tiktok.com","vt.tiktok.com","vm.tiktok.com"]);
const VIDEO_PATH = /^\/@[\w.-]+\/video\/(\d{15,22})\/?$/;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class TikTokError extends Error {
  constructor(message, status=502) { super(message); this.status=status; }
}

export function validatePageUrl(value) {
  let url;
  try { url=new URL(value); } catch { throw new TikTokError("Paste a valid TikTok link.",400); }
  if (url.protocol!=="https:" || !PAGE_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || (url.port && url.port!=="443")) {
    throw new TikTokError("Only HTTPS TikTok video links are supported.",400);
  }
  return url;
}

export function allowedMediaUrl(value) {
  try {
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    const domains=["tiktok.com","tiktokcdn.com","tiktokcdn-us.com","tiktokv.com","byteoversea.com","muscdn.com"];
    return url.protocol==="https:" && !url.username && !url.password &&
      (!url.port || url.port==="443") &&
      domains.some(domain => host===domain || host.endsWith("."+domain));
  } catch { return false; }
}

async function requestRedirects(raw, kind, signal) {
  let url=new URL(raw);
  for (let redirects=0; redirects<6; redirects++) {
    if (kind==="page") validatePageUrl(url.href);
    if (kind==="media" && !allowedMediaUrl(url.href)) throw new TikTokError("Unsupported TikTok media host.");
    const response=await fetch(url.href,{
      redirect:"manual",
      signal,
      headers:kind==="page" ?
        {"user-agent":USER_AGENT,"accept-language":"en-US,en;q=0.9","accept":"text/html,application/xhtml+xml"} :
        {"user-agent":USER_AGENT,"referer":"https://www.tiktok.com/","accept":"video/mp4,video/*,*/*"}
    });
    if (![301,302,303,307,308].includes(response.status)) return {response,finalUrl:url};
    const location=response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new TikTokError("TikTok returned an invalid redirect.");
    url=new URL(location,url);
  }
  throw new TikTokError("Too many TikTok redirects.");
}

async function readPage(response) {
  if (!response.ok) throw new TikTokError(
    [403,429].includes(response.status) ? "TikTok restricted access from this server. Try again later." : "TikTok didn't return the video page."
  );
  const reader=response.body?.getReader();
  if (!reader) throw new TikTokError("The TikTok page was empty.");
  const chunks=[];
  let length=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      length+=value.byteLength;
      if (length>6*1024*1024) throw new TikTokError("TikTok's page was too large.");
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output=new Uint8Array(length);
  let offset=0;
  for (const chunk of chunks) { output.set(chunk,offset); offset+=chunk.byteLength; }
  return new TextDecoder().decode(output);
}

export function extractItem(html,id) {
  const script=html.match(/<script\b[^>]*\bid=(["'])__UNIVERSAL_DATA_FOR_REHYDRATION__\1[^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw new TikTokError("TikTok didn't include public video details in the page.");
  let data;
  try { data=JSON.parse(script[2]).__DEFAULT_SCOPE__ || {}; }
  catch { throw new TikTokError("TikTok returned unexpected video data."); }
  const items=[];
  for (const [key,value] of Object.entries(data)) {
    if (key==="webapp.updated-items" && Array.isArray(value)) items.push(...value);
    if (!value || typeof value!=="object" || Array.isArray(value)) continue;
    if (value.itemInfo?.itemStruct) items.push(value.itemInfo.itemStruct);
    if (value.itemStruct) items.push(value.itemStruct);
  }
  const item=items.find(entry=>String(entry?.id)===id);
  if (!item) throw new TikTokError("Couldn't find this video in TikTok's public page data.");
  return item;
}

export function sourcesFor(item) {
  const video=item.video || {};
  const playbackCandidates=[
    video.playAddr,
    ...(video.bitrateInfo || [])
      .slice()
      .sort((a,b)=>(b?.Bitrate||0)-(a?.Bitrate||0))
      .flatMap(entry=>entry?.PlayAddr?.UrlList || [])
  ];
  return {
    clean:playbackCandidates.find(allowedMediaUrl) || null,
    watermarked:allowedMediaUrl(video.downloadAddr) ? video.downloadAddr : null
  };
}

export async function getPost(rawUrl) {
  const input=validatePageUrl(rawUrl);
  const {response,finalUrl}=await requestRedirects(input.href,"page");
  const match=finalUrl.pathname.match(VIDEO_PATH);
  if (!match) {
    await response.body?.cancel();
    throw new TikTokError("Use a TikTok video link containing @username/video/ID.",400);
  }
  const item=extractItem(await readPage(response),match[1]);
  const sources=sourcesFor(item);
  if (!sources.clean && !sources.watermarked) throw new TikTokError("No downloadable MP4 was found.");
  return {
    id:match[1],
    title:item.desc || "TikTok video",
    uploader:item.author?.uniqueId || "TikTok",
    duration:item.video?.duration || 0,
    thumbnail:item.video?.cover || item.video?.originCover || "",
    sources
  };
}

export async function openMedia(url,signal) {
  const {response}=await requestRedirects(url,"media",signal);
  if (!response.ok) {
    console.warn("TikTok media HTTP status:", response.status, "content type:", response.headers.get("content-type"));
    await response.body?.cancel();
    throw new TikTokError("TikTok wouldn't serve this video. Please try again.");
  }
  const type=(response.headers.get("content-type") || "").toLowerCase();
  if (type && !type.startsWith("video/") && !type.startsWith("application/octet-stream")) {
    await response.body?.cancel();
    throw new TikTokError("TikTok returned something other than an MP4.");
  }
  return response;
}
