# cheetah.

A minimal black-and-white YouTube video saver.

## Vercel

Connected to Vercel with a Python serverless function (`api/index.py`) and a static frontend (`public/`). Python dependencies install from `requirements.txt`.

The API extracts available combined MP4 formats using `yt-dlp` and redirects to freshly resolved media URLs. It does not proxy or store video files.

**Important:** YouTube may block requests from datacenter IPs or require additional verification. A successful Vercel deployment does not guarantee extraction works for every video. Direct playback links expire, and browsers may not always offer Save Video As. For reliable production use, consider an independently hosted extraction backend and monitoring. Only download videos you own or have permission to save.

## Local development

```bash
python3 -m pip install -r requirements.txt
npm install
npm run dev
```

Local Express backend remains available in `server/index.js`. Vercel uses `api/index.py` instead.
