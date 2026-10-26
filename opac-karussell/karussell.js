/*
 * Medienkarussell fuer den webOPAC der Stadtbibliothek Chemnitz.
 * Benoetigt neuerwerbungen.js (window.SBC_NEUERWERBUNGEN), erzeugt von aktualisieren.py.
 *
 * Einbindung:
 *   <div class="sbc-karussell" data-listen="Krimis" data-titel="Neue Krimis"></div>
 *   <script src=".../neuerwerbungen.js"></script>
 *   <script src=".../karussell.js"></script>
 *
 * Optionen (data-Attribute am div):
 *   data-listen          Listenname(n) aus dem OPAC, kommagetrennt, oder "alle"
 *   data-titel           Ueberschrift (Standard: Name der Liste)
 *   data-anzahl          maximale Anzahl Titel (Standard 30)
 *   data-nur-verfuegbar  "ja" zeigt nur aktuell ausleihbare Titel
 *   data-reihenfolge     "liste" (Standard) oder "zufall"
 *   data-ziel            Linkziel, z. B. "_blank" (Standard: gleiches Fenster)
 */
(function () {
  "use strict";

  var OPAC = "https://opac2.stadtbibliothek-chemnitz.de/webOPACClient/start.do?Query=-1=";
  var COVER = "https://portal.dnb.de/opac/mvb/cover.htm?isbn=";
  var STATUS = {
    verfuegbar: "ausleihbar",
    morgen: "ab morgen da",
    entliehen: "entliehen"
  };

  var CSS = [
    ".sbck{--sbck-akzent:#c32e04;--sbck-gruen:#4f7a1c;--sbck-text:#222;--sbck-grau:#666;--sbck-linie:#ddd;--sbck-flaeche:#fff;",
    "font-family:inherit;color:var(--sbck-text);margin:1.5em 0;position:relative}",
    ".sbck *{box-sizing:border-box}",
    ".sbck-kopf{display:flex;align-items:baseline;justify-content:space-between;gap:1em;margin:0 0 .6em;border-bottom:2px solid var(--sbck-akzent);padding-bottom:.3em}",
    ".sbck-kopf h2{font-size:1.25em;margin:0;font-weight:700}",
    ".sbck-kopf a{color:var(--sbck-akzent);font-size:.9em;white-space:nowrap}",
    ".sbck-rahmen{position:relative}",
    ".sbck-band{list-style:none;margin:0;padding:.25em .1em .6em;display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:thin}",
    "@media (prefers-reduced-motion:reduce){.sbck-band{scroll-behavior:auto}}",
    ".sbck-karte{flex:0 0 150px;scroll-snap-align:start;margin:0}",
    ".sbck-karte a{display:block;color:inherit;text-decoration:none;border-radius:4px}",
    ".sbck-karte a:focus-visible{outline:3px solid var(--sbck-akzent);outline-offset:3px}",
    ".sbck-cover{position:relative;width:150px;height:220px;background:#eee;border-radius:3px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.18);transition:transform .15s}",
    ".sbck-karte a:hover .sbck-cover{transform:translateY(-3px)}",
    ".sbck-cover img{width:100%;height:100%;object-fit:cover;display:block}",
    ".sbck-ersatz{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:14px 12px;color:#fff;font-size:.95em;line-height:1.25;font-weight:700;overflow-wrap:break-word;hyphens:auto}",
    ".sbck-ersatz small{font-weight:400;opacity:.85;font-size:.8em}",
    ".sbck-titel{font-weight:700;font-size:.9em;line-height:1.3;margin:.55em 0 .15em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".sbck-karte a:hover .sbck-titel{color:var(--sbck-akzent);text-decoration:underline}",
    ".sbck-autor{font-size:.8em;color:var(--sbck-grau);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sbck-status{display:inline-flex;align-items:center;gap:.35em;font-size:.75em;color:var(--sbck-grau);margin-top:.25em}",
    ".sbck-status:before{content:'';width:.6em;height:.6em;border-radius:50%;background:#aaa}",
    ".sbck-status.verfuegbar{color:var(--sbck-gruen)}.sbck-status.verfuegbar:before{background:var(--sbck-gruen)}",
    ".sbck-status.morgen:before{background:#d99a00}",
    ".sbck-pfeil{position:absolute;top:95px;width:40px;height:40px;border-radius:50%;border:1px solid var(--sbck-linie);background:var(--sbck-flaeche);color:var(--sbck-text);font-size:22px;line-height:1;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;z-index:2}",
    ".sbck-pfeil:hover{background:var(--sbck-akzent);color:#fff;border-color:var(--sbck-akzent)}",
    ".sbck-pfeil:focus-visible{outline:3px solid var(--sbck-akzent);outline-offset:2px}",
    ".sbck-pfeil[hidden]{display:none}",
    ".sbck-zurueck{left:-14px}.sbck-vor{right:-14px}",
    "@media (max-width:600px){.sbck-pfeil{display:none}.sbck-karte{flex-basis:120px}.sbck-cover{width:120px;height:176px}}",
    ".sbck-leer{color:var(--sbck-grau);font-style:italic}"
  ].join("");

  var FARBEN = ["#7a2a12", "#2f4f6b", "#4f6b2f", "#6b2f5c", "#8a5a12", "#2f6b66", "#5c3a2e", "#3e3f72"];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function farbe(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return FARBEN[h % FARBEN.length];
  }

  function link(t) {
    return OPAC + encodeURIComponent('"' + (t.isbn || t.t) + '"');
  }

  function ersatz(cover, t) {
    cover.innerHTML = "";
    var e = el("div", "sbck-ersatz", t.t);
    e.style.background = farbe(t.t);
    if (t.a) e.appendChild(el("small", "", t.a));
    cover.appendChild(e);
  }

  function karte(t, ziel) {
    var li = el("li", "sbck-karte");
    var a = el("a");
    a.href = link(t);
    if (ziel) { a.target = ziel; if (ziel === "_blank") a.rel = "noopener"; }
    var cover = el("div", "sbck-cover");
    if (t.isbn) {
      var img = el("img");
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { ersatz(cover, t); };
      // Der Coverdienst liefert fuer fehlende Cover teils ein 1x1-Bild
      img.onload = function () { if (img.naturalWidth < 10) ersatz(cover, t); };
      img.src = COVER + t.isbn;
      cover.appendChild(img);
    } else {
      ersatz(cover, t);
    }
    a.appendChild(cover);
    a.appendChild(el("div", "sbck-titel", t.t));
    if (t.a) a.appendChild(el("div", "sbck-autor", t.a));
    var info = [t.j, STATUS[t.st]].filter(Boolean).join(" · ");
    if (STATUS[t.st]) a.appendChild(el("div", "sbck-status " + t.st, info));
    a.setAttribute("aria-label", t.t + (t.a ? ", " + t.a : "") + (STATUS[t.st] ? ", " + STATUS[t.st] : ""));
    li.appendChild(a);
    return li;
  }

  function mischen(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = arr[i]; arr[i] = arr[j]; arr[j] = x;
    }
    return arr;
  }

  function aufbauen(box, daten) {
    var opt = box.dataset;
    var keys = (opt.listen || "alle").split(",").map(function (s) { return s.trim(); });
    if (keys[0] === "alle") keys = Object.keys(daten.listen);
    var titel = [];
    keys.forEach(function (k) {
      var l = daten.listen[k];
      if (l) titel = titel.concat(l.titel);
    });
    if (opt.nurVerfuegbar === "ja") titel = titel.filter(function (t) { return t.st === "verfuegbar"; });
    if (opt.reihenfolge === "zufall") mischen(titel);
    titel = titel.slice(0, parseInt(opt.anzahl, 10) || 30);

    var ueberschrift = opt.titel || (keys.length === 1 && daten.listen[keys[0]] ? "Neu: " + daten.listen[keys[0]].label : "Neuerwerbungen");
    box.innerHTML = "";
    box.classList.add("sbck");
    box.setAttribute("lang", "de");
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", ueberschrift);

    var kopf = el("div", "sbck-kopf");
    kopf.appendChild(el("h2", "", ueberschrift));
    var alle = el("a", "", "Alle Neuerwerbungen");
    alle.href = "https://opac2.stadtbibliothek-chemnitz.de/webOPACClient/actual.do?methodToCall=show";
    kopf.appendChild(alle);
    box.appendChild(kopf);

    if (!titel.length) {
      box.appendChild(el("p", "sbck-leer", "Zurzeit keine Neuerwerbungen in dieser Auswahl."));
      return;
    }

    var rahmen = el("div", "sbck-rahmen");
    var band = el("ul", "sbck-band");
    titel.forEach(function (t) { band.appendChild(karte(t, opt.ziel)); });
    var zurueck = el("button", "sbck-pfeil sbck-zurueck", "‹");
    var vor = el("button", "sbck-pfeil sbck-vor", "›");
    zurueck.type = vor.type = "button";
    zurueck.setAttribute("aria-label", "Vorherige Titel");
    vor.setAttribute("aria-label", "Weitere Titel");
    zurueck.onclick = function () { band.scrollBy({ left: -band.clientWidth * 0.9 }); };
    vor.onclick = function () { band.scrollBy({ left: band.clientWidth * 0.9 }); };
    function pfeile() {
      zurueck.hidden = band.scrollLeft < 5;
      vor.hidden = band.scrollLeft + band.clientWidth >= band.scrollWidth - 5;
    }
    band.addEventListener("scroll", pfeile, { passive: true });
    window.addEventListener("resize", pfeile);
    rahmen.appendChild(zurueck);
    rahmen.appendChild(band);
    rahmen.appendChild(vor);
    box.appendChild(rahmen);
    pfeile();
  }

  function start() {
    var daten = window.SBC_NEUERWERBUNGEN;
    if (!daten) return;
    if (!document.getElementById("sbck-css")) {
      var st = el("style");
      st.id = "sbck-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var boxen = document.querySelectorAll(".sbc-karussell");
    for (var i = 0; i < boxen.length; i++) aufbauen(boxen[i], daten);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
