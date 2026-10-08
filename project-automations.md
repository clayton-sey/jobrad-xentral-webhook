# Projekt & Logistik Automatisierungen

Dieses Dokument beschreibt die Automatisierungen, die durch den **Project Agent** (Teil des Jobrad/Leasing-Servers) gesteuert werden. 

Das Skript scannt alle 15 Minuten automatisch Xentral nach neuen Aufträgen und wendet logistische Regeln basierend auf **Tags (Labels)** an, ohne dass manuelle Projekteinstellungen nötig sind.

## Aktive Regeln

### 1. Ladenabholung (Clayton Shop)
Wenn ein Kunde sein Bike physisch im Laden in Hamburg abholt, muss der Warenbestand aus dem Ladeninventar abgebucht werden (in Xentral abgebildet über das Projekt "Kauf Kunde" / ID 5).

- **Trigger (Tag):** `Abholung Hamburg`
- **Aktion:** Das Skript setzt das Projekt des Auftrags hart auf `Kauf Kunde` (ID 5).
- **Zweck:** Physischer Lagerbestand im Laden stimmt mit Xentral überein.

### 2. Versand (Fulfiller)
Wenn ein Bike oder Zubehör verschickt wird, muss der Auftrag zwingend vom Haupt-Fulfiller abgewickelt werden. Liegt auf dem Auftrag fälschlicherweise das Shop-Projekt, blockiert dies den Versand.

- **Trigger (Tags):** `Direktversand` ODER `B2B Versand`
- **Aktion:** Das Skript **löscht** das Projekt "Kauf Kunde" aus dem Auftrag (Projektfeld wird geleert).
- **Zweck:** Der Auftrag läuft automatisch in den Standard-Versandprozess eures externen Logistikers.

---

## Technische Notizen
- Die Automatisierung benötigt keine Xentral-Webhooks.
- Das Skript greift bei Konflikten durch (z.B. wenn jemand manuell "Direktversand" taggt, aber das Projekt auf "Kauf Kunde" belässt, wird das Projekt nach max. 15 Minuten gelöscht).
- Die Automatisierungslogik liegt in der Datei `project-agent.ts`.
