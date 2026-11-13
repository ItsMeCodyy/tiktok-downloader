# cheetah.

A minimal black-and-white TikTok video downloader.

## How it works

1. Read embedded public TikTok video page JSON without a third-party downloader API, cookies, or login.
2. Find available versions: playback video (usually without TikTok's overlay) and TikTok download version (usually with watermark).
3. Select the TikTok watermark switch if both are available.
4. Stream the selected MP4 from a Node.js Vercel function as an attachment, with a filename. The browser downloads the file without opening the TikTok media URL.

## Structure

- public/: website and interface
- lib/tiktok.js: TikTok page parsing and media-domain validation
- api/info.js: video metadata and available variants
- api/download.js: streamed MP4 attachment

## Notes

TikTok may restrict datacenter requests or change its page data. No-watermark playback is not guaranteed for every video and creator-added overlays remain. Some posts offer only one downloadable version. Serverless bandwidth and duration limits apply. Only save videos you have permission to download.
