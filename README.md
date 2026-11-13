# cheetah.

Minimal black-and-white TikTok video saver.

## How it works

The Vercel Python function requests the **public TikTok video page** and reads its embedded `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON, the same page-data structure present in the supplied TikTok website archive. It searches for the matching post ID and extracts the page's `downloadAddr` or `playAddr`. No third-party downloader API, TikTok developer API, cookies, or login credentials are used.

Supported links: `https://www.tiktok.com/@username/video/1234567890123456789`.

Limitations: TikTok may block Vercel datacenter traffic or omit data for certain posts. The media link can expire, and it may contain a watermark. This implementation does not bypass login, DRM, or download restrictions. Save only content you own or have permission to download.

The old YouTube backend in `server/` is retained for reference but is not used by Vercel.
