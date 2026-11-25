# GeoFS SAM Network — BAGHDAD

**Version:** 3.6.0  
**Platform:** GeoFS 4.0  
**Type:** Userscript / Military Simulation Add-on

## Overview

GeoFS SAM Network — BAGHDAD is a military simulation add-on for GeoFS that introduces a network of 13 simulated surface-to-air missile (SAM) sites positioned around Baghdad, Iraq.

The add-on creates an interactive air-defense environment with ground launcher vehicles, simulated missile launches, countermeasures, unguided rockets, machine-gun effects, explosions, and realistic visual and audio effects.

The goal is to make military-style flying in GeoFS more immersive through detailed environmental effects, interactive systems, and an integrated HUD.

## Features

### Air Defense Network
- 13 simulated SAM sites positioned around Baghdad.
- Multiple simulated air-defense system types.
- Ground launcher vehicles at every site.
- Automatic tracking and engagement behavior.
- Individual site status and reload behavior.
- Destroyed sites remain visually identifiable.

### Visual Effects
- 3D missile and rocket models.
- Realistic-looking smoke trails.
- Persistent smoke columns that gradually expand and fade.
- Fireball and explosion effects.
- Black smoke from destroyed sites.
- Visible flares and chaff.
- Expanding explosion rings.
- Aircraft view shake from nearby explosions and hits.

### Audio Effects
- Custom-generated missile launch sounds.
- Rocket ignition and flight sounds.
- Layered explosion audio.
- Machine-gun audio effects inspired by the M61A2.
- Flare and chaff dispensing sounds.
- Master audio processing to improve the overall sound mix.

### Defensive Countermeasures
- Flare dispensing.
- Chaff dispensing.
- Simulated missile decoy behavior.
- Visual and audio feedback when countermeasures are released.

### Weapons Systems
- Unguided rocket simulation.
- Machine-gun simulation.
- Visible projectile effects.
- Simulated damage and destruction of SAM sites.

### HUD & Radar
The add-on includes a custom military-style HUD displaying:

- **THREAT:** Nearest active SAM site.
- **STATUS:** Current network status.
- **RANGE:** Distance to the nearest active site.
- **ALTITUDE:** Current aircraft altitude.
- **INBOUND:** Number of incoming simulated missiles.
- **SEEKER:** Type of incoming missile seeker.
- **DECOYED:** Number of missiles diverted by countermeasures.
- **CLOSEST:** Distance to the closest incoming missile.
- **SITES:** Number of operational sites.
- **ROCKETS:** Rocket system status.
- **HITS TAKEN:** Number of hits registered.

The radar scope displays the aircraft, SAM locations, incoming missiles, and rockets.

## Controls

| Key | Function |
|---|---|
| `,` | Dispense flares |
| `.` | Dispense chaff |
| `L` | Fire rockets |
| `/` | Hold to fire machine gun |
| `J` | Arm / disarm SAM network |

The HUD also includes clickable buttons for flares, chaff, and rockets.

**Note:** The machine gun requires holding `/`. Releasing the key stops firing.

## Installation

### Requirements
- GeoFS
- A userscript manager such as Tampermonkey
- A supported desktop browser

### Setup

1. Install Tampermonkey in your browser.
2. Open the Tampermonkey dashboard.
3. Create a new userscript.
4. Paste the complete SAM Network script into the editor.
5. Save the script.
6. Open or refresh GeoFS.

The add-on should initialize automatically once GeoFS has loaded.

### Important Installation Notes

- Keep `@grant none` in the userscript header.
- The script relies on GeoFS and Cesium being accessible through the page.
- No external 3D model downloads are required.
- Terrain sampling is used to position ground vehicles.
- The script is designed around the GeoFS 4.0 environment.

## Technical Information

The add-on uses:
- JavaScript
- CesiumJS
- HTML Canvas
- Web Audio API
- Browser animation frames
- Procedurally generated visual effects

The 3D world effects use Cesium entities and billboard collections. The HUD and radar scope use a separate canvas overlay.

The script also includes safeguards against duplicate initialization.

## Troubleshooting

**HUD does not appear**
- Check that Tampermonkey is enabled.
- Make sure the userscript is saved and enabled.
- Refresh GeoFS.

**Only the radar scope appears**
- Check whether Cesium is available.
- Allow GeoFS time to finish loading.
- Check the diagnostic message in the HUD.

**Ground vehicles are missing**
- Check whether the terrain provider has loaded.
- Try refreshing GeoFS.

**No audio**
- Interact with the simulator to allow browser audio playback.
- Check your browser's audio permissions and volume.

**Script does not initialize**
- Check the browser console for `[SAM]` messages.
- Make sure another copy of the script is not already running.

## Development History

### Version 3.6.0 — Airframe Shake
- Added aircraft view shake from nearby explosions.
- Added stronger shake effects when the aircraft takes a hit.
- Improved visual feedback from nearby events.

### Version 3.5.0 — Smoke & Audio
- Redesigned smoke trails.
- Added master audio processing.
- Improved machine-gun audio.
- Improved rocket launch sounds.
- Redesigned explosion audio.

### Version 3.4.0 — Explosions & Tracking
- Added expanded explosion effects.
- Improved simulated missile tracking.
- Improved hit detection.
- Added destroyed-site smoke.
- Improved machine-gun effects.

### Version 3.3.0 — Network Improvements
- Improved engagement timing.
- Standardized network reload behavior.
- Reduced HUD clutter.
- Improved launch notifications.

### Version 3.2.0 — Rendering Overhaul
- Improved Cesium screen projection.
- Removed expensive range-ring rendering.
- Added ground launcher vehicles.
- Added terrain height sampling.
- Redesigned smoke rendering.
- Added 3D projectile bodies.

## Credits

**Project:** GeoFS SAM Network — BAGHDAD  
**Version:** 3.6.0  
**Author:** SAM Network Workbench

Thanks to the GeoFS community and the developers whose work and documentation help make simulator add-ons possible.

---

*GeoFS SAM Network is an unofficial community-made simulation add-on. It is not affiliated with or endorsed by GeoFS.*
