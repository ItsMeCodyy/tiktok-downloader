# cheetah.

A minimal black-and-white TikTok video downloader.

## How it works

1. Read embedded public TikTok video page JSON without a third-party downloader API or login. The server forwards the anonymous tt_chain_token cookie issued by TikTok's public page when requesting the MP4; no visitor account cookies are needed.
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

## MP3 and quality choices

The result card offers MP4 or MP3. MP4 shows only the real qualities advertised in the public TikTok page (`bitrateInfo`); watermark downloads generally have one original version. MP3 is converted from the available TikTok video by FFmpeg running inside the Vercel Node function, with output bitrates of 128, 192, and 256 kbps. Higher output bitrates do not restore quality missing from the source.

The `ffmpeg-static` binary is included in the Vercel function bundle and has its own GPL licensing requirements. MP3 conversion takes CPU time and may fail on longer clips if the hosting function reaches its limits.
