#!/usr/bin/env python3
"""Liest alle Neuerwerbungslisten aus dem webOPAC der Stadtbibliothek Chemnitz
und schreibt sie als neuerwerbungen.js fuer das Medienkarussell.

Aufruf:  python3 aktualisieren.py [Zieldatei]
Standard-Ziel ist neuerwerbungen.js neben diesem Skript. Die Cover werden in den
Ordner covers/ neben der Zieldatei gespeichert (covers/<ISBN>.jpg). Bereits
vorhandene Cover werden nicht erneut geladen, Cover nicht mehr gelisteter Titel
werden geloescht. Nur Standardbibliothek.

Filmcover: Fuer Titel aus den Listen in FILM_LISTEN (Spielfilme, Kinderfilme) gibt
es im OPAC keine Cover. Ist ein TMDB-Schluessel vorhanden, sucht das Skript sie bei
The Movie Database (themoviedb.org) nach Titel und Jahr und speichert die Poster als
covers/tmdb-<typ>-<id>.jpg. Der Schluessel (API-Key v3 oder Lese-Token v4) kommt aus
der Umgebungsvariablen TMDB_API_KEY oder aus der Datei tmdb.key neben diesem Skript.
Falsche oder fehlende Treffer lassen sich in tmdb-korrekturen.json festlegen:
  {"Titel wie im OPAC": 12345, "Serientitel": "tv:6789", "Kein Cover": null}
"""
import datetime
import html
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://opac2.stadtbibliothek-chemnitz.de"
HIER = os.path.dirname(os.path.abspath(__file__))

FILM_LISTEN = ("Spielfilme", "Kinderfilm")
TMDB_API = "https://api.themoviedb.org/3/"
TMDB_BILD = "https://image.tmdb.org/t/p/w154"
TMDB_ERNEUT_NACH_TAGEN = 7  # erfolglose Suchen werden nach dieser Zeit wiederholt

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get_bytes(path):
    for attempt in range(4):
        try:
            return opener.open(BASE + path, timeout=60).read()
        except Exception as e:
            print("Wiederhole", path, e, file=sys.stderr)
            time.sleep(2 ** attempt)
    raise SystemExit("Abruf fehlgeschlagen: " + path)


def get(path):
    return get_bytes(path).decode("utf-8", "replace")


def cover_laden(isbn, ziel):
    """Holt das Cover wie die OPAC-Trefferliste: cover.jsp liefert einen
    Einmal-Token, showMVBCover.do mit diesem Token das Bild. Benoetigt eine
    gueltige Sitzung (start.do). Gibt True zurueck, wenn ein Bild gespeichert wurde."""
    try:
        page = get("/webOPACClient/jsp/result/cover.jsp?title=x&localImg=&isbns=%s&asins=%%5B%%5D&size=medium&pos=c"
                   % urllib.parse.quote("[" + isbn + "]"))
        m = re.search(r"showMVBCover\.do\?token=[\w-]+", page)
        if not m:
            return False
        bild = get_bytes("/webOPACClient/" + m.group(0))
    except SystemExit:
        return False
    # JPEG oder PNG; ohne gueltige Sitzung kommt eine HTML-Seite, fehlende Cover sind winzig
    if not (bild[:3] == b"\xff\xd8\xff" or bild[:4] == b"\x89PNG") or len(bild) < 500:
        return False
    with open(ziel, "wb") as f:
        f.write(bild)
    return True


# ---------------------------------------------------------------- TMDB (Filmcover)

def tmdb_schluessel():
    key = os.environ.get("TMDB_API_KEY", "").strip()
    datei = os.path.join(HIER, "tmdb.key")
    if not key and os.path.exists(datei):
        with open(datei, encoding="utf-8") as f:
            key = f.read().strip()
    return key


def tmdb_get(key, pfad, params):
    params = dict(params)
    headers = {"Accept": "application/json"}
    if key.startswith("eyJ"):  # Lese-Token (v4) statt API-Key (v3)
        headers["Authorization"] = "Bearer " + key
    else:
        params["api_key"] = key
    url = TMDB_API + pfad + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 401:
                raise SystemExit("TMDB lehnt den Schluessel ab (401). Bitte tmdb.key bzw. TMDB_API_KEY pruefen.")
            if e.code != 429:
                print("TMDB: Fehler %s bei %s" % (e.code, pfad), file=sys.stderr)
                return {}
        except OSError as e:
            print("TMDB: wiederhole", pfad, e, file=sys.stderr)
        time.sleep(2 ** attempt)
    return {}


def normal(s):
    return re.sub(r"[^a-z0-9äöüß]+", " ", s.lower()).strip()


def film_suchen(key, titel, jahr):
    """Sucht zuerst Filme, dann Serien. Bevorzugt Treffer mit gleichem Titel."""
    kurz = re.split(r"\s+[-:]\s+", titel)[0]
    anfragen = []
    for q in dict.fromkeys([titel, kurz]):
        if jahr:
            anfragen.append(("movie", q, {"year": jahr}))
        anfragen.append(("movie", q, {}))
    for q in dict.fromkeys([titel, kurz]):
        anfragen.append(("tv", q, {}))
    for typ, q, extra in anfragen:
        params = {"query": q, "language": "de-DE", "include_adult": "false"}
        params.update(extra)
        treffer = [t for t in tmdb_get(key, "search/" + typ, params).get("results", []) if t.get("poster_path")]
        if not treffer:
            continue
        gleich = [t for t in treffer if normal(q) in (normal(t.get("title") or t.get("name") or ""),
                                                      normal(t.get("original_title") or t.get("original_name") or ""))]
        t = (gleich or treffer)[0]
        return {"typ": typ, "id": t["id"], "poster": t["poster_path"]}
    return None


def tmdb_eintrag(key, typ, tmdb_id):
    d = tmdb_get(key, "%s/%s" % (typ, tmdb_id), {"language": "de-DE"})
    if not d.get("poster_path"):
        d = tmdb_get(key, "%s/%s" % (typ, tmdb_id), {})
    return {"typ": typ, "id": tmdb_id, "poster": d["poster_path"]} if d.get("poster_path") else None


def filmcover(data, cover_dir):
    """Ergaenzt Filmtitel um TMDB-Poster. Gibt die Namen der verwendeten Dateien zurueck."""
    filme = [t for k in FILM_LISTEN if k in data["listen"] for t in data["listen"][k]["titel"]]
    if not filme:
        return set()
    key = tmdb_schluessel()
    if not key:
        print("TMDB: kein Schluessel (TMDB_API_KEY oder tmdb.key), Filmcover werden uebersprungen.", file=sys.stderr)
        return {n for n in os.listdir(cover_dir) if n.startswith("tmdb-")}  # vorhandene behalten

    korr_datei = os.path.join(HIER, "tmdb-korrekturen.json")
    korrekturen = {}
    if os.path.exists(korr_datei):
        with open(korr_datei, encoding="utf-8") as f:
            korrekturen = json.load(f)
    cache_datei = os.path.join(cover_dir, "tmdb-cache.json")
    cache = {}
    if os.path.exists(cache_datei):
        with open(cache_datei, encoding="utf-8") as f:
            cache = json.load(f)

    heute = datetime.date.today()
    benutzt, gefunden, ohne = set(), 0, 0
    for t in filme:
        jahr = (re.findall(r"(?:19|20)\d\d", t["j"]) or [""])[0]
        ck = t["t"] + "|" + jahr
        if t["t"] in korrekturen:
            wert = korrekturen[t["t"]]
            if wert is None:
                treffer = None
            else:
                typ, _, nr = str(wert).rpartition(":")
                ck = "korrektur|%s|%s" % (typ or "movie", nr)
                alt = cache.get(ck) or {}
                treffer = alt if "id" in alt else tmdb_eintrag(key, typ or "movie", int(nr))
        else:
            alt = cache.get(ck)
            if alt and "id" in alt:
                treffer = alt
            elif alt and (heute - datetime.date.fromisoformat(alt["gesucht"])).days < TMDB_ERNEUT_NACH_TAGEN:
                treffer = None
            else:
                treffer = film_suchen(key, t["t"], jahr)
        cache[ck] = treffer or {"gesucht": heute.isoformat()}
        if not treffer:
            ohne += 1
            continue
        name = "tmdb-%s-%s.jpg" % (treffer["typ"], treffer["id"])
        datei = os.path.join(cover_dir, name)
        if not os.path.exists(datei):
            try:
                with urllib.request.urlopen(TMDB_BILD + treffer["poster"], timeout=30) as r:
                    bild = r.read()
            except OSError as e:
                print("TMDB: Poster nicht ladbar", t["t"], e, file=sys.stderr)
                ohne += 1
                continue
            with open(datei, "wb") as f:
                f.write(bild)
        t["c"] = name
        t["q"] = "tmdb"
        benutzt.add(name)
        gefunden += 1

    with open(cache_datei, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)
    print("TMDB: %d Filme mit Cover, %d ohne" % (gefunden, ohne), file=sys.stderr)
    return benutzt


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

    cover_dir = os.path.join(os.path.dirname(os.path.abspath(target)), "covers")
    os.makedirs(cover_dir, exist_ok=True)
    isbns = {t["isbn"] for l in data["listen"].values() for t in l["titel"] if t["isbn"]}
    neu = vorhanden = fehlt = 0
    for isbn in sorted(isbns):
        datei = os.path.join(cover_dir, isbn + ".jpg")
        if os.path.exists(datei):
            vorhanden += 1
        elif cover_laden(isbn, datei):
            neu += 1
        else:
            fehlt += 1
    for l in data["listen"].values():
        for t in l["titel"]:
            if t["isbn"] and os.path.exists(os.path.join(cover_dir, t["isbn"] + ".jpg")):
                t["c"] = 1
    print("Cover: %d neu, %d vorhanden, %d ohne Cover" % (neu, vorhanden, fehlt), file=sys.stderr)

    behalten = {i + ".jpg" for i in isbns} | filmcover(data, cover_dir)
    for name in os.listdir(cover_dir):
        if name.endswith(".jpg") and name not in behalten:
            os.remove(os.path.join(cover_dir, name))

    with open(target, "w", encoding="utf-8") as f:
        f.write("/* Neuerwerbungen Stadtbibliothek Chemnitz, erzeugt von aktualisieren.py */\n")
        f.write("window.SBC_NEUERWERBUNGEN = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("Geschrieben:", target, file=sys.stderr)


if __name__ == "__main__":
    main()
