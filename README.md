# D&D DM-Dashboard – Foundry-Exporter

Version **0.30.0**. Autor: Daniel Brune (incl. ChatGPT-KI-Assistent).

Das Modul exportiert ausdrücklich ausgewählte Foundry-Daten für ein externes Initiative-Tracker-/Archivprojekt. Es liest bestehende Dokumente ausschließlich; keine Änderungen an Charakteren, Compendien oder Kämpfen.

## Installation
In Foundry unter **Zusatzmodule → Modul installieren** diese Manifestadresse verwenden:

https://github.com/666Arukard/DM-Dashboard-Exporter/releases/latest/download/module.json

Alternativ das ZIP aus den Releases in den Foundry-Datenordner `Data/modules` entpacken. Der resultierende Ordner heißt `dnd-dm-exporter` und enthält direkt die `module.json`. Anschließend das Modul in der Welt aktivieren.

## Nutzung
Als Spielleiter den rechten Reiter **DM-Export** unmittelbar vor den Einstellungen öffnen. Charaktere, Monster, Items/Zauber/Charakteroptionen oder Welt-Journals ausdrücklich auswählen und **JSON-Export** verwenden. Spieler sehen den Exportreiter nicht.

**Direktübertragung** benötigt die separat entwickelte Windows-Archivanwendung. Diese ist nicht Bestandteil dieses Repositories. Ohne diese Anwendung steht der JSON-Export zur Verfügung. Foundry und das Verbindungsfenster müssen bei Direktübertragung geöffnet bleiben; keine unbeaufsichtigte Synchronisation.

## Unterstützter Umfang
- Welt-Charaktere und Compendium-Monster mit Grundwerten, Details, eingebetteten Fähigkeiten/Items/Zaubern und kleinen Porträts/Tokenbildern.
- Eigenständige Compendium-Items, Zauber und Charakteroptionen.
- Welt-Journals mit Überschriften, Bildseiten und direkt eingebetteten Textbildern als Offline-PNG.
- Netzwerk-Auswahl bis 50 Einträge, bei Compendien aus einem Compendium über mehrere Ordner. Einzelne Ausgabearten unterstützen weiterhin nur JSON-Einzelexport; die Dialoge weisen darauf hin.
- JSON-Dateien maximal 3 MiB insgesamt, Netzwerkpakete maximal 3 MiB je Eintrag. Actor-Bilder maximal 256 Pixel/64 KiB, Journalbilder maximal 1024 Pixel/512 KiB, heruntergeladene Originalbilder maximal 4 MiB.

Keine automatische Komplettfreigabe, kein Rückimport nach Foundry. Verlinkte Dokumente/@Embed werden nicht automatisch aufgelöst; PDFs, Videos, Compendium-Journals und Abenteuer sind noch nicht enthalten. Keine Kampagnendaten oder D&D-Inhalte werden mitgeliefert.

## Kompatibilität und Prüfung
Foundry **14.369**, D&D5e **6.1.0**: API-/Quellprüfung und automatisierte Tests, siehe [Prüfbericht](docs/compatibility-0.30.0.md). Die tatsächliche Nutzerabnahme dieser Kombination steht noch aus. Ältere geprüfte Systemstände 6.0.3–6.0.6 bleiben unterstützt. Neuere ungeprüfte dnd5e-Versionen sind mit Warnhinweis zugelassen; andere Foundry-Generationen nicht.
DDB Importer zuletzt gemeldet: **7.6.1**. Er ist keine Laufzeitabhängigkeit; seine installierte Version wird nur als Herkunftsinformation mitgeführt. Das ist keine pauschale Prüfung aller durch DDB importierten Inhalte.

## Entwicklung und Paketerstellung
Node.js ab 22 für Tests, Python 3 für das Buildskript:

```sh
node --test tests/*.test.mjs
python tools/build_release.py
```

Das Buildskript verwendet eine Positivliste und prüft Manifest, Modulversion und lokale Imports. Ausgabe: `dist/dnd-dm-exporter-0.30.0.zip` und `dist/module.json`. GitHub Actions prüft Pushes/PRs; ein Tag `v0.30.0` erstellt das GitHub-Release mit beiden Dateien.

Kontakt: Discord **arukard**, **daniel@brunecoaching.de**, https://dnd.brunecoaching.de
