"""Merges outreach/base/*.json into one private base: outreach/studios.csv (for Google Sheets)
and outreach/companies.json (input for tools/make_for.py). Dedupes by website domain,
classifies email type and priority, flags addresses that need a manual check."""
import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "outreach" / "base"
VIDEO = ["Видео: AI-агент строит сцену в Houdini", "https://youtu.be/e4cbjexkTRI"]
SIM = ["Запустить симулятор", "https://arybashov.github.io/sim/"]

JOB = re.compile(r"^(hr|job|jobs|career|careers|cv|resume|personal|rabota|join|team|vacancy|vacancies)[@.]", re.I)
WEAK = re.compile(r"^(press|pr|partners?|support|biz|business|social|enjoy|sales|series|producer|production|exhibitions|dev|ads|marketing)[@.]", re.I)
FREE = re.compile(r"@(gmail|mail|yandex|ya|bk|inbox|list|rambler)\.", re.I)
EMAIL = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")

TR = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
              ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t","u","f","h","ts","ch","sh","sch","","y","","e","yu","ya"]))


def slugify(name: str) -> str:
    s = "".join(TR.get(ch, ch) for ch in name.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:28].strip("-") or "studio"


def domain(url: str) -> str:
    host = urlparse(url if "://" in url else "https://" + url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def email_type(email: str) -> str:
    local = email.split("@")[0] + "@"
    if JOB.match(local):
        return "hr"
    if WEAK.match(local):
        return "weak"
    return "general"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    rows, seen = [], {}
    for f in sorted(BASE.glob("*.json")):
        for r in json.loads(f.read_text(encoding="utf-8")):
            key = domain(r.get("website", "")) or r["name"].lower()
            r["email"] = (r.get("email") or "").strip()
            r["directions"] = [r.get("direction", f.stem)]
            if key in seen:
                old = seen[key]
                old["directions"] = sorted(set(old["directions"] + r["directions"]))
                rank = {"hr": 0, "general": 1, "weak": 2, "": 3}
                if rank[email_type(r["email"]) if r["email"] else ""] < rank[email_type(old["email"]) if old["email"] else ""]:
                    old.update({k: r[k] for k in ("email", "email_source")})
                old["notes"] = "; ".join(x for x in (old.get("notes", ""), r.get("notes", "")) if x)
                continue
            seen[key] = r
            rows.append(r)

    slugs = set()
    for r in rows:
        e = r["email"]
        flags = []
        if e and (not EMAIL.match(e) or re.match(r"^x{3,}@", e, re.I)):
            flags.append("адрес некорректный")
            r["email"] = e = ""
        if e and FREE.search(e):
            flags.append("бесплатная почта")
        if e and domain(r.get("website", "")) and not e.split("@")[1].lower().endswith(domain(r["website"]).split(".", 1)[-1]) \
                and e.split("@")[1].lower() != domain(r["website"]):
            flags.append("домен почты ≠ сайт")
        if "⚠" in r.get("notes", "") or "проверить" in r.get("notes", "").lower() or "уточнить" in r.get("notes", "").lower():
            flags.append("см. заметки")
        r["email_type"] = email_type(e) if e else "нет почты"
        r["check"] = ", ".join(flags)
        r["priority"] = ("A" if r["email_type"] == "hr" else "B" if r["email_type"] == "general" else "C") if e else "—"
        s = slugify(r["name"])
        while s in slugs:
            s += "-2"
        slugs.add(s)
        r["slug"] = s

    rows.sort(key=lambda r: ({"A": 0, "B": 1, "C": 2, "—": 3}[r["priority"]], r["directions"][0], r["name"].lower()))

    links_file = ROOT / "outreach" / "for_links.json"
    for_links = json.loads(links_file.read_text(encoding="utf-8")) if links_file.exists() else {}

    cols = ["priority", "status", "directions", "name", "email", "email_type", "check", "city", "website",
            "email_source", "what", "line", "name_for", "slug", "focus", "for_url", "sent_at", "reply", "notes"]
    with (ROOT / "outreach" / "studios.csv").open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in rows:
            w.writerow([
                r["priority"], "", ", ".join(r["directions"]), r["name"], r["email"], r["email_type"], r["check"],
                r.get("city", ""), r.get("website", ""), r.get("email_source", ""), r.get("what", ""), r.get("line", ""),
                r.get("name_for") or r["name"], r["slug"], " ".join(r.get("focus", [])), for_links.get(r["slug"], ""), "", "", r.get("notes", ""),
            ])

    companies = [{
        "name": r["name"], "name_for": r.get("name_for") or r["name"], "slug": r["slug"],
        "focus": r.get("focus", []), "line": r.get("line", ""),
        "links": [SIM if "sim" in r["directions"] else VIDEO],
    } for r in rows if r["email"]]
    (ROOT / "outreach" / "companies.json").write_text(json.dumps(companies, ensure_ascii=False, indent=1), encoding="utf-8")

    from collections import Counter
    print("total", len(rows), "| with email", sum(1 for r in rows if r["email"]))
    print("priority", dict(Counter(r["priority"] for r in rows)))
    print("by direction", dict(Counter(d for r in rows for d in r["directions"])))
    print("need check", sum(1 for r in rows if r["check"]))


if __name__ == "__main__":
    main()
