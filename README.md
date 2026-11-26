GeoFS SAM Network — BAGHDAD
Version: 4.7.0
Type: GeoFS userscript
File: geofs-sam-baghdad.user.js
Overview
GeoFS SAM Network — BAGHDAD is a standalone userscript that adds an air-defense and combat scenario to GeoFS. It places a network of 18 preset surface-to-air missile (SAM) sites around Baghdad and the Zagros region, adds opposing F-16 aircraft, and provides a friendly Navy F/A-18 wingman.

The script also adds an on-screen HUD, 3D ground vehicles, weapon effects, smoke trails, aircraft damage, and crash effects. It uses GeoFS's existing Cesium environment and aircraft model resources.
Features
- 18 preset SAM sites distributed around Baghdad and the Zagros region.
- 3D launcher vehicles placed at each preset site.
- Two F-16 bandits that can be spawned 20 statute miles (about 32.19 km) from the player's current position.
- Navy F/A-18 wingman that flies with the player and can operate in different modes.
- Player weapons and countermeasures, including rockets, AIM-9 missiles, a gun, flares, and chaff.
- Custom field SAM sites that can be placed at the player's current location using the panel.
- HUD and status panel with network information, controls, messages, and diagnostics.
- 3D effects for missile and rocket bodies, smoke trails, fire, explosions, and aircraft crashes.
- Weather-aware aircraft finish for supported model shaders.
- WGS84 positioning for placing world objects using GeoFS/Cesium coordinates.
Requirements
- GeoFS loaded in a WebGL-capable browser.
- A userscript manager that supports page-context execution, or access to the browser's developer console.
- Permission for the userscript manager to run scripts on GeoFS.
The script is configured for these GeoFS URL patterns:
- geo-fs.com
- geofs.com
- Their subdomains
No separate API key, companion script, workbench account, or manual model upload is specified as required by the script.
Installation
Option 1: Userscript manager
1. Open your userscript manager.
2. Create a new userscript.
3. Copy the entire contents of geofs-sam-baghdad.user.js into the editor.
4. Save the script.
5. Make sure the manager is allowed to run it on GeoFS and that page-context execution is enabled.
6. Load GeoFS and allow the simulator to finish loading.
Option 2: Browser developer console
1. Open GeoFS and wait until the simulator has fully loaded.
2. Open the browser's developer console.
3. Paste the entire script into the console.
4. Run it.
The userscript metadata uses @grant none and @inject-into page. Keep these settings: the script accesses GeoFS's own page objects.
Controls
Key	Action
, (comma)	Dispense flares
. (period)	Dispense chaff
U	Cycle between rockets and AIM-9
L	Fire the selected weapon
Shift + U	Rearm after ammunition is depleted
/ (slash, hold)	Fire the gun while held
J	Arm the SAM network


The HUD also provides clickable controls for several actions, including countermeasures, weapon selection and firing, rearming, spawning F-16s, selecting a battery to teleport to, and resetting the scenario.
HUD and field-site panel
The on-screen interface includes a network status panel and a field-site spawner.
- Network panel: shows scenario status and communications messages.
- F-16 spawn control: creates the opposing aircraft relative to the player's current position.
- Wingman mode: offers AUTO, FORMATION, and ENGAGE behavior.
- Battery selection / GO: lets the player select a listed site and teleport to it.
- Field-site spawner: allows a custom radar or infrared site to be placed at the player's location. A newly placed field site starts OFFLINE; use the panel's activation control to bring placed field sites online.
- Reset: resets the scenario.
Aircraft and scenario behavior
- The two F-16s approach from approximately 20 statute miles away.
- The Navy F/A-18 starts near the player and can follow, engage nearby threats, and defend itself.
- The wingman has 1,000 gun rounds and 16 unguided rockets.
- The script models aircraft damage and crash effects.
- Downed AI aircraft burn and fall under gravity, then produce another explosion when they contact terrain.
- AI aircraft do not automatically respawn.
Visuals and model loading
The script attempts to load aircraft assets from GeoFS's own model library. The F/A-18 uses the Navy multiplayer texture (livery 1), rather than the Blue Angels paint scheme.

Geometric fallback airframes are included so aircraft can remain represented if a model or texture fails to load. The HUD/diagnostics can report when a model is using a fallback.

The world-positioning code uses WGS84 coordinates to align 3D objects with GeoFS/Cesium's ellipsoid. Smoke and fire effects use Cesium world billboards when available.
Diagnostics
Open the browser developer console and run:
geofsSAM.diagnostics()
This prints a status report that includes information such as GeoFS/Cesium availability, aircraft state, visual-layer status, wingman state, aircraft phases, and HUD mounting.

The script also logs startup messages with the [SAM] prefix.
Troubleshooting
- Nothing appears: confirm GeoFS has fully loaded before running the script, and check that the browser supports WebGL.
- Userscript does not start: confirm the userscript manager permits page-context execution and has permission to run on the GeoFS domain.
- An aircraft model is missing: check the console and diagnostics. The script includes geometric fallback visuals for model-loading failures.
- The script says it is already online: it detected the window.__SAMNET flag and did not start a second instance. Reloading the GeoFS page clears the page's runtime state.
- The script reports an incomplete source template: use the complete script exported by the workbench rather than a partial/template source.
Notes
- The script is designed to run inside GeoFS, not as a standalone web page.
- The simulation and its visual effects depend on GeoFS's runtime objects and Cesium.
- Browser extensions may require additional site permissions.
- Performance will vary with browser, hardware, and the number of active visual effects and entities.
