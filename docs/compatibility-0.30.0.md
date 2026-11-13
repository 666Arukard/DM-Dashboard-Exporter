# Prüfung 0.30.0 – 13.11.2026

## Nachweise
- Foundry 14.369: https://foundryvtt.com/releases/14.369 (Stable 11). Änderungen an Zertifikatsbereitstellung, Compendium-Ordnern, Dialogen und Dokumentverarbeitung gesichtet. Unsere lesenden Zugriffe, rechte Sidebar und DialogV2 verwenden weiterhin die Foundry-14-API. Keine Abschaltung von TLS-/Browser-Sicherheitsprüfungen. Keine Verwendung von getSubFolders, Combat.previous oder schreibenden Dokumentoperationen für den Export.
- dnd5e-Vergleich: https://github.com/foundryvtt/dnd5e/compare/release-6.0.6...release-6.1.0
- Ausgangscommit 87e94dbd9f930135e0694cd7e7d49f210603cd2c, Ziel 0f69e6d56435edcafcf56cf3ef6911ef8e8ca9cb. GitHub-Vergleich begrenzt auf 300 Dateien; deshalb vollständige nicht abgeschnittene Git-Bäume beider Tags zusätzlich verglichen. Alle 170 geänderten module-Dateien sind in den verfügbaren Patches enthalten. Prüfung auf die tatsächlich verwendeten Exportfelder fokussiert; keine Aussage über sämtliche Änderungen an Regelkompendien.
- Systemmanifest 6.1.0: mindestens Foundry 14.367, verified 14. Der Nutzerstand 14.369 erfüllt dies.

## Befund und Änderungen
- HP, RK, Initiative, passive Werte, CR, Sinne, Sprachen, Bewegung und Ressourcen bleiben über vorbereitete Felder verfügbar.
- Rüstungsbonus wird systemseitig später vorbereitet; Export liest das fertige armor.value ohne erneutes Addieren. Keine Würfel-/Prepare-/Migrationsaufrufe durch das Modul.
- Neue damageResistanceTypes (z.B. falling) werden bei der Bezeichnung von Resistenzen, Anfälligkeiten und Immunitäten zusätzlich berücksichtigt; Exportvertrag unverändert.
- Zusätzliche NPC-Statblocküberschreibungen tempHP und abilities werden als Anzeigetext übernommen. Numerische Originalwerte bleiben getrennt.
- ActivityCollection bietet zusätzliche Gruppierung; unser Zugriff über die vorhandenen Einträge/values bleibt erhalten. Änderungen an Reichweiten-/Gewichtskonvertierung, Advancement und Migration werden nicht selbst aufgerufen.
- Neue Fraktions-/Renown-Funktionen sind nicht Teil dieses Exportschritts. Keine neue automatische Datenauswahl.
- DDB Importer 7.6.1 wird nur als gemeldeter Nutzerstand/Herkunft geführt, nicht als pauschal geprüfte Inhaltsquelle.

## Prüfung und Grenzen
Die vollständige Dashboard-Testsuite wird vor Veröffentlichung lokal ausgeführt; die wichtigsten Versions-/Feldregressionen sind hier als synthetische Tests enthalten. GitHub CI prüft diese Tests und Paketinhalt. Kein neuer echter Foundry-/Hoster-Praxistest behauptet. Die Versionsfreigabe beruht auf API-/Quellprüfung und automatisierten Tests; Nutzerabnahme separat erforderlich.

## Nutzerprüfung
Modul aktualisieren, Foundry neu laden und als Spielleiter einloggen. Unter 14.369/6.1.0 dürfen die bisherigen Build-/Systemwarnungen nicht erscheinen. Einen Charakter, ein Monster, eine Rüstung/einen Zauber und ein Journal mit Bild exportieren. Werte und Bilder mit Foundry vergleichen. Bei Direktübertragung bleibt das Windows-Testprogramm 0.29.0 kompatibel.
