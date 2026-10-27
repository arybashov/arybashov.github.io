"""Builds personal landing pages /for/<slug>-<code>/ for outreach.

Input: outreach/companies.json (private, gitignored), a list of:
  {"name": "Pitch", "slug": "pitch",
   "focus": ["elavia", "cosmos", "rram"],          # cards to show first, in this order
   "name_for": "Pitch",                           # optional: name after «для» (e.g. «Полигонатора»)
   "line": "Собрал проекты под ваши задачи: ...",  # one personal line under the greeting
   "links": [["Видео: AI-агент в Houdini", "https://youtu.be/..."]]}   # optional

Each page is the main index.html with: a greeting block in the hero, cards reordered,
its own title / Open Graph preview image with the company name, and noindex.
The <code> suffix is derived from the name and a private salt, so pages are not guessable.

  python tools/make_for.py            # build all
  python tools/make_for.py pitch      # build one slug
"""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://arybashov.github.io"
DATA = ROOT / "outreach" / "companies.json"
SALT_FILE = ROOT / "outreach" / ".salt"
OUT = ROOT / "for"

CARDS = {  # card key -> marker that identifies the <article> in index.html
    "cosmos": 'data-i="w1.c"', "elavia": 'data-i="w2.c"', "math": 'data-i="w4.c"',
    "rram": 'data-i="w9.c"', "yui": 'data-i="w10.c"', "gorodki": 'data-i="w6.c"',
    "flight": 'data-i="w7.c"', "demo": '>Showreel<',
}

FONT_B = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_R = r"C:\Windows\Fonts\segoeui.ttf"


def salt() -> str:
    if not SALT_FILE.exists():
        SALT_FILE.write_text(hashlib.sha256(str(Path.home()).encode() + Path(__file__).read_bytes()).hexdigest()[:16])
    return SALT_FILE.read_text().strip()


def page_dir(c: dict) -> str:
    code = hashlib.sha256((salt() + c["name"]).encode()).hexdigest()[:6]
    return f"{c['slug']}-{code}"


def reorder_cards(src: str, focus: list[str]) -> str:
    start = src.index('<div class="work">')
    end = src.index("<!-- STACK -->")
    block = src[start:end]
    arts = re.findall(r"      <article class=\"w rv\">.*?</article>\n", block, re.S)
    keyed = []
    for a in arts:
        key = next((k for k, m in CARDS.items() if m in a), None)
        keyed.append((key, a))
    order = [k for k in focus if k in CARDS] + [k for k, _ in keyed if k not in focus]
    by_key = {k: a for k, a in keyed}
    new_arts = "".join(by_key[k] for k in order if k in by_key)
    first = block.index(arts[0])
    last = block.index(arts[-1]) + len(arts[-1])
    return src[:start] + block[:first] + new_arts + block[last:] + src[end:]


def og_image(c: dict, path: Path) -> None:
    base = Image.open(ROOT / "assets" / "og.jpg").convert("RGB").resize((1200, 630))
    shade = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shade)
    for y in range(630):  # dark band at the bottom for the text
        a = max(0, min(215, int((y - 300) * 0.9)))
        d.line([(0, y), (1200, y)], fill=(8, 9, 12, a))
    img = Image.alpha_composite(base.convert("RGBA"), shade).convert("RGB")
    d = ImageDraw.Draw(img)
    size = 84
    while size > 40:
        fb = ImageFont.truetype(FONT_B, size)
        if d.textlength(f"для {c.get('name_for', c['name'])}", font=fb) < 1100:
            break
        size -= 4
    d.text((56, 420), f"для {c.get('name_for', c['name'])}", font=fb, fill=(255, 176, 59))
    d.text((58, 540), "Александр Рыбашов · Houdini · AI · Science Viz", font=ImageFont.truetype(FONT_R, 34), fill=(235, 236, 240))
    img.save(path, quality=88, optimize=True)


def build(c: dict, src: str) -> str:
    d = page_dir(c)
    url = f"{SITE}/for/{d}/"
    name = html.escape(c["name"])
    name_for = html.escape(c.get("name_for", c["name"]))
    out = reorder_cards(src, c.get("focus", []))
    # paths: resolve everything against the site root, keep in-page anchors on this page
    out = out.replace("<head>", '<head>\n<base href="/">', 1)
    out = re.sub(r'href="#([\w-]*)"', lambda m: f'href="for/{d}/#{m.group(1)}"', out)
    out = out.replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n<meta name="viewport"', 1)
    title = f"Александр Рыбашов — для {name_for}"
    out = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", out, count=1)
    out = re.sub(r'(<meta property="og:title" content=")[^"]*', rf"\1Для {name}: Houdini · AI · Science Viz", out, count=1)
    line = html.escape(c.get("line", ""))
    out = re.sub(r'(<meta property="og:description" content=")[^"]*', rf"\g<1>{line}", out, count=1)
    out = re.sub(r'content="https://arybashov.github.io/assets/og.jpg\?v=\d+"', f'content="{url}og.jpg"', out)
    out = re.sub(r'(<meta property="og:url" content=")[^"]*', rf"\1{url}", out, count=1)
    links = "".join(
        f' <a href="{html.escape(h)}" target="_blank" rel="noopener">{html.escape(t)} →</a>' for t, h in c.get("links", [])
    )
    greet = (
        '<div class="for-note"><span class="for-k">Для ' + name_for + "</span>"
        + (f"<p>{line}{links}</p>" if line or links else "") + "</div>\n    "
    )
    out = out.replace('<div class="kicker" data-i="hero.kicker">', greet + '<div class="kicker" data-i="hero.kicker">', 1)
    css = (".for-note{display:inline-block;max-width:640px;margin:0 0 18px;padding:12px 16px;border:1px solid var(--hot);"
           "border-radius:12px;background:rgba(11,12,16,.72);backdrop-filter:blur(6px)}"
           ".for-k{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--hot2)}"
           ".for-note p{margin:6px 0 0;font-size:15px;color:#e6e7ec}.for-note a{color:var(--hot2);white-space:nowrap}")
    out = out.replace("</style>", css + "\n</style>", 1)
    folder = OUT / d
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "index.html").write_text(out, encoding="utf-8")
    og_image(c, folder / "og.jpg")
    return url


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    companies = json.loads(DATA.read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    links = {}
    for c in companies:
        if only and c["slug"] not in only:
            continue
        links[c["slug"]] = build(c, src)
        print(f"{c['name']:<24} {links[c['slug']]}")
    # private map name -> URL for the mailing sheet
    (ROOT / "outreach" / "for_links.json").write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
