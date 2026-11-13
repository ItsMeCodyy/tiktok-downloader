import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import yt_dlp

ID = re.compile(r"^[a-zA-Z0-9_-]{11}$")
FORMAT = re.compile(r"^[a-zA-Z0-9_-]{1,32}$")

def parse_id(raw):
    try:
        url = urlparse(raw)
        host = (url.hostname or "").lower()
        if host.startswith("www.") or host.startswith("m."):
            host = host.split(".", 1)[1]
        if host == "youtu.be":
            value = url.path.strip("/").split("/")[0]
        elif host in ("youtube.com", "youtube-nocookie.com"):
            parts = url.path.strip("/").split("/")
            value = parse_qs(url.query).get("v", [""])[0] if url.path == "/watch" else (parts[1] if len(parts) > 1 and parts[0] in ("shorts", "live", "embed") else "")
        else:
            return None
        return value if ID.fullmatch(value) else None
    except Exception:
        return None

def extract(video_id):
    with yt_dlp.YoutubeDL({
        "quiet": True, "no_warnings": True, "noplaylist": True,
        "skip_download": True, "socket_timeout": 14,
        "extractor_args": {"youtube": {"player_client": ["android", "web"]}}
    }) as ydl:
        return ydl.extract_info("https://www.youtube.com/watch?v=" + video_id, download=False)

def formats_of(video):
    results = []
    seen = set()
    for f in sorted(video.get("formats") or [], key=lambda x: x.get("height") or 0, reverse=True):
        if f.get("ext") != "mp4" or f.get("vcodec") == "none" or f.get("acodec") == "none" or not f.get("url"):
            continue
        label = str(f.get("height") or "") + "p" if f.get("height") else "MP4"
        if label in seen:
            continue
        seen.add(label)
        results.append({"id": f.get("format_id"), "label": label, "height": f.get("height") or 0, "size": f.get("filesize") or f.get("filesize_approx")})
    return results

class handler(BaseHTTPRequestHandler):
    def respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path)
        query = parse_qs(path.query)
        if path.path.endswith("/info"):
            video_id = parse_id(query.get("url", [""])[0])
            if not video_id:
                return self.respond(400, {"error": "Paste a valid YouTube link."})
            try:
                video = extract(video_id)
                return self.respond(200, {
                    "id": video_id, "title": video.get("title") or "Untitled video",
                    "uploader": video.get("uploader") or "YouTube",
                    "duration": video.get("duration") or 0,
                    "thumbnail": "https://i.ytimg.com/vi/" + video_id + "/hqdefault.jpg",
                    "formats": formats_of(video)
                })
            except Exception:
                return self.respond(502, {"error": "Couldn't load this video. YouTube may be restricting access. Try another public video."})
        if path.path.endswith("/open"):
            video_id = query.get("id", [""])[0]
            fmt = query.get("format", [""])[0]
            if not ID.fullmatch(video_id) or not FORMAT.fullmatch(fmt):
                return self.respond(400, {"error": "Invalid video or quality."})
            try:
                video = extract(video_id)
                selected = next((f for f in video.get("formats", []) if f.get("format_id") == fmt and f.get("ext") == "mp4" and f.get("vcodec") != "none" and f.get("acodec") != "none"), None)
                if not selected:
                    return self.respond(404, {"error": "Quality unavailable. Refresh the video."})
                destination = selected.get("url", "")
                parsed = urlparse(destination)
                if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".googlevideo.com"):
                    return self.respond(502, {"error": "Unsupported video host."})
                self.send_response(302)
                self.send_header("Location", destination)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
            except Exception:
                return self.respond(502, {"error": "Couldn't open this video. Try refreshing."})
            return
        return self.respond(404, {"error": "Not found"})
