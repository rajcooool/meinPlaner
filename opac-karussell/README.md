# Medienkarussell für den webOPAC

Zeigt die Neuerwerbungen der Stadtbibliothek Chemnitz als Cover-Karussell. Jeder Titel verlinkt direkt auf seine Vollanzeige im OPAC.

## Dateien

| Datei | Zweck |
|---|---|
| `karussell.js` | Das Karussell: Darstellung, Styles, Pfeil-Navigation. |
| `neuerwerbungen.js` | Die Titeldaten aller Neuerwerbungslisten. Wird von `aktualisieren.py` erzeugt. |
| `aktualisieren.py` | Liest die Listen aus dem OPAC neu ein (nur Python-Standardbibliothek). |
| `beispiel.html` | Beispielseite mit vier Karussells. |

## Einbinden

Beide JS-Dateien auf einen Webserver legen, den der OPAC erreicht. Dann an der gewünschten Stelle einfügen:

```html
<div class="sbc-karussell" data-listen="Krimis" data-titel="Neue Krimis"></div>

<script src="https://IHR-SERVER/opac-karussell/neuerwerbungen.js"></script>
<script src="https://IHR-SERVER/opac-karussell/karussell.js"></script>
```

Die beiden `<script>`-Zeilen braucht es nur einmal pro Seite, auch bei mehreren Karussells.

### Optionen

| Attribut | Bedeutung | Standard |
|---|---|---|
| `data-listen` | Listenname(n) aus dem OPAC, kommagetrennt, oder `alle` | `alle` |
| `data-titel` | Überschrift | „Neu: “ + Listenname |
| `data-anzahl` | Höchstzahl der Titel | 30 |
| `data-nur-verfuegbar` | `ja` zeigt nur ausleihbare Titel | aus |
| `data-reihenfolge` | `liste` oder `zufall` | `liste` |
| `data-ziel` | Linkziel, z. B. `_blank` | gleiches Fenster |

Die Listennamen sind die `ListName`-Werte aus dem OPAC, zum Beispiel `Romane`, `Krimis`, `Utop`, `Jugend`, `Hoerbuecher`, `Romane Schulkinder`, `Sach Schulkinder`, `Vorschulkinder`, `Allerkleinsten`, `Regionales`.

## Links und Cover

- **Links:** `start.do?Query=-1="ISBN"` öffnet die Vollanzeige des Titels direkt. Ohne ISBN wird nach dem Titel gesucht. Links der Form `singleHit.do?…&identifier=-1_Romane` funktionieren nur in einer Sitzung, in der die Liste vorher geöffnet wurde. Von einer anderen Seite aus führen sie auf „Diese Sitzung ist nicht mehr gültig“.
- **Cover:** kommen aus dem MVB-Coverdienst der DNB (`portal.dnb.de/opac/mvb/cover.htm?isbn=…`). Gibt es kein Cover, zeigt das Karussell eine farbige Karte mit Titel und Autor.

## Daten aktualisieren

```sh
python3 aktualisieren.py
```

Das Skript überschreibt `neuerwerbungen.js`. Es lässt sich z. B. täglich per Cronjob ausführen. Der Ausleihstatus ist immer der Stand dieses Abrufs.
