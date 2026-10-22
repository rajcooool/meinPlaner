#!/usr/bin/env python3
"""Liest alle Neuerwerbungslisten aus dem webOPAC der Stadtbibliothek Chemnitz
und schreibt sie als neuerwerbungen.js fuer das Medienkarussell.

Aufruf:  python3 aktualisieren.py [Zieldatei]
Standard-Ziel ist neuerwerbungen.js neben diesem Skript. Nur Standardbibliothek.
"""
import datetime
import html
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://opac2.stadtbibliothek-chemnitz.de"

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(path):
    for attempt in range(4):
        try:
            return opener.open(BASE + path, timeout=60).read().decode("utf-8", "replace")
        except Exception as e:
            print("Wiederhole", path, e, file=sys.stderr)
            time.sleep(2 ** attempt)
    raise SystemExit("Abruf fehlgeschlagen: " + path)


def clean(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).replace("¬", "").strip()


def parse(page):
    """Zerlegt eine Trefferseite in Titelsaetze."""
    isbns = {}
    for m in re.finditer(r"isbns=%5B(.*?)%5D.*?pos=cover_-1_(\d+)", page):
        isbns[m.group(2)] = urllib.parse.unquote_plus(m.group(1)).split(",")[0].strip()
    out = []
    for chunk in page.split("<h2 class=recordtitle>")[1:]:
        pm = re.search(r"curPos=(\d+)", chunk)
        pos = pm.group(1) if pm else ""
        title = clean(chunk.split("</h2>")[0])
        body = re.split(r'<a title="Vormerken|<div', chunk.split("</h2>", 1)[1])[0]
        status = ""
        sm = re.search(r'<span class="bg\w+">(.*?)</span>', body, re.S)
        if sm:
            status = clean(sm.group(1))
            body = body[:sm.start()]
        parts = [p for p in (clean(x) for x in re.split(r"<br\s*/?>", body)) if p]
        # Aufbau: [Verfasser], Jahr, Signatur, [Statustext]
        if len(parts) == 4:
            status = status or parts.pop()
        sig = parts.pop() if parts else ""
        jahr = parts.pop() if parts else ""
        verf = re.sub(r"\s*\[.*?\]", "", parts[0]).strip() if parts else ""
        if "ausleihbar" in status:
            st = "verfuegbar"
        elif "zurückgebucht" in status:
            st = "morgen"
        elif "entliehen" in status:
            st = "entliehen"
        else:
            st = ""
        out.append({"t": title, "a": verf, "j": jahr, "s": sig, "st": st,
                    "isbn": isbns.get(pos, "").replace("-", "")})
    return out


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "neuerwerbungen.js")
    get("/webOPACClient/start.do")
    index = get("/webOPACClient/actual.do?methodToCall=show")
    lists, seen = [], set()
    for m in re.finditer(r'href="(/webOPACClient/showList\.do\?methodToCall=showAcqList&amp;ListName=([^&]+)&amp;ListLabel=[^"]*)"[^>]*>(.*?)</a>', index, re.S):
        key = urllib.parse.unquote_plus(m.group(2))
        if key not in seen:
            seen.add(key)
            lists.append((html.unescape(m.group(1)), key, clean(m.group(3))))

    data = {"stand": datetime.date.today().isoformat(), "listen": {}}
    for url, key, label in lists:
        page = get(url)
        total = re.search(r"Neuerwerbungsliste.*?\((\d+)\)", clean(page))
        total = int(total.group(1)) if total else 0
        items = parse(page)
        pos = 11
        while len(items) < total:
            more = parse(get("/webOPACClient/hitList.do?methodToCall=pos&identifier=-1_%s&curPos=%d"
                             % (urllib.parse.quote_plus(key), pos)))
            if not more:
                break
            items += more
            pos += 10
        print("%s: %d" % (label, len(items)), file=sys.stderr)
        if items:
            data["listen"][key] = {"label": label, "titel": items}

    with open(target, "w", encoding="utf-8") as f:
        f.write("/* Neuerwerbungen Stadtbibliothek Chemnitz, erzeugt von aktualisieren.py */\n")
        f.write("window.SBC_NEUERWERBUNGEN = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("Geschrieben:", target, file=sys.stderr)


if __name__ == "__main__":
    main()
