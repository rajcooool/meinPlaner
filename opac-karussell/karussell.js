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
 *   data-leer            "ausblenden" blendet das Karussell aus, wenn die Auswahl leer ist
 */
(function () {
  "use strict";

  var OPAC = "https://opac2.stadtbibliothek-chemnitz.de/webOPACClient/start.do?Query=-1=";
  var OPAC_PFAD = "/webOPACClient/";
  // Von aktualisieren.py gespeicherte Cover liegen in covers/ neben diesem Skript
  var skript = document.currentScript && document.currentScript.src;
  var COVER_ORDNER = (skript ? skript.replace(/[^\/]*$/, "") : "") + "covers/";
  var COVER = "https://portal.dnb.de/opac/mvb/cover.htm?isbn=";
  var STATUS = {
    verfuegbar: "ausleihbar",
    morgen: "ab morgen da",
    entliehen: "entliehen"
  };

  // Zwei Reihen aus 2x2-Bloecken. Cover erscheinen hoechstens in Originalgroesse
  // (die OPAC-Cover sind 90 px breit); --sbck-breite begrenzt die Breite zusaetzlich.
  var CSS = [
    ".sbck{--sbck-akzent:#c32e04;--sbck-gruen:#3f7a1c;--sbck-text:#1d1d1d;--sbck-breite:90px;--sbck-abstand:20px;",
    "font-family:inherit;color:var(--sbck-text);margin:1.2em 0 2.2em;position:relative}",
    ".sbck *{box-sizing:border-box}",
    ".sbck-kopf{display:flex;align-items:baseline;justify-content:space-between;gap:1em;margin:0 0 .9em}",
    ".sbck-kopf h2{font-size:1.15em;margin:0;font-weight:700}",
    ".sbck-kopf a{color:var(--sbck-akzent);text-decoration:none;white-space:nowrap}",
    ".sbck-kopf a:hover{text-decoration:underline}",
    ".sbck-rahmen{position:relative;padding:0 64px}",
    ".sbck-band{list-style:none;margin:0;padding:6px 2px 10px;display:grid;grid-template-rows:auto auto;grid-auto-flow:column;grid-auto-columns:max-content;gap:var(--sbck-abstand);align-items:end;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none}",
    ".sbck-band::-webkit-scrollbar{display:none}",
    "@media (prefers-reduced-motion:reduce){.sbck-band{scroll-behavior:auto}}",
    ".sbck-platz{scroll-snap-align:start;display:flex;justify-content:center}",
    
    ".sbck-karte{display:block;color:inherit;text-decoration:none;border-radius:6px;flex:0 0 auto}",
    ".sbck-karte:focus-visible{outline:3px solid var(--sbck-akzent);outline-offset:3px}",
    ".sbck-cover{position:relative;width:var(--sbck-breite);aspect-ratio:2/3;background:#e9e9e9;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.25)}",
    ".sbck-cover img{width:100%;height:100%;display:block}",
    ".sbck-ersatz{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:7px;color:#fff;font-size:.7em;line-height:1.25;font-weight:700;overflow-wrap:break-word;hyphens:auto}",
            ".sbck-ist-ersatz .sbck-info b,.sbck-ist-ersatz .sbck-info span{display:none}",
    ".sbck-ist-ersatz .sbck-info{background:rgba(0,0,0,.9);padding-top:6px}",
    ".sbck-ersatz small{font-weight:400;opacity:.85;font-size:.8em}",
    ".sbck-info{position:absolute;left:0;right:0;bottom:0;padding:18px 6px 6px;background:linear-gradient(transparent,rgba(0,0,0,.88) 35%);color:#fff;font-size:.68em;line-height:1.3;opacity:0;transform:translateY(6px);transition:opacity .15s,transform .15s;pointer-events:none}",
    ".sbck-karte:hover .sbck-info,.sbck-karte:focus-visible .sbck-info{opacity:1;transform:none}",
    ".sbck-info b{display:block;font-size:1.05em}",
    ".sbck-info span{display:block;opacity:.85}",
    ".sbck-info i{font-style:normal;display:inline-flex;align-items:center;gap:.35em;margin-top:.2em}",
    ".sbck-info i:before{content:'';width:.6em;height:.6em;border-radius:50%;background:#bbb}",
    ".sbck-info i.verfuegbar:before{background:#8fd16a}.sbck-info i.morgen:before{background:#f0b400}",
    "@media (prefers-reduced-motion:reduce){.sbck-info{transition:none}}",
    ".sbck-pfeil{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:96px;padding:0;border:0;background:none;color:var(--sbck-akzent);cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px}",
    ".sbck-pfeil svg{width:30px;height:60px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}",
    ".sbck-pfeil:hover{opacity:.7}",
    ".sbck-pfeil:focus-visible{outline:3px solid var(--sbck-akzent);outline-offset:2px}",
    ".sbck-pfeil:disabled{opacity:.25;cursor:default}",
    ".sbck-zurueck{left:4px}.sbck-vor{right:4px}",
    "@media (max-width:700px){.sbck{--sbck-abstand:12px}.sbck-rahmen{padding:0 34px}.sbck-pfeil{width:30px;height:64px}.sbck-pfeil svg{width:18px;height:40px}.sbck-zurueck{left:0}.sbck-vor{right:0}}",
    ".sbck-leer{color:#666;font-style:italic}"
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
    var info = cover.querySelector(".sbck-info");
    cover.innerHTML = "";
    cover.style.aspectRatio = "";
    cover.style.maxWidth = "";
    cover.classList.add("sbck-ist-ersatz");
    if (info) cover.appendChild(info);
    var e = el("div", "sbck-ersatz", t.t);
    e.style.background = farbe(t.t);
    if (t.a) e.appendChild(el("small", "", t.a));
    cover.insertBefore(e, cover.firstChild);
  }

  // Das Cover bekommt das Seitenverhaeltnis des Bildes und wird nie groesser als das Original
  function bildEinsetzen(cover, img) {
    img.addEventListener("load", function () {
      if (img.naturalWidth >= 10 && img.naturalHeight >= 10) {
        cover.style.aspectRatio = img.naturalWidth + " / " + img.naturalHeight;
        cover.style.maxWidth = img.naturalWidth + "px";
      }
    });
    cover.insertBefore(img, cover.firstChild);
  }

  // Cover kommen bevorzugt ueber den OPAC selbst (cover.jsp -> showMVBCover.do).
  // Das geht nur, wenn die Seite auf demselben Server wie der OPAC liegt und eine
  // gueltige OPAC-Sitzung besteht. Sonst wird der DNB-Coverdienst versucht.
  // Jeder Bildabruf ohne gueltige Sitzung setzt ein neues Sitzungs-Cookie. Deshalb
  // prueft das erste Cover die Sitzung allein, alle weiteren starten erst danach.
  var bereit = null;

  function opacCoverUrl(isbn) {
    var url = OPAC_PFAD + "jsp/result/cover.jsp?title=x&localImg=&isbns=" +
      encodeURIComponent("[" + isbn + "]") + "&asins=%5B%5D&size=medium&pos=sbck";
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("kein OPAC");
      return r.text();
    }).then(function (text) {
      var m = text.match(/showMVBCover\.do\?token=[\w-]+/);
      return m ? OPAC_PFAD + m[0] : null;
    });
  }

  function sitzungAnlegen() {
    return fetch(OPAC_PFAD + "start.do", { credentials: "same-origin" })
      .then(function () {}, function () {});
  }

  function coverLaden(cover) {
    var t = cover.sbckTitel;
    if (t.c) {
      // Gespeichertes Cover; nur wenn es fehlt, ueber den OPAC nachladen
      var img = el("img");
      img.alt = "";
      img.onerror = function () { cover.removeChild(img); opacCoverLaden(cover); };
      img.src = COVER_ORDNER + t.isbn + ".jpg";
      bildEinsetzen(cover, img);
      return;
    }
    opacCoverLaden(cover);
  }

  function opacCoverLaden(cover) {
    if (!bereit) {
      var fertig;
      bereit = new Promise(function (r) { fertig = r; });
      laden(cover, fertig, "opac");
    } else {
      bereit.then(function (modus) { laden(cover, null, modus); });
    }
  }

  // fertig: nur beim ersten Cover gesetzt, meldet "opac" oder "dnb" an alle weiteren
  function laden(cover, fertig, modus) {
    var t = cover.sbckTitel;
    var img = el("img");
    var versuche = 0;
    img.alt = "";
    bildEinsetzen(cover, img);

    function melden(m) { if (fertig) { fertig(m); fertig = null; } }

    function dnb() {
      melden("dnb");
      img.onerror = function () { ersatz(cover, t); };
      // Der Coverdienst liefert fuer fehlende Cover teils ein 1x1-Bild
      img.onload = function () { if (img.naturalWidth < 10) ersatz(cover, t); };
      img.src = COVER + t.isbn;
    }

    function opac() {
      opacCoverUrl(t.isbn).then(function (src) {
        if (!src) {
          // Kein Cover beim OPAC; die Sitzung ist damit noch ungeprueft
          ersatz(cover, t);
          if (fertig) sitzungAnlegen().then(function () { melden("opac"); });
          return;
        }
        img.onload = function () {
          if (img.naturalWidth < 10) ersatz(cover, t);
          melden("opac");
        };
        img.onerror = function () {
          // Ohne gueltige Sitzung liefert showMVBCover.do eine HTML-Seite statt des Bildes
          if (fertig && versuche++ === 0) sitzungAnlegen().then(opac);
          else { ersatz(cover, t); melden("opac"); }
        };
        img.src = src;
      }, dnb);
    }

    if (modus === "dnb") dnb();
    else opac();
  }

  function karte(t, ziel) {
    var a = el("a", "sbck-karte");
    a.href = link(t);
    if (ziel) { a.target = ziel; if (ziel === "_blank") a.rel = "noopener"; }
    a.title = t.t + (t.a ? " – " + t.a : "");
    a.setAttribute("aria-label", t.t + (t.a ? ", " + t.a : "") + (STATUS[t.st] ? ", " + STATUS[t.st] : ""));
    var cover = el("div", "sbck-cover");
    var info = el("div", "sbck-info");
    info.setAttribute("aria-hidden", "true");
    info.appendChild(el("b", "", t.t));
    if (t.a) info.appendChild(el("span", "", t.a));
    if (STATUS[t.st]) info.appendChild(el("i", t.st, [t.j, STATUS[t.st]].filter(Boolean).join(" · ")));
    cover.appendChild(info);
    if (t.isbn) {
      cover.sbckTitel = t;
    } else {
      ersatz(cover, t);
    }
    a.appendChild(cover);
    return a;
  }

  // Jeder Titel ein Listeneintrag; das Band ordnet sie spaltenweise in zwei Reihen an
  function gruppen(titel, ziel) {
    return titel.map(function (t) {
      var li = el("li", "sbck-platz");
      li.appendChild(karte(t, ziel));
      return li;
    });
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
    var alle = el("a", "", "Alle Neuerwerbungen ›");
    alle.href = "https://opac2.stadtbibliothek-chemnitz.de/webOPACClient/actual.do?methodToCall=show";
    kopf.appendChild(alle);
    box.appendChild(kopf);

    if (!titel.length) {
      if (opt.leer === "ausblenden") { box.hidden = true; return; }
      box.appendChild(el("p", "sbck-leer", "Zurzeit keine Neuerwerbungen in dieser Auswahl."));
      return;
    }

    var rahmen = el("div", "sbck-rahmen");
    var band = el("ul", "sbck-band");
    gruppen(titel, opt.ziel).forEach(function (g) { band.appendChild(g); });
    var zurueck = el("button", "sbck-pfeil sbck-zurueck");
    var vor = el("button", "sbck-pfeil sbck-vor");
    zurueck.innerHTML = '<svg viewBox="0 0 30 60" aria-hidden="true"><polyline points="26,4 4,30 26,56"/></svg>';
    vor.innerHTML = '<svg viewBox="0 0 30 60" aria-hidden="true"><polyline points="4,4 26,30 4,56"/></svg>';
    zurueck.type = vor.type = "button";
    zurueck.setAttribute("aria-label", "Vorherige Titel");
    vor.setAttribute("aria-label", "Weitere Titel");
    zurueck.onclick = function () { band.scrollBy({ left: -band.clientWidth * 0.9 }); };
    vor.onclick = function () { band.scrollBy({ left: band.clientWidth * 0.9 }); };
    function pfeile() {
      zurueck.disabled = band.scrollLeft < 5;
      vor.disabled = band.scrollLeft + band.clientWidth >= band.scrollWidth - 5;
    }
    band.addEventListener("scroll", pfeile, { passive: true });
    // Breiten aendern sich, sobald Cover geladen sind
    band.addEventListener("load", pfeile, true);
    window.addEventListener("resize", pfeile);
    rahmen.appendChild(zurueck);
    rahmen.appendChild(band);
    rahmen.appendChild(vor);
    box.appendChild(rahmen);
    pfeile();

    // Cover erst laden, wenn die Karte in die Naehe des sichtbaren Bereichs kommt
    var offen = band.querySelectorAll(".sbck-cover");
    if ("IntersectionObserver" in window) {
      var beobachter = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) {
          if (!e.isIntersecting) return;
          beobachter.unobserve(e.target);
          coverLaden(e.target);
        });
      }, { rootMargin: "300px 600px" });
      for (var i = 0; i < offen.length; i++) if (offen[i].sbckTitel) beobachter.observe(offen[i]);
    } else {
      for (var j = 0; j < offen.length; j++) if (offen[j].sbckTitel) coverLaden(offen[j]);
    }
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
