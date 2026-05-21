# RROx als MP-Client (fremder Server)

Stand: 2026-05-21 · Getestet: Capitano auf Freundes-Server, Smelter Eisenerz 12/1000

## Kurzfassung

| Bereich | Client | Host |
|---------|--------|------|
| Karte, Position, Industrie-Standorte | ja | ja |
| Teleport (eigener Charakter) | ja* | ja* |
| Lok-Steuerung / Weichen / Kran-RPC | ja* | ja* |
| Lager-Cheats **Lok** (Wasser, Kohle, Kessel, Bremsluft, Speed) | ja* | ja* |
| Güter auf **eigenem** Waggon | ja* | ja* |
| Industrie-Lager (Smelter, Mine, …) | **nein** | ja* |
| Geld/XP-Cheats | unsicher / oft lokal | eher ja* |
| Rolling-Stock Reset (Position) | nein | ja* |

\* Feature in Settings → Features aktivieren + **Attach** (Home).

## Industrie-Lager — Forschung abgeschlossen

Tests (Log: `Industry RPC autotest`, `Industry RPC focus`, 2026-05-21):

- `ServerRemoveFreight(-988)` auf Eisenerz **Input[1]**: lokaler Speicher 12→1000, **Spiel-Legende bleibt 12/1000**
- `ServerUpdateGameStateIndustryArrays`: **ARRPlayerController am Client nicht im Speicher** → Test nicht ausführbar
- Kein `ServerAddFreight` / `ServerFillStorage` im Spiel

**Fazit:** Server entscheidet über Industrie-Lager. RROx-Client kann höchstens lokalen Speicher und Map-Anzeige verzerren.

Details: [industry-mp-client-cheats.md](./industry-mp-client-cheats.md)

## Was du als Client nutzen kannst

### Karte & Navigation

- Live-Karte: Spieler, Loks, Wagen, Gleise, Industrien (26 via Instance-Scan)
- Namen, Entfernung, **Teleport Here**, Zentrieren, Zu mir
- Session-Badge **Client** (orange) — Lagerstände wie im Spiel, wenn sync ok

### Cheats an der **Lok** (Map → Lok → Open Controls)

- Presets (Betriebsbereit, …)
- Kessel / Tender / Bremsluft / Speed-Boost / Immer voll
- Güter auf dem **Zug** (Freight-Slot), nicht Industrie-Lager

### Sonstiges

- **Settings → Features:** Control Engines, Switches, Teleport, Cranes
- Industrie-Tab: Übersicht, Wirtschaft (nur Anzeige)
- Krane per RPC ansteuern (Spiel-Mechanik, kein Lager-Cheat)

### Nur Host

- Industrie „Immer voll“, alle Slots, RPC-Forschung (ohnehin ergebnislos)
- Framecar-Reset (Position zurücksetzen)
- Industrie-Lager im Spiel wirklich ändern

## Empfehlung

Industrie-Material am fremden Server: **normal spielen** (Wagen, Kran, Liefern) oder Host bitten / selbst Host werden.
