# Research: Industrie-Cheats als MP-Client

Stand: 2026-05-20 · Spiel-Build ~16788644 (UE 5.3.2)

## Problem

Als **Client** auf fremdem Server ändert `CurrentItemsNum` per Memory-Write nur den lokalen Struct.  
Spiel-HUD und Server bleiben beim echten Lagerstand (z. B. Eisenerz 0/1000).

## Was im Binary gefunden wurde

### Storage-Felder (bestätigt)

| Property (UE5) | RROx-Mapping |
|----------------|--------------|
| `CurrentItemsNum` | `Astorage.currentamountitems` |
| `MaxItemsNum` | `Astorage.maxitems` |
| `MinItemsNum` | `Astorage.minitems` |

Kein zweites Anzeige-Feld wie `DisplayedItems` im Shipping-EXE-Stringdump.

### UI / Sync

- `UpdateStorageWidget` — nahe `ATrainNetworkManager`, `AStorage`
- `UpdateIndustryWidget` — Industrie-HUD-Aktualisierung
- `ServerUpdateIndustryArrays` / `ServerUpdateGameStateIndustryArrays` — vermutlich Host/GameMode-Sync

### Vielversprechende Server-RPCs

Wahrscheinlich auf **`AARRPlayerController`** (große Gruppe Admin/Gameplay-RPCs):

| RPC | Vermutung |
|-----|-----------|
| **`ServerAddItem`** | Item/Ladung zu Lager hinzufügen — **Top-Kandidat** |
| `ServerRemoveFreight` | Ladung entfernen |
| `ServerUseFreight` | Ladung nutzen |
| `ServerToggleFreightLoading` | Belade-Modus |
| `ServerChangeTenderFuel` | Tender-Kohle (Server) |
| `ServerAddBoilerFuel` | Kessel-Kohle (Server) |
| `ServerSetPlayerMoney` / `ServerChangePlayerMoney` | Geld (Server) |
| `ServerSpawnIndustry` | Industrie spawnen (Admin) |

**Kein** `ServerSetStorage`, `ServerFillIndustry` o. Ä. gefunden.

### Vergleich Geld-Cheat

RROx nutzt `ChangePlayerMoney` (BlueprintCallable). Im Binary existiert zusätzlich  
`ServerChangePlayerMoney` — vermutlich ruft BP auf Client intern die Server-RPC auf.  
**Hypothese:** `ServerAddItem` (oder ein BP-Wrapper `AddItem`) könnte analog funktionieren.

## Vorbereitet in RROx (Stand 2026-05-20)

| Datei | Inhalt |
|-------|--------|
| `plugins/world/src/controller/structs/beta-UE5/arr/ARRPlayerController.ts` | `AddItem`, `ServerAddItem`, weitere Server-RPCs (Signatur-Hypothese) |
| `plugins/world/src/controller/structs/beta-UE5/Engine/Controller.ts` | Basis `AController` |
| `plugins/world/src/controller/structs/beta-UE5/Engine/PlayerController.ts` | `APlayerController` |
| `plugins/world/src/controller/world.ts` | `getLocalPlayerController()` |
| `plugins/world/src/controller/industryServerRpc.ts` | Prototyp: mehrere Signatur-Versuche |
| Einstellung `features.experimentalIndustryServerRpc` | Schalter unter Settings → Features |
| Karte: „Server-RPC test (Experiment)“ | Nur MP-Client + Experiment-Flag |

**Nach Struct-Dump:** `ServerAddItem`-Parameter in `ARRPlayerController.ts` korrigieren, ggf. überflüssige Versuche in `industryServerRpc.ts` entfernen.

## Live-Dump (Spiel laufend, 2026-05-21)

Vollständige Dumps: `docs/research/dump-*.txt`

### Wichtigste Erkenntnis

**`ServerAddItem` existiert nicht auf `AARRPlayerController`.**  
Die Binary-String-Gruppierung war irreführend — die RPC sitzt auf **`ASCharacter`**, aber mit **Inventar**-Parametern, nicht Storage:

```
Function arr.SCharacter.ServerAddItem
  MyInventory -> Class arr.InventoryComponent [Parm]
  MyItem      -> Class arr.Item [Parm]
```

**Kein `ServerAddFreight` / `ServerFillStorage` gefunden.**

### Storage-relevante RPCs (verifiziert)

| RPC | Klasse | Parameter |
|-----|--------|-----------|
| `ServerRemoveFreight` | `SCharacter` | `Storage` (arr.Storage), `amount` (int32) |
| `ServerUseFreight` | `SCharacter` | `Freight`, `side`, `playerUnloaderName` |
| `ServerToggleFreightLoading` | `SCharacter` | `interactiveActor` |
| `ServerUpdateGameStateIndustryArrays` | `ARRPlayerController` | (keine Params) |
| `AddFreight` | `Storage` | `amount` (int32) — **nur BlueprintCallable, kein Server-RPC** |

### `arr.Storage` Felder

| Property | Typ |
|----------|-----|
| `CurrentItemsNum` | FloatProperty |
| `MaxItemsNum` | (im Dump, siehe dump-Storage.txt) |
| `MinItemsNum` | (im Dump) |

### Fazit für MP-Client-Cheats (2026-05-21 — **abgeschlossen**)

Live-Tests am Smelter (Industrie #18, Eisenerz Input[1], Client Capitano):

| Test | Ergebnis Speicher | Ergebnis Spiel-HUD |
|------|-------------------|-------------------|
| RPC-Autotest, `ServerRemoveFreight(-988)` | 12 → 1000 | **12/1000** |
| Finale Tests: Controller-Sync | ARRPlayerController nicht gefunden | — |
| Finale Tests: nur RemoveFreight | 12 → 1000 | **12/1000** |

Industrie-Lager **auffüllen** per Client-RPC **funktioniert nicht** — nur lokaler Speicher.  
Praktische Lösung: **RROx am Host** attached.

Übersicht „Was geht als Client?“: [mp-client-capabilities.md](./mp-client-capabilities.md)

~~Experiment UI (Server-RPC-Buttons)~~ — entfernt; Einstellung `experimentalIndustryServerRpc` bleibt unsichtbar (Default: aus).

## Nächste Schritte (Experiment)

~~Offen~~ — **geschlossen** (2026-05-21). Keine weiteren Client-RPC-Versuche geplant.

## Risiken

- RPC nur für **Host/Admin** erlaubt → Client bekommt stillen Fehler
- Anti-Cheat / Berechtigungen (`ServerSetPlayerPermissions` existiert)
- Falsche Signatur → Crash / Desync

## Tools

- `scripts/research-dump-struct.ps1` — Struct-Dump via Node 18 + Inject
- `scripts/list-game-structs.mjs` — UObject-Namen filtern (`Storage`, `Industry`, `AddItem`)
