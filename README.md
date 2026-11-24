# GeoFS SAM Site Network (`GeoFS-SAM-Site`)

A self-contained userscript that adds a simulated Surface-to-Air Missile (SAM) air-defense network, RWR scope, countermeasures (flares & chaff), and SEAD capabilities directly into GeoFS. It reads your aircraft position every frame, runs engagement logic for each battery, and draws 3D rings, missiles, and flare trails into the GeoFS scene—nothing is sent externally.

---

## Installation

1. **Install Tampermonkey:** Add the Tampermonkey extension to Chrome, Edge, or Firefox (any userscript manager that accepts a `.user.js` file works).
2. **Create the script:** Open the Tampermonkey dashboard, click the `+` tab, delete the default template, and paste the contents of `GeoFS-SAM-Site.user.js`.
3. **Save and fly:** Save with `Ctrl + S`, then load GeoFS. The network arms itself as soon as your aircraft spawns, and the control panel appears in the top-right corner.
4. **Tune & update:** To change ranges, systems, or network behavior, edit the script and replace the old code in Tampermonkey—it will reload on the next page refresh.

---

## Controls

| Key / Input | Action |
| :--- | :--- |
| `,` | **Dispense two flares** — defeats IR seekers |
| `.` | **Dispense two chaff bundles** — defeats radar seekers |
| `L` | **Fire SEAD missile** at the nearest live battery — destroys it |
| `J` | **Arm or disarm** the whole SAM network |
| `W` / `S` | **Test range only** — climb or descend through the engagement band |
| **Panel Buttons** | Touch-screen buttons for countermeasures and SEAD |

---

## What You See and Hear

* **Batteries:** Every site is drawn as a 3D launcher with its radar and a name label, sitting inside its engagement ring.
* **Smoke and Fire:** Launches throw a smoke cloud, missiles trail smoke all the way in, and every detonation flashes, throws burning fragments, and leaves a column of smoke over the wreck.
* **Countermeasures:** Flares burn bright, flicker, and trail their own smoke; chaff blooms as a pale cloud drifting behind your aircraft.
* **Synthesized Sound:** Launch, detonation, flare pop, and the rumble of a battery coming apart are synthesized directly in the browser—no external audio files required.
* **RWR Scope:** The top-right panel carries a heading-up radar scope showing live batteries, inbound missiles, and wrecks at their true bearing and range out to **70 km**.

---

## How an Engagement Runs

1. **Search:** A battery remains idle until your aircraft crosses its engagement ring. Inside the ring, it starts its lock timer (`SEARCH` → `TRACK` in the panel).
2. **Engagement Envelope:** Lock only occurs inside the altitude band (default **1,000 to 18,000 ft**). Inside the ring but too low or too high, the site displays `TOO LOW` or `TOO HIGH` and its lock timer bleeds away.
3. **Launch:** Once locked, the site fires and begins reloading. Ammunition is unlimited and launchers alternate between heat-seeking (IR) and radar-seeking rounds.
4. **Guidance:** Missiles fly turn-limited pursuit—they always point at your aircraft, but are limited by airframe G-limits. Hard turns and altitude changes bleed missile energy.
5. **Decoys:** Every `0.2s`, an inbound missile checks for countermeasures in its seeker cone within **3.5 km** (flares for IR seekers, chaff for radar seekers). Closer decoys have a higher chance of spoofing the missile permanently.
6. **Fighting Back (SEAD):** Pressing `L` launches an anti-radiation missile at the nearest live battery within **90 km**, destroying it and removing its ring and launchers for the rest of the session.
7. **Impact:** Inside the proximity fuse radius, your aircraft is marked destroyed, the panel scores the hit, and (if grace is enabled) the network holds fire for **9 seconds** while you reset your flight.

---

## Systems Catalogue

| System | Max Range | Seeker Type | Reload Time |
| :--- | :---: | :---: | :---: |
| **SA-2 Guideline** | 45 km | RADAR | 50 s |
| **SA-3 Goa** | 25 km | RADAR | 40 s |
| **SA-6 Gainful** | 24 km | RADAR | 32 s |
| **SA-8 Gecko** | 12 km | RADAR | 24 s |
| **SA-13 Gopher** | 5 km | IR | 18 s |
| **SA-15 Tor** | 12 km | RADAR | 20 s |
| **SA-18 Igla** | 5 km | IR | 14 s |
| **MIM-104 Patriot** | 70 km | RADAR | 60 s |

---

## Honest Limits

* **Unofficial Add-On:** Hooks into GeoFS's internal aircraft and scene objects, so future simulator updates may affect rendering. If the panel appears without 3D visuals, open the browser console (`F12`) and check the `[SAM]` debug lines.
* **No Native Damage Model:** GeoFS does not physically destroy aircraft. Hits are logged on the panel—use GeoFS's built-in reset to fly again.
* **Local Simulation:** Flares, chaff, and SAM sites only exist locally while the script is running.
* **Simplified Radar Physics:** Missiles are simulated without radar horizons, terrain masking, or Doppler notch filters. Ranges are straight-line, and the altitude band uses GeoFS's reported sea-level altitude rather than true radar altitude (AGL) over mountains.
