# cheetah

A minimal black-and-white video downloader interface, with a little cheetah.

## run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Requires **Python 3** for `yt-dlp-exec` and **FFmpeg** for some formats. Video extraction depends on YouTube's current behavior and may stop working if the service changes.

## how it works

Paste a YouTube link to retrieve its title, thumbnail, and available MP4 formats. Select a format to open a freshly resolved direct media URL in a separate tab. From there, your browser may offer *Save Video As*. Direct media URLs are time-limited; the server resolves them when requested rather than saving them permanently.

Only download content you own or have permission to save. Respect copyright and platform terms. This project does not bypass DRM or authenticate to private videos.

## structure

- `public/` — responsive UI, styling, branding
- `server/` — Express API and media URL resolution

## deploy

Use a persistent Node.js host with Python installed and network access to YouTube. Static-only hosting and typical serverless deployments are not sufficient for the default backend. Restrict or rate-limit public usage before deploying for others.
