import json
import re
import html
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

VIDEO = re.compile(r"^/@[A-Za-z0-9._-]+/video/(\d{15,22})/?$")
SCRIPT = re.compile(r'<script[^>]*id=["\']__UNIVERSAL_DATA_FOR_REHYDRATION__["\'][^>]*>(.*?)</script>', re.S)

def fetch_page(url):
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urlopen(request, timeout=14) as response:
        if response.geturl().startswith("https://www.tiktok.com/"):
            return response.read(4000000).decode("utf-8", "replace")
        raise ValueError("Unexpected redirect")

def parse_video(raw):
    url = urlparse(raw)
    if url.scheme != "https" or url.hostname not in ("www.tiktok.com", "tiktok.com"):
        raise ValueError("Use a full TikTok video URL, like https://www.tiktok.com/@user/video/123...")
    match = VIDEO.fullmatch(url.path)
    if not match:
        raise ValueError("Use a TikTok post URL containing @username/video/ID.")
    return match.group(1), "https://www.tiktok.com" + url.path

def find_item(page, video_id):
    match = SCRIPT.search(page)
    if not match:
        raise ValueError("TikTok did not provide public video data in the page.")
    data = json.loads(html.unescape(match.group(1))).get("__DEFAULT_SCOPE__", {})
    candidates = []
    for key, value in data.items():
        if key == "webapp.updated-items" and isinstance(value, list):
            candidates.extend(value)
        if isinstance(value, dict):
            detail = value.get("itemInfo", {}).get("itemStruct") if isinstance(value.get("itemInfo"), dict) else None
            if isinstance(detail, dict):
                candidates.append(detail)
            item = value.get("itemStruct")
            if isinstance(item, dict):
                candidates.append(item)
    return next((item for item in candidates if str(item.get("id")) == video_id), None)

def details(item):
    video = item.get("video") or {}
    address = video.get("downloadAddr") or video.get("playAddr")
    if not address:
        raise ValueError("No downloadable video address is present in the page.")
    parsed = urlparse(address)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith((".tiktok.com", ".tiktokcdn.com", ".tiktokv.com")):
        raise ValueError("TikTok returned an unsupported video host.")
    author = item.get("author") or {}
    return {
        "title": item.get("desc") or "TikTok video",
        "uploader": author.get("uniqueId") or "TikTok",
        "thumbnail": video.get("cover") or video.get("originCover") or "",
        "duration": video.get("duration") or 0,
        "media": address
    }

class handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        route = urlparse(self.path)
        params = parse_qs(route.query)
        if route.path != "/api/info":
            return self.reply(404, {"error": "Not found"})
        try:
            video_id, url = parse_video(params.get("url", [""])[0])
            item = find_item(fetch_page(url), video_id)
            if not item:
                raise ValueError("Couldn't find that post in TikTok's page data. It may be private or restricted.")
            info = details(item)
            return self.reply(200, info)
        except ValueError as exc:
            return self.reply(400, {"error": str(exc)})
        except Exception:
            return self.reply(502, {"error": "TikTok didn't return readable video data. Try a public video or try again later."})
