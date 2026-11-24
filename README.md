FIELD GUIDE
Running the network inside GeoFS
The export is a self-contained userscript. It reads your aircraft position every frame, runs the engagement logic for each battery, and draws the rings, missiles and flare trails into the GeoFS scene. Nothing is sent anywhere.
Install
1
Install Tampermonkey
Add the Tampermonkey extension to Chrome, Edge or Firefox. Any userscript manager that accepts a .user.js file works.
2
Create the script
Open the Tampermonkey dashboard, click the + tab, delete the template, and paste the script from the Script tab of this workbench.
3
Save and fly
Save with Ctrl+S, then load GeoFS. The network arms itself as soon as the aircraft exists — the panel appears top right.
4
Tune, then re-export
Change ranges, systems or network behaviour here, copy the script again and replace the old one. Tampermonkey reloads it on the next page load.
Controls
,
Dispense two flares — defeats IR seekers
.
Dispense two chaff bundles — defeats radar seekers
L
Fire a missile at the nearest battery — destroys it
J
Arm or disarm the whole network
W / S
Test range only — climb or descend through the engagement band
PANEL BUTTONS
Countermeasures and SEAD, for touch screens
What you see and hear
Batteries. Every site is drawn as a 3D launcher with its radar and a name label, sitting inside its engagement ring.
Smoke and fire. Launches throw a smoke cloud, missiles trail smoke all the way in, and every detonation flashes, throws burning fragments and leaves a column of smoke over the wreck.
Countermeasures. Flares burn bright, flicker and trail their own smoke; chaff blooms as a pale cloud drifting behind you.
Sound. Launch, detonation, flare pop and the rumble of a battery coming apart are synthesised in the browser, so there are no audio files to install.
Scope. The panel carries a heading-up scope: live batteries, inbound missiles and wrecks sit at their true bearing and range out to 70 km.
How a shot runs
Search. A battery is idle until your aircraft crosses its engagement ring. Inside the ring it starts its lock timer, shown as SEARCH then TRACK in the panel.
Envelope. Lock only happens inside the altitude band, default 1,000 to 18,000 ft. Inside the ring but too low or too high, the site shows TOO LOW or TOO HIGH and its lock timer bleeds away instead of firing.
Launch. When the lock timer completes the site fires and starts its reload. Ammunition is unlimited and the launchers alternate heat-seeking and radar-seeking rounds, so a battery can keep shooting but only so often.
Fighting back. L launches a missile at the nearest live battery inside 90 km. It homes on the site, detonates on it and takes it off the network for the rest of the session, along with its ring and its launchers.
Guidance. Each missile flies a turn-limited pursuit: it always points at the target but can only pull the G its airframe allows, so hard turns and altitude changes bleed its energy and buy you seconds.
Decoys. Every fifth of a second an inbound missile rolls against any countermeasure in its seeker cone, within 3.5 km. IR seekers look at flares, radar seekers look at chaff, and the closer the decoy the harder it is to ignore. A successful roll pulls the missile off you for good: it chases the decoy and detonates on it, so it can no longer fuse on the aircraft.
Impact. Inside the proximity fuse radius the aircraft is marked destroyed, the panel scores the hit, and — if grace is enabled — the network holds fire for nine seconds while you reset the flight.
Systems in the catalogue
SYSTEM	RANGE	SEEKER	RELOAD
SA-2 Guideline	45 km	RADAR	50 s
SA-3 Goa	25 km	RADAR	40 s
SA-6 Gainful	24 km	RADAR	32 s
SA-8 Gecko	12 km	RADAR	24 s
SA-13 Gopher	5 km	IR	18 s
SA-15 Tor	12 km	RADAR	20 s
SA-18 Igla	5 km	IR	14 s
MIM-104 Patriot	70 km	RADAR	60 s
Honest limits
This is an unofficial add-on. It hooks the simulator's own aircraft and scene objects, so a GeoFS update can move something out from under it. If the panel appears but nothing draws on the map, open the browser console and check the [SAM] lines.
GeoFS has no damage model. A hit is reported by the script and the aircraft is not physically destroyed — use GeoFS's own reset to start again.
Countermeasures are part of the script, not the simulator. Flares and chaff only exist while the network is running.
Missiles are simulated on the ground-side: no radar horizon, no terrain masking, no notch filter. Ranges are straight-line.
The altitude band uses the altitude GeoFS reports for your aircraft. Over rising terrain that is closer to height above sea level than true height above the ground.
