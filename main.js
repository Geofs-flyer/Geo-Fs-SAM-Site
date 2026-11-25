// ==UserScript==
// @name         GeoFS SAM Network — BAGHDAD
// @namespace    geofs.sam.network
// @version      3.6.0
// @description  13 SAM sites around Baghdad: ground launcher vans, terrain-hugging missiles leaving smoke columns that hang and dissolve, flares, chaff and unguided rockets.
// @author       SAM Network workbench
// @match        *://*.geo-fs.com/*
// @match        *://geo-fs.com/*
// @match        *://*.geofs.com/*
// @match        *://geofs.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
  3.6 — the airframe rattles
  --------------------------
  * A blast nearby shakes the view, harder the closer it goes off: a missile
    decoyed onto your flare, a rocket into a battery you are low over. Out
    past 900 m you feel nothing.
  * A hit shakes hard for five seconds and then fades out. The shake is a
    transform on the Cesium canvas, not on the camera or the aircraft, so the
    controls stay exactly as they were and GeoFS's own camera keeps working.

  3.5 — trail and sound
  ---------------------
  * Trails read the way a solid-fuel motor does in daylight now: soft sandy
    puffs, translucent and overlapping with no hard core, and a narrow column
    that stops ballooning into a wall as it ages.
  * The whole mix runs through a master bus with a compressor on it, so
    everything sits much louder without clipping.
  * The gun is a real M61A2: a deep thump under a hard crack, with the pitch
    drifting round to round so a burst rips instead of looping one sample.
  * Rockets announce themselves: an ignition crack, a wide accelerating hiss
    and a rumble under it.
  * Explosions are three events instead of one filtered swoop: the crack of a
    casing letting go, a low body rolling out, and a sub-bass thump under both.

  3.4 — explosions, tracking, gun
  -------------------------------
  * Explosions are real now: a fireball that blooms and dies, black smoke
    rolling out of it and hanging, the expanding ring, and the bang. A rocket
    into a battery, a missile into you, and a missile decoyed onto a flare or
    chaff all get one.
  * Missiles lead you. They aim at where the aircraft will be after the time
    of flight and only switch to your real position in the last half second,
    with four times the turn authority they had. A missile aimed at where you
    were is a missile that flies past you.
  * Hits are tested along the whole step, not at the end of it. At 1150 m/s a
    missile covers 57 metres a frame, so a 45 metre hit sphere could be stepped
    clean over. That was most of the "it went for the vicinity" feeling.
  * A destroyed battery smokes: a short black column, about 80 ft, that keeps
    going so you can see which sites are down.
  * The machine gun kills batteries too, and now sounds like a 20 mm M61A2:
    a deep thump under a hard crack instead of a hiss.

  3.3 — fire rate and clutter
  ---------------------------
  * A battery locks in one second now instead of 2.2, then takes a flat
    30 second reload. Every system used to have its own 14–50 second
    reload, so the network felt sluggish and then uneven. Now it snaps
    onto you immediately and each battery goes quiet for half a minute.
  * Name plates: only the closest battery and any battery actually
    tracking or launching at you show their system name. Thirteen
    labels at once was the busiest thing on the screen.
  * The launch banner is announced once per wave rather than on every
    launch, so a salvo no longer strobes across the top of the view.

  3.2 — what changed and why
  --------------------------
  * Projector: now resolves the camera through window.Cesium +
    SceneTransforms.worldToWindowCoordinates first, the same path the
    military addon uses and the one that actually exists in 4.0. The old
    geofs.api.Cesium / cartesianToCanvasCoordinates lookup is only a
    fallback. This is why the world layer used to sit at "scope only".
  * Range rings are gone. Thirty-two projected points per site, four
    times a second, was the biggest per-frame cost in the script, and
    points behind the camera still came back as finite coordinates, so
    they streaked across the viewport as those yellow circles. Nothing
    draws them now: the scope and the site icons carry the picture.
  * Ground models: five launcher vans per site, built from Cesium
    geometry (no GLB fetch, so nothing can silently 404). Heights come
    from sampleTerrainMostDetailed, so they sit on the ground instead
    of at sea level.
  * Smoke: missiles and rockets now lay a real column from the launcher
    to the impact point. Puffs are spaced by distance flown rather than
    by frame, so the trail is the same density at any speed, and each
    puff lives 9 seconds and keeps expanding, so it hangs in the air
    after the impact and thins out slowly instead of blinking away.
    The thin trail line is still there under it, just quieter.
  * Missiles get a short vertical boost out of the launcher before they
    turn onto the target.
  * World layer: the smoke is now a Cesium BillboardCollection and every
    missile and rocket is a real cylinder in the scene. The 2D overlay
    painted on top of everything, cockpit interior included, which is why
    you saw smoke through the instrument panel. Cesium depth-tests, so the
    panel wins, and the GPU carries the particles instead of the CPU.
  * Machine gun on "/" — hold it down. Rounds leave the nose at 900 a
    minute and inherit the aircraft's own velocity.

  @grant stays "none" on purpose. Adding a grant moves the script into
  Tampermonkey's sandbox, where window.geofs and window.Cesium are gone.
*/

(function () {
  'use strict';

  if (window.__SAMNET) {
    console.log('[SAM] already online');
    return;
  }
  window.__SAMNET = true;

  var CONFIG = {
    lockTime: 1.0,
    reload: 30,
    launchFlashGap: 3,
    turnBoost: 4,
    columnHeight: 24,
    maxSimultaneous: 6,
    hitRadius: 45,
    minAltFt: 1000,
    maxAltFt: 18000,
    flareEffect: 0.7,
    chaffEffect: 0.35,
    decoyRange: 3500,
    decoyLife: 7,
    scopeSpan: 70000,
    scopeSize: 210,
    vehiclesPerSite: 5,
    smokeGap: 115,
    rocketSmokeGap: 45,
    smokeLife: 9,
    gunRpm: 900,
    gunSpeed: 1050,
    gunLife: 2.2
  };

  var SITES = [
    { id: 'baghdad-0', name: 'BIAP — Baghdad Intl', short: 'BIAP', system: 'SA-2 Guideline', lat: 33.2625, lon: 44.2346, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50 },
    { id: 'baghdad-1', name: 'Camp Victory', short: 'VICTORY', system: 'SA-3 Goa', lat: 33.2833, lon: 44.1833, range: 25000, speed: 900, maxG: 16, seeker: 'RADAR', rounds: 4, reload: 40 },
    { id: 'baghdad-2', name: 'Rasheed AB', short: 'RASHEED', system: 'SA-6 Gainful', lat: 33.2417, lon: 44.5042, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32 },
    { id: 'baghdad-3', name: 'Taji Depot', short: 'TAJI', system: 'SA-6 Gainful', lat: 33.507, lon: 44.256, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32 },
    { id: 'baghdad-4', name: 'Tarmiyah North', short: 'TARMIYAH', system: 'SA-2 Guideline', lat: 33.65, lon: 44.38, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50 },
    { id: 'baghdad-5', name: 'Muthanna Centre', short: 'MUTHANNA', system: 'SA-8 Gecko', lat: 33.33, lon: 44.4, range: 12000, speed: 650, maxG: 22, seeker: 'RADAR', rounds: 6, reload: 24 },
    { id: 'baghdad-6', name: 'Karrada', short: 'KARRADA', system: 'SA-13 Gopher', lat: 33.3, lon: 44.42, range: 5000, speed: 550, maxG: 20, seeker: 'IR', rounds: 8, reload: 18 },
    { id: 'baghdad-7', name: 'Sadr City', short: 'SADR', system: 'SA-8 Gecko', lat: 33.39, lon: 44.45, range: 12000, speed: 650, maxG: 22, seeker: 'RADAR', rounds: 6, reload: 24 },
    { id: 'baghdad-8', name: 'Abu Ghraib West', short: 'ABU GHRAIB', system: 'SA-3 Goa', lat: 33.32, lon: 44.15, range: 25000, speed: 900, maxG: 16, seeker: 'RADAR', rounds: 4, reload: 40 },
    { id: 'baghdad-9', name: 'Mahmudiyah South', short: 'MAHMUDIYAH', system: 'SA-13 Gopher', lat: 33.06, lon: 44.36, range: 5000, speed: 550, maxG: 20, seeker: 'IR', rounds: 8, reload: 18 },
    { id: 'baghdad-10', name: 'Balad', short: 'BALAD', system: 'SA-2 Guideline', lat: 33.94, lon: 44.362, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50 },
    { id: 'baghdad-11', name: 'Karbala Road', short: 'KARBALA RD', system: 'SA-18 Igla', lat: 32.9, lon: 44.2, range: 5000, speed: 600, maxG: 18, seeker: 'IR', rounds: 4, reload: 14 },
    { id: 'baghdad-12', name: 'Baqubah NE', short: 'BAQUBAH', system: 'SA-6 Gainful', lat: 33.75, lon: 44.64, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32 }
  ];

  // parked launcher vans around each battery: east offset, north offset, heading
  var VEHICLE_SLOTS = [
    { e: -20, n: 12, h: 24 },
    { e: -7, n: 20, h: 16 },
    { e: 7, n: 18, h: 6 },
    { e: 21, n: 8, h: -8 },
    { e: -28, n: -2, h: 42 }
  ];

  var MIN_ALT = CONFIG.minAltFt * 0.3048;
  var MAX_ALT = CONFIG.maxAltFt * 0.3048;
  var R = 6371000;
  var D2R = Math.PI / 180;
  var RAD2D = 180 / Math.PI;

  var state = {
    sites: [],
    missiles: [],
    bullets: [],
    gunHeld: false,
    gunAt: 0,
    flares: [],
    chaff: [],
    sead: [],
    bursts: [],
    smoke: [],
    columns: [],
    shake: { amp: 0, until: 0 },
    armed: true,
    kills: 0,
    hitUntil: 0,
    ppos: null,
    palt: 0,
    pvel: null,
    plla: null,
    heading: 0,
    prevPos: null,
    prevT: 0,
    flashText: '',
    flashUntil: 0,
    launchFlashAt: 0,
    canvas: null,
    projector: null,
    hud: null,
    hudAt: 0,
    fleet: [],
    fleetBuilt: false,
    heightsSampled: false,
    lastError: ''
  };

  /* ----------------------------- math ----------------------------- */

  function ecef(lat, lon, alt) {
    var phi = lat * D2R;
    var lam = lon * D2R;
    var r = (R + alt) * Math.cos(phi);
    return { x: r * Math.cos(lam), y: r * Math.sin(lam), z: (R + alt) * Math.sin(phi) };
  }

  function toLla(v) {
    var r = Math.sqrt(v.x * v.x + v.y * v.y);
    return {
      lat: Math.atan2(v.z, r) * RAD2D,
      lon: Math.atan2(v.y, v.x) * RAD2D,
      alt: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) - R
    };
  }

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
  function unit(a) { var l = len(a) || 1; return mul(a, 1 / l); }
  function dist(a, b) { return len(sub(a, b)); }

  // Shortest distance from a point to the segment a→b. A missile covers tens of
  // metres per frame, so testing only where it ended up let it pass straight
  // through the aircraft.
  function segDist(a, b, p) {
    var ab = sub(b, a);
    var ap = sub(p, a);
    var l2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
    if (l2 < 1e-9) return len(ap);
    var t = (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / l2;
    t = Math.max(0, Math.min(1, t));
    return dist(add(a, mul(ab, t)), p);
  }

  function bearingRange(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * D2R;
    var p2 = lat2 * D2R;
    var dl = (lon2 - lon1) * D2R;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    var hs = Math.sin((p2 - p1) / 2) * Math.sin((p2 - p1) / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return { brg: Math.atan2(y, x), d: 2 * R * Math.asin(Math.min(1, Math.sqrt(hs))) };
  }

  /* --------------------------- engine hooks ----------------------- */

  function C3() {
    if (window.Cesium) return window.Cesium;
    var g = window.geofs;
    if (g && g.api && g.api.Cesium) return g.api.Cesium;
    return null;
  }

  function getViewer() {
    var g = window.geofs;
    return g && g.api && g.api.viewer ? g.api.viewer : null;
  }

  function readPlayer() {
    var g = window.geofs;
    if (!g || !g.aircraft || !g.aircraft.instance) return null;
    var inst = g.aircraft.instance;
    var cand = [];
    if (inst.llaLocation) cand.push(inst.llaLocation);
    if (inst.location) cand.push(inst.location);
    if (g.animation && g.animation.values && g.animation.values.llaLocation) {
      cand.push(g.animation.values.llaLocation);
    }
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i];
      if (c && typeof c[0] === 'number' && typeof c[1] === 'number') {
        var alt = typeof c[2] === 'number' && isFinite(c[2]) ? c[2] : null;
        if (alt === null) {
          var v = g.animation && g.animation.values;
          alt = v && typeof v.altitude === 'number' ? v.altitude * 0.3048 : 0;
        }
        return { lat: c[0], lon: c[1], alt: Math.max(0, alt) };
      }
    }
    return null;
  }

  // Screen projection. A point behind the camera still returns finite
  // coordinates from Cesium, so every point is tested against the camera
  // direction before it is trusted.
  function findProjector() {
    var C = C3();
    var viewer = getViewer();
    if (!C || !viewer || !viewer.scene) return null;
    var scene = viewer.scene;

    function inFront(cartesian) {
      var cam = scene.camera;
      if (!cam || !cam.positionWC || !cam.directionWC) return true;
      var d = C.Cartesian3.subtract(cartesian, cam.positionWC, new C.Cartesian3());
      return C.Cartesian3.dot(d, cam.directionWC) > 0;
    }

    function make(projectFn, kind) {
      return {
        kind: kind,
        project: function (lat, lon, alt) {
          var cart;
          try {
            cart = C.Cartesian3.fromDegrees(lon, lat, alt || 0);
          } catch (e) { return null; }
          if (!inFront(cart)) return null;
          var p;
          try { p = projectFn(cart); } catch (e) { return null; }
          if (!p || !isFinite(p.x) || !isFinite(p.y)) return null;
          return { x: p.x, y: p.y };
        }
      };
    }

    if (C.SceneTransforms && typeof C.SceneTransforms.worldToWindowCoordinates === 'function') {
      return make(function (cart) {
        return C.SceneTransforms.worldToWindowCoordinates(scene, cart);
      }, 'worldToWindowCoordinates');
    }
    if (typeof scene.cartesianToCanvasCoordinates === 'function') {
      return make(function (cart) {
        return scene.cartesianToCanvasCoordinates(cart);
      }, 'cartesianToCanvasCoordinates');
    }
    return null;
  }

  /* ------------------------- ground launchers --------------------- */

  function localQuat(C, enu, headingRad, tiltRad) {
    var rz = C.Matrix3.fromRotationZ(-headingRad);
    var rx = C.Matrix3.fromRotationX(tiltRad);
    var local = C.Matrix3.multiply(rz, rx, new C.Matrix3());
    var enuRot = C.Matrix4.getRotation(enu, new C.Matrix3());
    var world = C.Matrix3.multiply(enuRot, local, new C.Matrix3());
    return C.Quaternion.fromRotationMatrix(world);
  }

  function makeVehicle(C, viewer, site, slot, tint) {
    var lat = site.lat + slot.n / 111320;
    var lon = site.lon + slot.e / (111320 * Math.cos(site.lat * D2R));
    var ground = site.alt || 0;
    var heading = slot.h * D2R;

    var anchor = C.Cartesian3.fromDegrees(lon, lat, ground);
    var enu = C.Transforms.eastNorthUpToFixedFrame(anchor);

    var body = viewer.entities.add({
      position: C.Cartesian3.fromDegrees(lon, lat, ground + 1.5),
      orientation: localQuat(C, enu, heading, 0),
      box: {
        dimensions: new C.Cartesian3(2.5, 7.2, 2.4),
        material: C.Color.fromCssColorString(tint),
        outline: true,
        outlineColor: C.Color.fromCssColorString('#171a12')
      }
    });

    // launcher canister: raised 26 degrees, pointing out along the van
    var backE = -Math.sin(heading) * 1.7;
    var backN = -Math.cos(heading) * 1.7;
    var tubeLat = lat + backN / 111320;
    var tubeLon = lon + backE / (111320 * Math.cos(site.lat * D2R));

    var tube = viewer.entities.add({
      position: C.Cartesian3.fromDegrees(tubeLon, tubeLat, ground + 3.0),
      orientation: localQuat(C, enu, heading, -(Math.PI / 2 - 26 * D2R)),
      cylinder: {
        length: 5.4,
        topRadius: 0.55,
        bottomRadius: 0.8,
        material: C.Color.fromCssColorString('#6b6f5c'),
        outline: true,
        outlineColor: C.Color.fromCssColorString('#1d2018')
      }
    });

    return [body, tube];
  }

  function clearFleet() {
    var viewer = getViewer();
    if (viewer && viewer.entities) {
      for (var i = 0; i < state.fleet.length; i++) {
        try { viewer.entities.remove(state.fleet[i]); } catch (e) { /* already gone */ }
      }
    }
    state.fleet = [];
    for (var s = 0; s < state.sites.length; s++) state.sites[s].entities = [];
  }

  var TINTS = ['#4c5342', '#434a39', '#565d49', '#3f4636', '#505845'];

  function buildFleet() {
    var C = C3();
    var viewer = getViewer();
    if (!C || !viewer || !viewer.entities || !viewer.scene) return;
    clearFleet();
    for (var i = 0; i < state.sites.length; i++) {
      var site = state.sites[i];
      site.entities = [];
      var count = Math.min(CONFIG.vehiclesPerSite, VEHICLE_SLOTS.length);
      for (var k = 0; k < count; k++) {
        var pair = makeVehicle(C, viewer, site, VEHICLE_SLOTS[k], TINTS[k % TINTS.length]);
        site.entities.push(pair[0], pair[1]);
        state.fleet.push(pair[0], pair[1]);
      }
    }
    state.fleetBuilt = true;
  }

  function sampleHeights() {
    var C = C3();
    var viewer = getViewer();
    if (!C || !viewer || !viewer.terrainProvider || state.heightsSampled) return;
    state.heightsSampled = true;

    var cartos = state.sites.map(function (s) {
      return C.Cartographic.fromDegrees(s.lon, s.lat);
    });

    function apply(list) {
      for (var i = 0; i < list.length && i < state.sites.length; i++) {
        var c = list[i];
        if (c && isFinite(c.height)) {
          state.sites[i].alt = c.height;
          state.sites[i].ecef = ecef(state.sites[i].lat, state.sites[i].lon, c.height);
        }
      }
      buildFleet();
    }

    if (typeof C.sampleTerrainMostDetailed === 'function') {
      C.sampleTerrainMostDetailed(viewer.terrainProvider, cartos)
        .then(apply)
        .catch(function () {
          for (var i = 0; i < state.sites.length; i++) {
            state.sites[i].alt = 0;
            state.sites[i].ecef = ecef(state.sites[i].lat, state.sites[i].lon, 0);
          }
          buildFleet();
        });
    } else {
      for (var i = 0; i < state.sites.length; i++) {
        var h = 0;
        try {
          var got = viewer.scene.globe.getHeight(cartos[i]);
          if (got !== undefined && got !== null && isFinite(got)) h = got;
        } catch (e) { h = 0; }
        state.sites[i].alt = h;
        state.sites[i].ecef = ecef(state.sites[i].lat, state.sites[i].lon, h);
      }
      buildFleet();
    }
  }

  /* --------------------------- overlay canvas --------------------- */

  var OVERLAY_CSS =
    '#sam-overlay{position:fixed;inset:0;width:100vw;height:100vh;z-index:9990;pointer-events:none;display:block}' +
    '#sam-net{position:fixed;top:84px;right:14px;z-index:99998;width:228px;padding:9px 10px 8px;border:1px solid rgba(224,178,74,.45);border-radius:5px;background:rgba(8,10,14,.88);color:#e9e4d9;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;box-shadow:0 12px 34px rgba(0,0,0,.55)}' +
    '#sam-net .hd{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.16em;color:#e0b24a;margin-bottom:6px}' +
    '#sam-net .hd i{width:6px;height:6px;border-radius:50%;background:#3fbf7f;display:inline-block}' +
    '#sam-net .hd i.bad{background:#ff5a3c}' +
    '#sam-net .gr{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:10px;color:#9aa2ad}' +
    '#sam-net .gr b{color:#e9e4d9;font-weight:500;text-align:right}' +
    '#sam-net .cm{display:flex;gap:6px;margin-top:8px}' +
    '#sam-net button{flex:1;padding:5px 4px;border:1px solid rgba(224,178,74,.35);border-radius:3px;background:rgba(224,178,74,.1);color:#e0b24a;font:10px ui-monospace,monospace;letter-spacing:.1em;cursor:pointer}' +
    '#sam-net button:hover{background:rgba(224,178,74,.22)}' +
    '#sam-net .hint{margin-top:6px;font-size:9px;color:#6d747e;letter-spacing:.08em}' +
    '#sam-net .diag{margin-top:5px;font-size:9px;color:#5c636d;letter-spacing:.06em;border-top:1px solid rgba(224,178,74,.16);padding-top:4px}' +
    '#sam-net .diag.warn{color:#ff8a72}';

  function buildOverlay() {
    if (!document.body) return null;
    var cv = document.getElementById('sam-overlay');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'sam-overlay';
      document.body.appendChild(cv);
    }
    state.canvas = cv;
    return cv;
  }

  /* ------------------------------ smoke --------------------------- */

  var SPRITES = {};

  function softSprite(key, inner, outer) {
    if (SPRITES[key]) return SPRITES[key];
    var size = 64;
    var cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    SPRITES[key] = cv;
    return cv;
  }

  // Soft, sandy and translucent, the way a solid-fuel trail reads in daylight:
  // overlapping puffs with no hard core.
  function smokeSprite() { return softSprite('smoke', 'rgba(232,207,176,0.9)', 'rgba(214,186,155,0)'); }

  // Fireball: a hot white core dropping through orange into nothing.
  function fireSprite() {
    if (SPRITES.fire) return SPRITES.fire;
    var size = 64;
    var cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,228,1)');
    g.addColorStop(0.42, 'rgba(255,158,48,0.86)');
    g.addColorStop(1, 'rgba(188,38,8,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    SPRITES.fire = cv;
    return cv;
  }
  function flareSprite() { return softSprite('flare', 'rgba(255,252,238,1)', 'rgba(255,120,30,0)'); }
  function chaffSprite() { return softSprite('chaff', 'rgba(235,244,255,0.9)', 'rgba(190,206,224,0)'); }

  function drawPuff(ctx, img, x, y, r, alpha) {
    if (alpha <= 0.008 || r <= 0.4) return;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  // One puff of a column: starts small at the nozzle, keeps expanding for
  // its whole life, then thins out. Long life is what makes the trail hang
  // in the air after the missile is gone.
  function addSmoke(pos, size, ttl, alpha, kind) {
    if (state.smoke.length > 900) state.smoke.shift();
    var life = ttl || CONFIG.smokeLife;
    var start = size || 4;
    var type = kind || 'light';
    state.smoke.push({
      lla: toLla(pos),
      life: life,
      ttl: life,
      size: start,
      // a fireball blooms outward fast, a smoke puff just swells
      // a fireball blooms outward fast, a smoke puff only creeps out, so the
      // trail stays a narrow column instead of swelling into a wall
      grow: type === 'fire' ? start * 3 : start * 0.25,
      alpha: alpha == null ? 0.2 : alpha,
      kind: type
    });
  }

  /* ------------------------ cesium world layer -------------------- */
  // Anything that belongs in the world is drawn by Cesium, not by the 2D
  // overlay: the overlay sits above the whole viewport, so it painted smoke
  // over the cockpit interior. Cesium depth-tests against the aircraft, and
  // billboards are one draw call instead of a per-puff canvas blit.

  var WORLD = { ready: false, tries: 0, pool: [], coll: null, smokeImg: null, fireImg: null, colors: {} };

  function initWorldLayer() {
    // Four real attempts only: a Cesium build without billboards must not
    // cost a failed sprite encode on every frame for the rest of the session.
    if (WORLD.ready || WORLD.tries > 4) return WORLD.ready;
    var C = C3();
    var viewer = getViewer();
    if (!C || !viewer || !viewer.scene || !viewer.scene.primitives) return false;
    if (!C.BillboardCollection || !C.Cartesian3) return false;
    WORLD.tries += 1;
    try {
      WORLD.smokeImg = smokeSprite().toDataURL();
      WORLD.fireImg = fireSprite().toDataURL();
      var coll = new C.BillboardCollection({ scene: viewer.scene });
      for (var i = 0; i < 900; i++) {
        WORLD.pool.push(coll.add({
          position: new C.Cartesian3(0, 0, 0),
          image: WORLD.smokeImg,
          scale: 1,
          show: false,
          color: C.Color.WHITE
        }));
      }
      viewer.scene.primitives.add(coll);
      WORLD.coll = coll;
      WORLD.ready = true;
      return true;
    } catch (e) {
      WORLD.ready = false;
      return false;
    }
  }

  // Alpha is quantised into 24 buckets and the Color objects are reused: the
  // billboard color setter marks the collection dirty, and one fresh Color
  // per puff per frame is garbage the collector then has to chase.
  function puffColor(C, a, kind) {
    var q = Math.max(0, Math.min(24, Math.round(a * 24)));
    var key = (kind || 'light') + q;
    if (!WORLD.colors[key]) {
      var base = kind === 'fire' ? C.Color.fromCssColorString('#ffa347')
        : kind === 'dark' ? C.Color.fromCssColorString('#2a2a2a')
          : C.Color.WHITE;
      WORLD.colors[key] = base.withAlpha(q / 24);
    }
    return WORLD.colors[key];
  }

  function syncSmoke() {
    if (!WORLD.ready) return;
    var C = C3();
    var list = state.smoke;
    var n = Math.min(list.length, WORLD.pool.length);
    for (var i = 0; i < WORLD.pool.length; i++) {
      var b = WORLD.pool[i];
      if (i >= n) {
        if (b.show) b.show = false;
        continue;
      }
      var p = list[i];
      var pk = p.life / p.ttl;
      if (!b.cart) b.cart = new C.Cartesian3();
      C.Cartesian3.fromDegrees(p.lla.lon, p.lla.lat, p.lla.alt, C.Ellipsoid.WGS84, b.cart);
      b.position = b.cart;
      var cap = p.kind === 'fire' ? 60 : 26;
      b.scale = Math.max(1, Math.min(cap, p.size)) / 32;
      var img = p.kind === 'fire' ? WORLD.fireImg : WORLD.smokeImg;
      if (b.image !== img) b.image = img;
      b.color = puffColor(C, p.alpha * Math.min(1, pk / 0.45), p.kind);
      b.show = true;
    }
  }

  /* ----------------------- missile / rocket bodies ---------------- */

  var ORI = null;

  function bodyGeometry(C, kind) {
    var missile = kind === 'missile';
    return {
      length: missile ? 6.5 : 3.4,
      topRadius: missile ? 0.07 : 0.04,
      bottomRadius: missile ? 0.36 : 0.17,
      material: C.Color.fromCssColorString(missile ? '#d8dbd0' : '#efe9d4')
    };
  }

  function placeBodies(C, viewer, list, kind) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o.body) {
        try {
          o.body = viewer.entities.add({
            position: C.Cartesian3.fromDegrees(o.lla.lon, o.lla.lat, o.lla.alt),
            cylinder: bodyGeometry(C, kind)
          });
        } catch (e) {
          o.body = null;
        }
        if (!o.body) continue;
      }
      C.Cartesian3.fromDegrees(o.lla.lon, o.lla.lat, o.lla.alt, C.Ellipsoid.WGS84, ORI.pos);
      C.Cartesian3.normalize(ORI.pos, ORI.up);
      ORI.dir.x = o.vel.x;
      ORI.dir.y = o.vel.y;
      ORI.dir.z = o.vel.z;
      C.Cartesian3.normalize(ORI.dir, ORI.dir);
      C.Cartesian3.cross(ORI.dir, ORI.up, ORI.right);
      if (C.Cartesian3.magnitude(ORI.right) < 1e-6) continue;
      C.Cartesian3.normalize(ORI.right, ORI.right);
      C.Cartesian3.cross(ORI.right, ORI.dir, ORI.tup);
      C.Matrix3.setColumn(ORI.m, 0, ORI.right, ORI.m);
      C.Matrix3.setColumn(ORI.m, 1, ORI.tup, ORI.m);
      C.Matrix3.setColumn(ORI.m, 2, ORI.dir, ORI.m);
      C.Quaternion.fromRotationMatrix(ORI.m, ORI.q);
      o.body.position = C.Cartesian3.clone(ORI.pos);
      o.body.orientation = C.Quaternion.clone(ORI.q);
    }
  }

  function syncBodies() {
    var C = C3();
    var viewer = getViewer();
    if (!C || !viewer || !viewer.entities) return;
    if (!ORI) {
      ORI = {
        up: new C.Cartesian3(), dir: new C.Cartesian3(), right: new C.Cartesian3(),
        tup: new C.Cartesian3(), pos: new C.Cartesian3(), m: new C.Matrix3(), q: new C.Quaternion()
      };
    }
    placeBodies(C, viewer, state.missiles, 'missile');
    placeBodies(C, viewer, state.sead, 'rocket');
  }

  function dropBody(o) {
    var viewer = getViewer();
    if (!o || !o.body) return;
    try { viewer.entities.remove(o.body); } catch (e) { /* already gone */ }
    o.body = null;
  }

  /* --------------------------- canvas drawing --------------------- */

  function drawBattery(ctx, s, c, showLabel) {
    var dead = s.alive === false;
    var hot = !dead && (s.status === 'TRACK' || s.status === 'LAUNCH');
    var accent = dead ? 'rgba(150,150,150,0.55)' : hot ? '#ff6a3d' : '#e0b24a';

    ctx.save();
    ctx.translate(c.x, c.y);

    if (!dead) {
      ctx.strokeStyle = hot ? 'rgba(255,106,61,0.32)' : 'rgba(224,178,74,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, hot ? 9 : 6.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, 1.9, 0, Math.PI * 2);
    ctx.fill();

    if (!dead && showLabel) {
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      var label = s.short + ' · ' + s.system;
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10,13,17,0.8)';
      ctx.fillRect(-tw / 2 - 4, -20, tw + 8, 14);
      ctx.fillStyle = hot ? '#ff8a72' : '#e6c063';
      ctx.fillText(label, 0, -10);
      ctx.textAlign = 'left';
    }

    if (dead) {
      ctx.strokeStyle = 'rgba(150,150,150,0.55)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-3.6, -3.6);
      ctx.lineTo(3.6, 3.6);
      ctx.moveTo(3.6, -3.6);
      ctx.lineTo(-3.6, 3.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(ctx) {
    var proj = state.projector;
    if (!proj) return;
    var i;

    // only the closest battery and any battery actually engaging you carry a
    // name plate: thirteen labels at once was the busiest thing on screen
    var nearestIdx = -1;
    var nearestD = Infinity;
    if (state.ppos) {
      for (i = 0; i < state.sites.length; i++) {
        if (state.sites[i].alive === false) continue;
        var nd = dist(state.sites[i].ecef, state.ppos);
        if (nd < nearestD) { nearestD = nd; nearestIdx = i; }
      }
    }

    for (i = 0; i < state.sites.length; i++) {
      var s = state.sites[i];
      var c = proj.project(s.lat, s.lon, (s.alt || 0) + 3);
      if (!c) continue;
      var hot = s.status === 'TRACK' || s.status === 'LAUNCH';
      drawBattery(ctx, s, c, hot || i === nearestIdx);
    }

    // Canvas smoke is only the fallback. With the Cesium layer up the puffs
    // are billboards, so the cockpit occludes them the way it should.
    if (!WORLD.ready) {
      for (i = 0; i < state.smoke.length; i++) {
        var puf = state.smoke[i];
        var sp2 = proj.project(puf.lla.lat, puf.lla.lon, puf.lla.alt);
        if (!sp2) continue;
        var pk = puf.life / puf.ttl;
        var r = Math.max(1, Math.min(26, puf.size));
        // hold density through most of the life, then thin out at the end
        drawPuff(ctx, puf.kind === 'fire' ? fireSprite() : smokeSprite(), sp2.x, sp2.y, r, puf.alpha * Math.min(1, pk / 0.45));
      }
    }

    for (i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      // the 3D body in the scene carries the missile; this dot only stands in
      // when Cesium refused to create the entity
      if (m.body) continue;
      var mp = proj.project(m.lla.lat, m.lla.lon, m.lla.alt);
      if (!mp) continue;
      ctx.fillStyle = m.decoy ? '#7fd7ff' : '#ff5a3c';
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = 0; i < state.sead.length; i++) {
      var rk = state.sead[i];
      if (rk.body) continue;
      var sp = proj.project(rk.lla.lat, rk.lla.lon, rk.lla.alt);
      if (!sp) continue;
      ctx.fillStyle = '#f6f2e6';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = 0; i < state.bullets.length; i++) {
      var bl = state.bullets[i];
      var b1 = proj.project(bl.plla.lat, bl.plla.lon, bl.plla.alt);
      var b2 = proj.project(bl.lla.lat, bl.lla.lon, bl.lla.alt);
      if (!b1 || !b2) continue;
      ctx.strokeStyle = 'rgba(255,224,130,0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
    }

    for (i = 0; i < state.flares.length; i++) {
      var f = state.flares[i];
      var fp = proj.project(f.lla.lat, f.lla.lon, f.lla.alt);
      if (!fp) continue;
      var burn = Math.max(0.15, f.life / CONFIG.decoyLife);
      drawPuff(ctx, flareSprite(), fp.x, fp.y, 4.5 + 2.5 * burn, 0.75 * burn);
      ctx.fillStyle = 'rgba(255,252,235,' + (0.95 * burn).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = 0; i < state.chaff.length; i++) {
      var cf = state.chaff[i];
      var cp = proj.project(cf.lla.lat, cf.lla.lon, cf.lla.alt);
      if (!cp) continue;
      var fade = Math.max(0, cf.life / CONFIG.decoyLife);
      var spread = 2 + (1 - fade) * 7;
      drawPuff(ctx, chaffSprite(), cp.x, cp.y, spread, 0.13 * fade);
      for (var kk = 0; kk < 4; kk++) {
        var cang = (cf.seed || 0) + (kk / 4) * Math.PI * 2;
        ctx.fillStyle = 'rgba(226,238,250,' + (0.5 * fade).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(cp.x + Math.cos(cang) * spread * 0.8, cp.y + Math.sin(cang) * spread * 0.55, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (i = 0; i < state.bursts.length; i++) {
      var b = state.bursts[i];
      var bp = proj.project(b.lla.lat, b.lla.lon, b.lla.alt);
      if (!bp) continue;
      var k = 1 - b.life / b.ttl;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, 5 + k * 34, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,178,87,' + Math.max(0, 0.6 - k * 0.8).toFixed(2) + ')';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  function drawScope(ctx, w, h) {
    var p = state.plla;
    if (!p) return;
    var size = CONFIG.scopeSize;
    var x0 = 14;
    var y0 = h - size - 14;
    var cx = x0 + size / 2;
    var cy = y0 + size / 2;
    var rad = size / 2 - 6;
    var span = CONFIG.scopeSpan;
    var head = state.heading || 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();

    ctx.fillStyle = 'rgba(6,10,13,0.9)';
    ctx.fillRect(x0, y0, size, size);

    ctx.strokeStyle = 'rgba(224,178,74,0.16)';
    ctx.lineWidth = 1;
    var i;
    for (i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (rad * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - rad);
    ctx.lineTo(cx, cy + rad);
    ctx.moveTo(cx - rad, cy);
    ctx.lineTo(cx + rad, cy);
    ctx.stroke();

    function plot(lat, lon, colour, sizePx, cross) {
      var br = bearingRange(p.lat, p.lon, lat, lon);
      var rr = Math.min(rad, (br.d / span) * rad);
      var ang = br.brg - head;
      var px = cx + Math.sin(ang) * rr;
      var py = cy - Math.cos(ang) * rr;
      if (cross) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - sizePx, py - sizePx);
        ctx.lineTo(px + sizePx, py + sizePx);
        ctx.moveTo(px + sizePx, py - sizePx);
        ctx.lineTo(px - sizePx, py + sizePx);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(px, py, sizePx, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = 0; i < state.sites.length; i++) {
      var s = state.sites[i];
      if (s.alive === false) {
        plot(s.lat, s.lon, 'rgba(140,140,140,0.7)', 2.6, true);
        continue;
      }
      var hot = s.status === 'TRACK' || s.status === 'LAUNCH';
      plot(s.lat, s.lon, hot ? '#ff6a3d' : '#e0b24a', hot ? 3 : 2.4, false);
    }
    for (i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      plot(m.lla.lat, m.lla.lon, m.decoy ? '#7fd7ff' : '#ff5a3c', 1.8, false);
    }
    for (i = 0; i < state.sead.length; i++) {
      plot(state.sead[i].lla.lat, state.sead[i].lla.lon, '#7fd7ff', 1.6, false);
    }

    ctx.fillStyle = '#7fe3b0';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(224,178,74,0.55)';
    ctx.font = '8px ui-monospace, monospace';
    ctx.fillText('70 KM', cx + 3, cy - rad + 9);
    ctx.fillText('HDG ' + String(Math.round(head)).padStart(3, '0'), x0 + 5, y0 + 11);
    ctx.restore();

    ctx.strokeStyle = 'rgba(224,178,74,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
  }

  function drawFlash(ctx, w, h, now) {
    var text = '';
    if (now * 1000 < state.flashUntil) text = state.flashText;
    var danger = false;
    var p = state.ppos;
    var i;
    if (p) {
      for (i = 0; i < state.missiles.length; i++) {
        if (state.missiles[i].decoy) continue;
        if (dist(state.missiles[i].pos, p) < 4000) {
          var ir = state.missiles[i].seeker === 'IR';
          text = 'MISSILE INBOUND — ' + (ir ? 'FLARES' : 'CHAFF');
          danger = true;
          break;
        }
      }
    }
    if (now * 1000 < state.hitUntil) {
      text = 'AIRCRAFT DESTROYED';
      danger = true;
    }
    if (!text) return;
    ctx.font = '600 13px ui-monospace, monospace';
    var tw = ctx.measureText(text).width;
    var bx = w / 2 - tw / 2 - 14;
    var by = h * 0.16;
    ctx.fillStyle = danger ? 'rgba(40,8,6,0.9)' : 'rgba(8,10,14,0.9)';
    ctx.fillRect(bx, by, tw + 28, 28);
    ctx.strokeStyle = danger ? 'rgba(255,80,60,0.7)' : 'rgba(224,178,74,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, tw + 27, 27);
    ctx.fillStyle = danger ? '#ff8a72' : '#e0b24a';
    ctx.fillText(text, bx + 14, by + 19);
  }

  function render(now) {
    var cv = state.canvas;
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (state.projector) drawWorld(ctx);
    drawScope(ctx, w, h);
    drawFlash(ctx, w, h, now);
  }

  /* ------------------------------ shake --------------------------- */

  var SHAKE = { el: null, on: false };

  // The camera belongs to GeoFS and is rebuilt every frame, so the shake is a
  // transform on the Cesium canvas instead: it moves the whole world view and
  // the airframe together, costs nothing, and cannot fight the flight model.
  function addShake(amp, seconds) {
    var now = performance.now() / 1000;
    if (now >= state.shake.until) state.shake.amp = amp;
    else state.shake.amp = Math.max(state.shake.amp, amp);
    state.shake.until = Math.max(state.shake.until, now + seconds);
  }

  function applyShake(now) {
    var viewer = getViewer();
    var el = viewer && viewer.canvas ? viewer.canvas : null;
    if (!el) return;
    if (SHAKE.el && SHAKE.el !== el) {
      SHAKE.el.style.transform = '';
      SHAKE.el = null;
      SHAKE.on = false;
    }
    var left = state.shake.until - now;
    var a = left > 0 ? state.shake.amp * Math.min(1, left / 1.6) : 0;
    if (a <= 0.06) {
      if (SHAKE.on) {
        SHAKE.el.style.transform = '';
        SHAKE.on = false;
      }
      return;
    }
    var x = (Math.sin(now * 61.7) * 0.62 + Math.sin(now * 103.1 + 1.3) * 0.38) * a;
    var y = (Math.sin(now * 71.3 + 0.7) * 0.62 + Math.sin(now * 89.7 + 2.1) * 0.38) * a;
    var r = (Math.sin(now * 43.1 + 0.4) * 0.5 + Math.sin(now * 97.9) * 0.5) * a * 0.1;
    // the 4% scale keeps the translated edges from showing
    el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) rotate(' +
      r.toFixed(3) + 'deg) scale(1.04)';
    SHAKE.el = el;
    SHAKE.on = true;
  }

  /* ------------------------------ audio --------------------------- */

  var SFX = (function () {
    var ctx = null;
    var buf = null;
    var gunAt = 0;
    function ac() {
      if (ctx) {
        if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* blocked until a gesture */ } }
        return ctx;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      return ctx;
    }
    function noise(c) {
      if (!buf) {
        var n = Math.floor(c.sampleRate * 0.9);
        buf = c.createBuffer(1, n, c.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      var s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      return s;
    }
    // One master bus for everything: the compressor keeps a full gun burst from
    // clipping and lets the whole mix sit far louder than the raw nodes did.
    var master = null;
    function bus(c) {
      if (master) return master;
      try {
        var out = c.createGain();
        out.gain.value = 1.7;
        var comp = c.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 20;
        comp.ratio.value = 8;
        comp.attack.value = 0.002;
        comp.release.value = 0.22;
        out.connect(comp);
        comp.connect(c.destination);
        master = out;
      } catch (e) {
        master = c.destination;
      }
      return master;
    }
    function whoosh(dur, f0, f1, gain, type, q, delay) {
      var c = ac();
      if (!c) return;
      var s = noise(c);
      var f = c.createBiquadFilter();
      var g = c.createGain();
      var t = c.currentTime + (delay || 0);
      f.type = type || 'lowpass';
      f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus(c));
      s.start(t); s.stop(t + dur + 0.05);
    }
    function tone(freq, dur, gain, type, to) {
      var c = ac();
      if (!c) return;
      var o = c.createOscillator();
      var g = c.createGain();
      var t = c.currentTime;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus(c));
      o.start(t); o.stop(t + dur + 0.02);
    }
    return {
      unlock: function () { ac(); },
      launch: function () { whoosh(1.1, 260, 1600, 0.16, 'bandpass', 1.4); tone(78, 0.6, 0.12, 'sine', 42); },
      // A real blast is three events: a hard crack as the casing lets go, a
      // wide low body that rolls out, and a sub-bass thump under both.
      explosion: function (k) {
        var g = Math.min(1, 0.5 * (k || 1));
        whoosh(0.22, 4200, 500, g * 0.85, 'bandpass', 0.8);
        whoosh(1.8, 900, 45, g * 1.1, 'lowpass', 0.7);
        whoosh(2.6, 300, 40, g * 0.6, 'lowpass', 0.5, 0.08);
        tone(64, 1.4, g * 0.9, 'sine', 26);
      },
      flare: function () { whoosh(0.18, 3000, 900, 0.06, 'bandpass', 2.2); },
      chaff: function () { whoosh(0.4, 5200, 1700, 0.045, 'highpass', 0.7); },
      // four rockets off the rails: an ignition crack, a wide hiss as they
      // accelerate away, and a rumble under it
      sead: function () {
        whoosh(0.12, 3800, 700, 0.42, 'bandpass', 1.0);
        whoosh(1.8, 240, 3000, 0.5, 'bandpass', 1.0);
        whoosh(1.5, 800, 90, 0.36, 'lowpass', 0.8);
        tone(58, 1.2, 0.3, 'sine', 30);
      },
      siteDown: function () { whoosh(1.7, 900, 50, 0.4, 'lowpass', 0.6); tone(42, 1.3, 0.26, 'sine', 20); },
      // 20 mm M61A2: a deep thump under a hard crack and the low body of the
      // report. The pitch drifts round to round so a burst reads as a ripping
      // Gatling roar instead of one sample looping.
      gun: function () {
        var t = performance.now();
        if (t - gunAt < 45) return;
        gunAt = t;
        var j = Math.random();
        tone(104 + j * 26, 0.12, 0.26, 'square', 38);
        whoosh(0.06, 5600 + j * 1400, 850, 0.24, 'bandpass', 1.2);
        whoosh(0.13, 1300, 150, 0.28, 'lowpass', 0.9);
      },
      deny: function () { tone(180, 0.16, 0.06, 'square', 130); }
    };
  })();

  /* ------------------------------- hud ---------------------------- */

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && el.textContent !== value) el.textContent = value;
  }

  function flash(text) {
    state.flashText = text;
    state.flashUntil = performance.now() + 1800;
  }

  function buildHud() {
    if (document.getElementById('sam-net') || !document.body) return;
    var style = document.getElementById('sam-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'sam-style';
      style.textContent = OVERLAY_CSS;
      document.head.appendChild(style);
    }
    var box = document.createElement('div');
    box.id = 'sam-net';
    box.innerHTML =
      '<div class="hd"><i id="sam-led"></i>SAM NETWORK</div>' +
      '<div class="gr">' +
      '<span>THREAT</span><b id="sam-threat">—</b>' +
      '<span>STATUS</span><b id="sam-status">—</b>' +
      '<span>RANGE</span><b id="sam-range">—</b>' +
      '<span>ALTITUDE</span><b id="sam-alt">—</b>' +
      '<span>INBOUND</span><b id="sam-inbound">0</b>' +
      '<span>SEEKER</span><b id="sam-seeker">—</b>' +
      '<span>DECOYED</span><b id="sam-decoyed">0</b>' +
      '<span>CLOSEST</span><b id="sam-closest">—</b>' +
      '<span>SITES</span><b id="sam-sites">0/0</b>' +
      '<span>ROCKETS</span><b id="sam-sead">READY</b>' +
      '<span>HITS TAKEN</span><b id="sam-kills">0</b>' +
      '</div>' +
      '<div class="cm"><button id="sam-flare">FLARES ∞</button><button id="sam-chaff">CHAFF ∞</button><button id="sam-rocket">ROCKETS</button></div>' +
      '<div class="hint">, flares · . chaff · L rockets · / gun · J arm</div>' +
      '<div class="diag" id="sam-diag">starting…</div>';
    document.body.appendChild(box);

    var fb = document.getElementById('sam-flare');
    var cb = document.getElementById('sam-chaff');
    if (fb) fb.addEventListener('click', function () { dispense('IR', 2); });
    if (cb) cb.addEventListener('click', function () { dispense('RADAR', 2); });
    var rb = document.getElementById('sam-rocket');
    if (rb) rb.addEventListener('click', function () { fireRockets(); });
    state.hud = box;
  }

  function diag(text, bad) {
    var el = document.getElementById('sam-diag');
    if (el && el.textContent !== text) {
      el.textContent = text;
      el.className = bad ? 'diag warn' : 'diag';
    }
    var led = document.getElementById('sam-led');
    if (led) led.className = bad ? 'bad' : '';
  }

  function updateHud(now) {
    if (!state.hud || now - state.hudAt < 0.12) return;
    state.hudAt = now;
    var p = state.ppos;
    var nearest = null;
    var nearestD = Infinity;
    var alive = 0;
    var i;
    for (i = 0; i < state.sites.length; i++) {
      var s = state.sites[i];
      if (s.alive !== false) alive += 1;
      if (!p || s.alive === false) continue;
      var d = dist(s.ecef, p);
      if (d < nearestD) { nearestD = d; nearest = s; }
    }
    var closest = Infinity;
    var cm = null;
    var decoyed = 0;
    for (i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      if (m.decoy) { decoyed += 1; continue; }
      if (!p) continue;
      var md = dist(m.pos, p);
      if (md < closest) { closest = md; cm = m; }
    }
    setText('sam-threat', nearest ? nearest.short : '—');
    setText('sam-status', state.armed ? (nearest ? nearest.status : 'IDLE') : 'DISARMED');
    setText('sam-range', nearest ? (nearestD / 1000).toFixed(1) + ' KM' : '—');
    setText('sam-alt', Math.round((state.palt || 0) * 3.281) + ' FT');
    setText('sam-inbound', String(state.missiles.length - decoyed));
    setText('sam-seeker', cm ? cm.seeker : '—');
    setText('sam-decoyed', String(decoyed));
    setText('sam-closest', closest < Infinity ? (closest / 1000).toFixed(1) + ' KM' : '—');
    setText('sam-sites', alive + '/' + state.sites.length);
    setText('sam-sead', state.sead.length ? state.sead.length + ' AWAY' : 'READY');
    setText('sam-kills', String(state.kills));

    if (!window.geofs) diag('window.geofs not found — is GeoFS loaded?', true);
    else if (!C3()) diag('Cesium not exposed yet', true);
    else if (!p) diag('waiting for aircraft position…', true);
    else if (!state.projector) diag('scope only · no screen projector', false);
    else diag('world ' + (WORLD.ready ? '3D' : '2D') + ' · ' + state.projector.kind + ' · ' + state.fleet.length / 2 + ' vans', false);
  }

  /* ----------------------------- weapons -------------------------- */

  function dispense(kind, count) {
    var p = state.ppos;
    if (!p) return;
    SFX.unlock();
    var isIR = kind === 'IR';
    var list = isIR ? state.flares : state.chaff;
    var pv = state.pvel || { x: 0, y: 0, z: 0 };
    var up = unit(p);
    var along = pv.x * up.x + pv.y * up.y + pv.z * up.z;
    var fwd = unit({ x: pv.x - up.x * along, y: pv.y - up.y * along, z: pv.z - up.z * along });
    if (!isFinite(fwd.x)) fwd = { x: 0, y: 0, z: 0 };

    for (var i = 0; i < count; i++) {
      var drop = 9 + Math.random() * 12;
      var behind = 8 + Math.random() * 18;
      var pos = add(add(p, mul(fwd, -behind)), mul(up, -drop));
      pos = add(pos, {
        x: (Math.random() - 0.5) * 7,
        y: (Math.random() - 0.5) * 7,
        z: (Math.random() - 0.5) * 4
      });
      list.push({
        pos: pos,
        vel: {
          x: pv.x * 0.72 - fwd.x * 7 - up.x * 16,
          y: pv.y * 0.72 - fwd.y * 7 - up.y * 16,
          z: pv.z * 0.72 - fwd.z * 7 - up.z * 16
        },
        life: CONFIG.decoyLife,
        kind: kind,
        seed: Math.random() * 6.283,
        lla: toLla(pos)
      });
    }
    if (isIR) SFX.flare(); else SFX.chaff();
    flash(isIR ? 'FLARES AWAY' : 'CHAFF AWAY');
  }

  function launch(site, target, pvel, now) {
    var from = site.ecef;
    var tof = dist(from, target) / site.speed;
    var aim = add(target, mul(pvel, tof * 0.5));
    var dir = unit(sub(aim, from));
    var up = unit(from);

    // boost straight up out of the launcher, then turn onto the target
    var boostDir = unit(add(mul(dir, 0.35), mul(up, 0.9)));

    var m = {
      site: site.id,
      name: site.name,
      short: site.short,
      seeker: site.seeker,
      pos: from,
      vel: mul(boostDir, site.speed * 0.3),
      speed: site.speed * 0.3,
      speedMax: site.speed,
      maxG: site.maxG,
      trail: [],
      life: 0,
      ttl: Math.max(22, (site.range / site.speed) * 2.6),
      decoy: null,
      nextRoll: 0,
      smokeGap: 0,
      lla: { lat: site.lat, lon: site.lon, alt: site.alt || 0 }
    };
    state.missiles.push(m);

    // ground smoke: the launch kicks up a column at the battery that stays
    // there and drifts away long after the missile has gone
    for (var q = 0; q < 10; q++) {
      addSmoke(add(from, {
        x: (Math.random() - 0.5) * 22,
        y: (Math.random() - 0.5) * 22,
        z: 2 + Math.random() * 14
      }), 7, CONFIG.smokeLife + 2, 0.26);
    }

    SFX.launch();
    // a launch a second would strobe the banner, so a wave is announced once
    if (now - state.launchFlashAt > CONFIG.launchFlashGap) {
      state.launchFlashAt = now;
      flash('LAUNCH — ' + site.short + ' · ' + m.seeker);
    }
  }

  function steer(m, target, dt, pvel) {
    // Lead the aircraft on the way out, chase the real position in the last
    // half second: a missile aimed at where you were flies past you.
    var aim = target;
    if (pvel) {
      var tti = len(sub(target, m.pos)) / Math.max(1, m.speed);
      if (tti > 0.6) aim = add(target, mul(pvel, tti));
    }
    var to = sub(aim, m.pos);
    var d = len(to) || 1;
    var des = mul(to, 1 / d);
    var cur = unit(m.vel);
    var dot = cur.x * des.x + cur.y * des.y + cur.z * des.z;
    dot = Math.max(-1, Math.min(1, dot));
    var ang = Math.acos(dot);
    var turn = Math.min(ang, ((m.maxG * CONFIG.turnBoost * 9.81) / m.speed) * dt);
    var t = ang > 1e-6 ? turn / ang : 1;
    var nd = unit(add(mul(cur, 1 - t), mul(des, t)));
    m.vel = mul(nd, m.speed);
    m.pos = add(m.pos, mul(m.vel, dt));
  }

  function tryDecoy(m, now) {
    if (m.life < 1 || now < m.nextRoll) return;
    m.nextRoll = now + 0.2;
    var isIR = m.seeker === 'IR';
    var pool = isIR ? state.flares : state.chaff;
    var effect = isIR ? CONFIG.flareEffect : CONFIG.chaffEffect;
    if (!pool.length || effect <= 0) return;
    var cur = unit(m.vel);
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < pool.length; i++) {
      var f = pool[i];
      var d = dist(f.pos, m.pos);
      if (d > CONFIG.decoyRange) continue;
      var dir = unit(sub(f.pos, m.pos));
      if (dir.x * cur.x + dir.y * cur.y + dir.z * cur.z < 0.4) continue;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (!best) return;
    if (Math.random() < effect * (1 - bestD / CONFIG.decoyRange)) {
      m.decoy = best;
      flash('DECOYED — MISSILE DEFEATED');
    }
  }

  // A real explosion: a fireball that blooms and dies, black smoke rolling out
  // of it and hanging, plus the expanding ring on the overlay and the bang.
  function burst(pos, scale) {
    var k = scale || 1;
    var up = unit(pos);
    var i;
    // a blast rattles the airframe: the closer it goes off, the harder it hits
    if (state.ppos) {
      var near = dist(pos, state.ppos);
      if (near < 900) addShake((1 - near / 900) * 5 * k, 1.1);
    }
    for (i = 0; i < 8; i++) {
      addSmoke(add(pos, {
        x: (Math.random() - 0.5) * 10 * k,
        y: (Math.random() - 0.5) * 10 * k,
        z: (Math.random() - 0.5) * 10 * k
      }), 10 * k, 0.5 + Math.random() * 0.35, 0.9, 'fire');
    }
    for (i = 0; i < 6; i++) {
      addSmoke(add(add(pos, mul(up, Math.random() * 6 * k)), {
        x: (Math.random() - 0.5) * 14 * k,
        y: (Math.random() - 0.5) * 14 * k,
        z: (Math.random() - 0.5) * 14 * k
      }), 7 * k, 4 + Math.random() * 3, 0.32, 'dark');
    }
    state.bursts.push({ lla: toLla(pos), life: 1.6, ttl: 1.6, scale: k });
    SFX.explosion(k);
  }

  function killMissile(index, isHit) {
    var m = state.missiles[index];
    if (!m) return;
    burst(m.pos, isHit ? 1.7 : 0.9);
    dropBody(m);
    state.missiles.splice(index, 1);
    if (isHit) {
      state.kills += 1;
      state.hitUntil = performance.now() + 9000;
      // the airframe is holed: everything shakes hard for five seconds, but
      // the controls stay with the pilot
      addShake(14, 5);
      for (var q = 0; q < 8; q++) {
        addSmoke(add(m.pos, {
          x: (Math.random() - 0.5) * 36,
          y: (Math.random() - 0.5) * 36,
          z: (Math.random() - 0.5) * 24
        }), 9, CONFIG.smokeLife + 2, 0.3);
      }
      flash('IMPACT — AIRCRAFT DESTROYED');
    }
  }

  function destroySite(s) {
    if (!s || s.alive === false) return;
    s.alive = false;
    s.status = 'DESTROYED';
    s.track = 0;
    for (var i = 0; i < (s.entities || []).length; i++) {
      try { s.entities[i].show = false; } catch (e) { /* entity already removed */ }
    }
    // the wreck keeps smoking: a short column marks it as down for the rest of
    // the session, so a kill stays readable from the air
    state.columns.push({ ecef: s.ecef, next: 0 });
    burst(add(s.ecef, { x: 0, y: 0, z: 6 }), 1.8);
    SFX.siteDown();
    flash('SITE DESTROYED — ' + s.short);
  }

  // Where the nose points: the velocity vector when the aircraft is moving,
  // the compass heading when it is sitting still.
  function aimDir(pv) {
    var d = unit(pv);
    if (isFinite(d.x) && len(pv) >= 5) return d;
    var h = (state.heading || 0) * D2R;
    var lat = (state.plla ? state.plla.lat : 33.3) * D2R;
    var lon = (state.plla ? state.plla.lon : 44.4) * D2R;
    var north = { x: -Math.sin(lat) * Math.cos(lon), y: -Math.sin(lat) * Math.sin(lon), z: Math.cos(lat) };
    var east = { x: -Math.sin(lon), y: Math.cos(lon), z: 0 };
    return unit(add(mul(north, Math.cos(h)), mul(east, Math.sin(h))));
  }

  // One round: leaves the nose with a little spread and keeps the aircraft's
  // own velocity on top, so it flies true at any speed.
  function fireRound(p, pv) {
    var dir = aimDir(pv);
    var up = unit(p);
    var start = add(add(p, mul(dir, 16)), mul(up, -1.6));
    state.bullets.push({
      pos: start,
      vel: add(mul(dir, CONFIG.gunSpeed), pv),
      life: CONFIG.gunLife,
      lla: toLla(start),
      plla: toLla(start)
    });
    SFX.gun();
  }

  function fireRockets() {
    SFX.unlock();
    var p = state.ppos;
    if (!p) { flash('NO AIRCRAFT YET'); SFX.deny(); return; }
    var pv = state.pvel || { x: 0, y: 0, z: 0 };
    var dir = aimDir(pv);
    var up = unit(p);
    for (var i = 0; i < 4; i++) {
      var start = add(add(p, mul(dir, 14)), mul(up, -2.5));
      var spread = 0.03;
      var aim = unit(add(dir, {
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread,
        z: (Math.random() - 0.5) * spread
      }));
      state.sead.push({
        pos: start,
        vel: mul(aim, 900),
        life: 0,
        ttl: 14,
        trail: [],
        smokeGap: 0,
        lla: toLla(start)
      });
    }
    SFX.sead();
    flash('ROCKETS AWAY');
  }

  /* --------------------------- simulation ------------------------- */

  function update(dt, now) {
    var p = readPlayer();
    if (!p) return;

    var ppos = ecef(p.lat, p.lon, p.alt);
    var pvel = { x: 0, y: 0, z: 0 };
    if (state.prevPos && state.prevT) {
      var span = Math.max(0.02, now - state.prevT);
      pvel = mul(sub(ppos, state.prevPos), 1 / span);
      if (len(pvel) > 1200) pvel = { x: 0, y: 0, z: 0 };
    }
    state.prevPos = ppos;
    state.prevT = now;
    state.ppos = ppos;
    state.palt = p.alt;
    state.pvel = pvel;
    state.plla = { lat: p.lat, lon: p.lon };

    var phi = p.lat * D2R;
    var lam = p.lon * D2R;
    var north = -Math.sin(phi) * Math.cos(lam) * pvel.x - Math.sin(phi) * Math.sin(lam) * pvel.y + Math.cos(phi) * pvel.z;
    var east = -Math.sin(lam) * pvel.x + Math.cos(lam) * pvel.y;
    if (north || east) state.heading = Math.atan2(east, north) * RAD2D;

    // machine gun: held trigger, rounds come out on a fixed cadence
    if (state.gunHeld) {
      if (!state.gunAt) state.gunAt = now;
      if (now - state.gunAt > 0.5) state.gunAt = now;
      while (now >= state.gunAt) {
        state.gunAt += 60 / CONFIG.gunRpm;
        fireRound(ppos, pvel);
      }
    } else {
      state.gunAt = 0;
    }

    var grace = now * 1000 < state.hitUntil;
    var i;

    for (i = 0; i < state.sites.length; i++) {
      var s = state.sites[i];
      var d = dist(s.ecef, ppos);
      if (s.alive === false) { s.status = 'DESTROYED'; continue; }
      if (!state.armed || grace) { s.status = 'IDLE'; s.track = 0; continue; }
      if (d > s.range) { s.track = Math.max(0, s.track - dt * 2); s.status = 'IDLE'; continue; }
      if (p.alt < MIN_ALT || p.alt > MAX_ALT) {
        s.track = Math.max(0, s.track - dt * 2);
        s.status = p.alt < MIN_ALT ? 'TOO LOW' : 'TOO HIGH';
        continue;
      }
      if (now < s.readyAt) { s.status = 'RELOAD'; continue; }
      s.status = s.track > 0.05 ? 'TRACK' : 'SEARCH';
      s.track += dt;
      if (s.track >= CONFIG.lockTime && state.missiles.length < CONFIG.maxSimultaneous) {
        launch(s, ppos, pvel, now);
        s.readyAt = now + CONFIG.reload;
        s.track = 0;
        s.status = 'LAUNCH';
      }
    }

    for (i = state.missiles.length - 1; i >= 0; i--) {
      var m = state.missiles[i];
      m.life += dt;
      m.speed = Math.min(m.speedMax, m.speed + 340 * dt);
      if (!m.decoy) tryDecoy(m, now);
      var mFrom = m.pos;
      if (m.decoy) {
        if (m.decoy.life <= 0) { killMissile(i, false); continue; }
        steer(m, m.decoy.pos, dt);
      } else {
        steer(m, ppos, dt, pvel);
      }
      m.lla = toLla(m.pos);

      // space puffs by distance flown, not by frame: same density at any
      // speed, and no more puffs than the trail actually needs
      m.smokeGap -= len(m.vel) * dt;
      if (m.smokeGap <= 0) {
        m.smokeGap = CONFIG.smokeGap;
        addSmoke(m.pos, 6, CONFIG.smokeLife, 0.26);
      }

      var last = m.trail[m.trail.length - 1];
      if (!last || dist(last, m.pos) > 60) {
        m.trail.push({ lat: m.lla.lat, lon: m.lla.lon, alt: m.lla.alt });
        if (m.trail.length > 90) m.trail.shift();
      }

      if (m.decoy) {
        if (segDist(mFrom, m.pos, m.decoy.pos) <= 80) killMissile(i, false);
        continue;
      }
      if (segDist(mFrom, m.pos, ppos) <= CONFIG.hitRadius) { killMissile(i, true); continue; }
      if (m.life > m.ttl || m.lla.alt < 0) killMissile(i, false);
    }

    for (i = state.sead.length - 1; i >= 0; i--) {
      var rk = state.sead[i];
      rk.life += dt;
      rk.vel.z -= 7 * dt;
      rk.pos = add(rk.pos, mul(rk.vel, dt));
      rk.lla = toLla(rk.pos);

      rk.smokeGap -= len(rk.vel) * dt;
      if (rk.smokeGap <= 0) {
        rk.smokeGap = CONFIG.rocketSmokeGap;
        addSmoke(rk.pos, 7, CONFIG.smokeLife, 0.3);
      }

      var sl = rk.trail[rk.trail.length - 1];
      if (!sl || dist(sl, rk.pos) > 60) {
        rk.trail.push({ lat: rk.lla.lat, lon: rk.lla.lon, alt: rk.lla.alt });
        if (rk.trail.length > 50) rk.trail.shift();
      }

      var struck = null;
      for (var qi = 0; qi < state.sites.length; qi++) {
        var site = state.sites[qi];
        if (site.alive === false) continue;
        if (dist(rk.pos, site.ecef) < 90) { struck = site; break; }
      }
      if (struck) {
        burst(rk.pos, 1.2);
        destroySite(struck);
        dropBody(rk);
        state.sead.splice(i, 1);
        continue;
      }
      if (rk.life > rk.ttl || rk.lla.alt < 0) {
        dropBody(rk);
        state.sead.splice(i, 1);
      }
    }

    for (i = state.bullets.length - 1; i >= 0; i--) {
      var bl = state.bullets[i];
      bl.plla = bl.lla;
      var bFrom = bl.pos;
      bl.vel.z -= 9.8 * dt;
      bl.pos = add(bl.pos, mul(bl.vel, dt));
      bl.lla = toLla(bl.pos);
      bl.life -= dt;

      // rounds can knock a battery out: the 20 mm chews through a launcher
      var bStruck = null;
      for (var bi = 0; bi < state.sites.length; bi++) {
        var bs = state.sites[bi];
        if (bs.alive === false) continue;
        if (segDist(bFrom, bl.pos, bs.ecef) < 70) { bStruck = bs; break; }
      }
      if (bStruck) {
        destroySite(bStruck);
        state.bullets.splice(i, 1);
        continue;
      }

      if (bl.life <= 0 || bl.lla.alt < 0) state.bullets.splice(i, 1);
    }

    var pools = [state.flares, state.chaff];
    for (var q = 0; q < pools.length; q++) {
      var list = pools[q];
      for (i = list.length - 1; i >= 0; i--) {
        var f = list[i];
        f.life -= dt;
        f.vel.z -= 5 * dt;
        f.pos = add(f.pos, mul(f.vel, dt));
        f.lla = toLla(f.pos);
        if (f.kind === 'IR') {
          f.smokeAt = (f.smokeAt || 0) - dt;
          if (f.smokeAt <= 0) {
            f.smokeAt = 0.09;
            addSmoke(f.pos, 1.3, 1.4, 0.12);
          }
        }
        if (f.life <= 0) list.splice(i, 1);
      }
    }

    for (i = state.smoke.length - 1; i >= 0; i--) {
      var puf = state.smoke[i];
      puf.life -= dt;
      puf.size += puf.grow * dt;
      if (puf.life <= 0) state.smoke.splice(i, 1);
    }

    // a dead battery keeps a short black column going: about 80 ft of smoke,
    // enough to mark it as down without smoking out the whole valley
    for (i = 0; i < state.columns.length; i++) {
      var col = state.columns[i];
      col.next -= dt;
      if (col.next > 0) continue;
      col.next = 0.32;
      var ch = Math.random() * CONFIG.columnHeight;
      addSmoke(add(col.ecef, mul(unit(col.ecef), ch)), 5 + ch * 0.22, 9, 0.34, 'dark');
    }

    for (i = state.bursts.length - 1; i >= 0; i--) {
      state.bursts[i].life -= dt;
      if (state.bursts[i].life <= 0) state.bursts.splice(i, 1);
    }
  }

  /* ------------------------------- boot --------------------------- */

  var lastT = 0;

  function tick(ts) {
    var now = ts / 1000;
    var dt = lastT ? Math.min(0.05, now - lastT) : 0.016;
    lastT = now;
    try {
      update(dt, now);

      if (!state.projector) state.projector = findProjector();
      if (!state.fleetBuilt) { sampleHeights(); if (!state.fleetBuilt) buildFleet(); }
      if (!WORLD.ready) initWorldLayer();
      syncBodies();
      syncSmoke();

      render(now);
      applyShake(now);
      updateHud(now);
    } catch (e) {
      if (String(e) !== state.lastError) {
        state.lastError = String(e);
        console.warn('[SAM]', e);
      }
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    for (var i = 0; i < SITES.length; i++) {
      var s = SITES[i];
      state.sites.push({
        id: s.id, name: s.name, short: s.short, system: s.system,
        lat: s.lat, lon: s.lon, alt: 0, range: s.range, speed: s.speed,
        maxG: s.maxG, seeker: s.seeker, rounds: s.rounds, reload: s.reload,
        ecef: ecef(s.lat, s.lon, 0), track: 0, readyAt: 0,
        status: 'IDLE', alive: true, entities: []
      });
    }

    buildHud();
    buildOverlay();

    setInterval(function () {
      if (!document.getElementById('sam-net')) buildHud();
      if (!document.getElementById('sam-overlay')) buildOverlay();
      var found = findProjector();
      if (found && (!state.projector || state.projector.kind !== found.kind)) state.projector = found;
      if (!found && state.projector) state.projector = null;
      if (!state.fleetBuilt) { sampleHeights(); if (!state.fleetBuilt) buildFleet(); }
      if (!WORLD.ready) initWorldLayer();
    }, 1500);

    window.addEventListener('keydown', function (event) {
      if (event.repeat || event.metaKey || event.ctrlKey) return;
      var key = String(event.key || '').toLowerCase();
      if (event.target && /input|textarea/i.test(event.target.tagName || '')) return;
      SFX.unlock();
      if (key === ',') { event.preventDefault(); dispense('IR', 2); }
      else if (key === '.') { event.preventDefault(); dispense('RADAR', 2); }
      else if (key === 'l') { event.preventDefault(); fireRockets(); }
      else if (key === '/') { event.preventDefault(); state.gunHeld = true; }
      else if (key === 'j') {
        event.preventDefault();
        state.armed = !state.armed;
        flash(state.armed ? 'NETWORK ARMED' : 'NETWORK DISARMED');
      }
    });

    window.addEventListener('keyup', function (event) {
      if (String(event.key || '') === '/') state.gunHeld = false;
    });

    window.addEventListener('blur', function () { state.gunHeld = false; });

    window.geofsSAM = {
      state: state,
      sites: state.sites,
      config: CONFIG,
      arm: function () { state.armed = true; },
      disarm: function () { state.armed = false; },
      flares: function () { dispense('IR', 2); },
      chaff: function () { dispense('RADAR', 2); },
      rockets: function () { fireRockets(); },
      rebuildFleet: function () { clearFleet(); buildFleet(); },
      clear: function () { for (var i = state.missiles.length - 1; i >= 0; i--) killMissile(i, false); },
      diagnostics: function () {
        return {
          geofsObject: !!window.geofs,
          cesium: !!C3(),
          projector: state.projector ? state.projector.kind : null,
          aircraft: readPlayer(),
          fleetBuilt: state.fleetBuilt,
          fleetEntities: state.fleet.length,
          worldLayer: WORLD.ready ? 'cesium billboards' : 'canvas fallback',
          bodies: state.missiles.filter(function (o) { return !!o.body; }).length,
          siteAltitudes: state.sites.map(function (s) { return { short: s.short, alt: Math.round((s.alt || 0) * 10) / 10 }; }),
          overlayMounted: !!document.getElementById('sam-overlay'),
          hudMounted: !!document.getElementById('sam-net')
        };
      }
    };

    console.log('[SAM] network online — ' + state.sites.length + ' sites');
    console.log('[SAM] geofsSAM.diagnostics() for a status dump');

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
