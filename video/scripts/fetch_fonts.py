"""Downloads Gowun Batang (Korean serif) and Cormorant Garamond Italic as small woff2 files.

Google Fonts' `text=` option returns a font that holds only the characters we ask for,
so the files stay tiny. Run it again after changing any on-screen text in config.json.
Both fonts are under the SIL Open Font License.
Usage: python3 scripts/fetch_fonts.py
"""
import re
import string
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

chars = set(string.printable.strip()) | set("·–—…“”‘’×↓%")
for f in ("config.json", "main.js", "index.html", "journey.js", "journey.html"):
    chars |= set((ROOT / f).read_text(encoding="utf-8"))
text = "".join(sorted(c for c in chars if c.isprintable() and not c.isspace())) + " "

FONTS = [
    ("Gowun Batang", "wght@400", "GowunBatang-Regular.woff2"),
    ("Gowun Batang", "wght@700", "GowunBatang-Bold.woff2"),
    ("Cormorant Garamond", "ital,wght@1,500", "CormorantGaramond-Italic.woff2"),
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


OUT.mkdir(parents=True, exist_ok=True)
for family, axis, fname in FONTS:
    q = urllib.parse.urlencode({"family": f"{family}:{axis}", "text": text, "display": "block"})
    css = get(f"https://fonts.googleapis.com/css2?{q}").decode()
    urls = re.findall(r"url\((https://[^)]+)\)", css)
    if len(urls) != 1:
        raise SystemExit(f"unexpected CSS for {family}: {css[:300]}")
    data = get(urls[0])
    (OUT / fname).write_bytes(data)
    print(f"{fname}: {len(data) // 1024} KB")
