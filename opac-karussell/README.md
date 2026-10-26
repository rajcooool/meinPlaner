# Medienkarussell für den webOPAC

Zeigt die Neuerwerbungen der Stadtbibliothek Chemnitz als Cover-Karussell. Jeder Titel verlinkt direkt auf seine Vollanzeige im OPAC.

## Dateien

| Datei | Zweck |
|---|---|
| `karussell.js` | Das Karussell: Mosaik aus abwechselnd vier kleinen und einem großen Cover, Pfeil-Navigation, Titel beim Darüberfahren. Farben und Höhe lassen sich per CSS-Variablen (`--sbck-akzent`, `--sbck-hoehe`) anpassen. |
| `neuerwerbungen.js` | Die Titeldaten aller Neuerwerbungslisten. Wird von `aktualisieren.py` erzeugt. |
| `aktualisieren.py` | Liest die Listen aus dem OPAC neu ein und speichert die Cover (nur Python-Standardbibliothek). |
| `covers/` | Von `aktualisieren.py` gespeicherte Cover (`<ISBN>.jpg`). Nicht im Repository, entsteht beim ersten Lauf. |
| `beispiel.html` | Beispielseite mit je einem Karussell für alle 63 Neuerwerbungslisten des OPAC. |

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
| `data-leer` | `ausblenden` blendet das Karussell aus, wenn die Auswahl gerade leer ist | Hinweistext |

Die Listennamen sind die `ListName`-Werte aus dem OPAC, zum Beispiel `Romane`, `Krimis`, `Utop`, `Jugend`, `Hoerbuecher`, `Romane Schulkinder`, `Sach Schulkinder`, `Vorschulkinder`, `Allerkleinsten`, `Regionales`.

## Links und Cover

- **Links:** `start.do?Query=-1="ISBN"` öffnet die Vollanzeige des Titels direkt. Ohne ISBN wird nach dem Titel gesucht. Links der Form `singleHit.do?…&identifier=-1_Romane` funktionieren nur in einer Sitzung, in der die Liste vorher geöffnet wurde. Von einer anderen Seite aus führen sie auf „Diese Sitzung ist nicht mehr gültig“.
- **Cover:** `aktualisieren.py` lädt die Cover über den OPAC (`cover.jsp` → `showMVBCover.do`) und speichert sie in `covers/`. Das Karussell nimmt diese Dateien aus dem Ordner `covers/` neben `karussell.js`. Fehlt eine Datei, holt es das Cover live über den OPAC; das geht nur, wenn die Seite auf demselben Server wie der OPAC liegt. Sonst wird der DNB-Coverdienst versucht. Gibt es gar kein Cover, zeigt das Karussell eine farbige Karte mit Titel und Autor. Die Cover sind urheberrechtlich geschützt und nur für die Anzeige im Katalog lizenziert; deshalb liegen sie nicht im Repository.

## Daten aktualisieren

```sh
python3 aktualisieren.py
```

Das Skript überschreibt `neuerwerbungen.js` und ergänzt `covers/` neben dieser Datei. Schon vorhandene Cover lädt es nicht erneut; Cover von Titeln, die nicht mehr in den Listen stehen, löscht es. Der erste Lauf dauert wegen der Cover etwa 10 Minuten, spätere Läufe nur noch wenige Minuten. Es lässt sich z. B. täglich per Cronjob ausführen. Der Ausleihstatus ist immer der Stand dieses Abrufs.
