# AGENTS.md — RROx Extended (Capitano / MP-Client Fork)

Stand: 2026-05-21 · Branch: `master`

Diese Datei dokumentiert den Stand der Fork-Erweiterungen für Cursor-Agenten und Entwickler. Fokus: **RROx als MP-Client** auf fremden Servern, Lok-/Waggon-Cheats, Map-UX — **kein** zuverlässiges Industrie-Lager am Client.

---

## Schnellstart

| Schritt | Aktion |
|--------|--------|
| Build Map | `cd plugins/map && npm run build` |
| Build World | `cd plugins/world && npm run build` |
| Deploy | `powershell -File scripts/deploy-plugins.ps1` |
| Deploy-Ziel | `%APPDATA%\RailroadsOnline Extended\plugins\@rrox-plugins\{world,map}\dist` |
| RROx starten | `scripts/start-rrox.ps1` oder `_release\RailroadsOnline Extended.exe` manuell |
| Log | `%APPDATA%\RailroadsOnline Extended\logs\main.log` |

**Nach Plugin-Deploy: RROx neu starten**, dann **Home → Attach**.

---

## MP-Client: Was geht / was nicht

Ausführlich: [`docs/research/mp-client-capabilities.md`](docs/research/mp-client-capabilities.md)  
Industrie-RPC-Forschung (abgeschlossen): [`docs/research/industry-mp-client-cheats.md`](docs/research/industry-mp-client-cheats.md)

| Bereich | Client | Host |
|---------|--------|------|
| Karte, Teleport, Weichen, Krane | ✅ | ✅ |
| Lok-Steuerung (Control Engines) | ✅ | ✅ |
| Lager-Cheats **Lok/Waggon** (Wasser, Kohle, Kessel, Bremsluft, Speed, Güter am Zug) | ✅ | ✅ |
| **Immer voll** (Lok/Tender/Ladung, Kessel-Loops) | ✅ | ✅ |
| Industrie-Lager (Smelter, Mine, …) | ❌ | ✅ |
| Rolling-Stock Reset (Position) | ❌ | ✅ |

**Industrie-Lager am Client:** Server-authoritativ. `ServerRemoveFreight` ändert nur lokalen Speicher; Spiel-HUD bleibt beim Server (getestet Smelter #18, Eisenerz 12/1000). RPC-Forschung **geschlossen** — UI-Buttons entfernt.

---

## Wichtige Features (implementiert)

### World-Plugin (`plugins/world`)

- **UE5-Erkennung:** `determineVersion()` → `beta-UE5` Structs, Fallback `main-UE4`.
- **Instance-Scan:** Industrien/Loks wenn `GameState`-Arrays leer (MP-Client).
- **Cheats** (`controller/cheats.ts`):
  - Lager: Add/Max + **Immer voll** (200 ms Loop, FrameNumber-Stabilisierung).
  - Lok: Presets, Kessel/Bremsluft/Speed-Boost, Keep-Loops.
  - Spieler: Geld/XP, Fly/Sprint.
- **Communicators:** `locomotiveCheats.ts`, `storage.ts` (`SetStorageKeepFull`, `ApplyIndustryKeepAll`), `industryServerRpc.ts` (Backend-Forschung, UI entfernt).
- **ControlsSync** (`controlsSync.ts`): Gekuppelte Loks — Regler/Reverser/Bremse; Fix Master-Konflikt (niedrigerer Index gewinnt); Interval in `this.interval` gespeichert.
- **Struct-Health** (`structHealth.ts`): Log bei fehlenden kritischen Klassen.
- **Structs UE5:** u.a. `ARRPlayerController`, `SplineActorLive`, `eunloadside`, erweiterte `industry`/`storage`/`framecar`.

### Map-Plugin (`plugins/map`)

- **Map-Labels:** Lok-Namen, Industrie-Namen, optional Kessel-Badge (`DR % · H2O %`).
- **Tooltips:** Entfernung, Zentrieren, Zu mir, Koordinaten kopieren.
- **Client-Shortcuts** (`clientMapToolbar.tsx`): Meine Lok, Wasserturm/Sandhaus-Teleport, Betriebsbereit, Not-Aus entfernt (war Autopilot).
- **Cheats-UI:** `locomotiveCheatButtons`, `storageCheatButtons`, `frameCheatSliders` — **Nähe-Gate ~120 m** (Cheats deaktiviert wenn zu weit).
- **Session-Badge:** Host vs. Client.
- **Industrie:** Show Info immer; Host-Warnung; Live-Daten in `storageInfo.tsx`; Host-only Cheat-Buttons.
- **Rolling Stock:** Tab „In der Nähe“ (sortiert nach Entfernung).
- **Hooks:** `useMyLocomotive`, `useLocomotiveAlerts` (Kessel/Wasser/Bremsluft), `useLocomotiveKeepState`.
- **Teleport-Favoriten:** Rechtsklick-Karte → speichern/laden (`teleportFavorites.ts`).
- **Attach-Hinweis:** `attachHintBanner.tsx` wenn nicht attached.

### Bewusst **nicht** enthalten (entfernt)

- **KI-Autopilot** (Tempomat, Auto-Bremse, Gleis-Route, Weichen-Assist) — wieder entfernt auf Wunsch.

---

## Settings

**Settings → World → Features**

- `controlEngines`, `controlSwitches`, `teleport`, `cheats`, `controlCranes` — für Client-Nutzung relevant.
- `experimentalIndustryServerRpc` — deprecated, unsichtbar, Default aus.
- Hinweis-Alert: „Industrie-RPC-Forschung abgeschlossen“.

**Settings → Map**

- Label-Toggles (Spieler, Loks, Industrien, Kessel-Badge, …).

---

## Scripts (`scripts/`)

| Script | Zweck |
|--------|--------|
| `deploy-plugins.ps1` | World + Map nach AppData deployen |
| `deploy-map-plugin.ps1` | Nur Map |
| `start-rrox.ps1` | RROx starten |
| `research-dump-struct.ps1` | Struct-Dump (Spiel an, RROx zu) |
| `dump-struct.mjs` / `list-game-structs.mjs` | Low-Level Struct-Tools |
| `test-inject.mjs` | Injector-Test |

Struct-Dump-Beispiel:

```powershell
.\scripts\research-dump-struct.ps1 "Class arr.ARRPlayerController"
```

Ergebnisse liegen unter `docs/research/dump-*.txt`.

---

## DLL / Injector (`packages/dll`)

Anpassungen für stabilere Attach/Query auf UE5-Builds (Injector, Pipe, Scanner, UObjectArray). Nicht separat deployen — Teil des RROx-Release-Builds.

---

## Typische Workflows

### Als MP-Client spielen

1. RROx starten → Attach → **Cheats + Control Engines** an.
2. Lok markieren: Map → **Als Meine Lok**.
3. Cheats: **Open Controls** → Lager- & Lok-Cheats (**Immer voll** für Tender/Kessel).
4. Industrie: nur **lesen** (Show Info); Material normal liefern oder Host mit RROx.

### Nach Spiel-Patch

1. Attach prüfen, `main.log` auf Struct-Warnungen.
2. Devtools-Plugin oder `research-dump-struct.ps1` für geänderte Klassen.
3. `plugins/world/src/controller/structs/beta-UE5/` aktualisieren.
4. Build + deploy + RROx-Neustart.

### Plugin entwickeln

```powershell
cd plugins/world   # oder map
npm run build
cd ../..
powershell -File scripts/deploy-plugins.ps1
```

---

## Bekannte Grenzen

- Cheats an Lok nur sinnvoll **in Nähe** (~120 m) — UI blockiert, MP sonst unzuverlässig.
- `speedMs` in UE5 ≈ **cm/s** (Map teilt durch 44.704 für mph).
- Splines-Refresh default 10 s — Autopilot/Route wäre ohnehin veraltet (Autopilot entfernt).
- Geld/XP-Cheats am Client oft nur lokal.
- `_release/` und `_release.zip` sind Build-Artefakte — **nicht** committen.

---

## Datei-Landkarte (neu/wichtig)

```
plugins/world/src/controller/
  cheats.ts              # Keep-full, Lok-Cheats, Presets
  controlsSync.ts        # Multi-Engine Sync
  industryServerRpc.ts   # RPC-Forschung (Backend)
  structHealth.ts
  world.ts               # UE5, Instance-Scan, setControls

plugins/map/src/renderer/map/
  components/            # Cheats-UI, Toolbars, Badges, Warnings
  hooks/                 # useMyLocomotive, Alerts, KeepState
  utils/distance.ts      # NEAR_PLAYER_DISTANCE = 12000 (~120 m)

docs/research/           # MP-Client-Matrix, Industrie-RPC, Struct-Dumps
scripts/                 # Deploy, Start, Research
```

---

## Commit-Historie (Kontext)

Dieser Fork bündelt Session-Arbeit: MP-Client-World-Loader, Lok-Cheats mit Immer-voll, Map-UX für Client, abgeschlossene Industrie-RPC-Forschung, ControlsSync-Fixes, Entfernung des KI-Autopilot-Experiments.

Bei weiteren Agent-Aufgaben: **Industrie am Client nicht erneut als Cheat-Ziel** behandeln; Fokus Lok, Karte, Navigation, Host-only Industrie.
