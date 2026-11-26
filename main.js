// ==UserScript==
// @name         GeoFS SAM Network — BAGHDAD
// @namespace    geofs.sam.network
// @version      4.7.0
// @description  18 SAM sites, two F-16s approaching from 20 miles, an armed Navy F/A-18 wingman, portable 3D visuals and burning aircraft crashes.
// @author       SAM Network workbench
// @match        *://*.geo-fs.com/*
// @match        *://geo-fs.com/*
// @match        *://*.geofs.com/*
// @match        *://geofs.com/*
// @run-at       document-idle
// @inject-into  page
// @sandbox      raw
// @noframes
// @grant        none
// ==/UserScript==

/*
  4.0 — portable world coordinates and a wingman
  ---------------------------------------------------------------
  Paste this ENTIRE script into a userscript manager with page-context
  execution enabled, or into the GeoFS page's developer console.
  No workbench account, API key, companion script or model upload is needed.
  GeoFS must be fully loaded in a WebGL-capable browser. A browser extension
  still needs permission to run scripts on GeoFS, including on Safari.

  All positions now use WGS84, the same ellipsoid as GeoFS/Cesium. The old
  spherical coordinates displaced raw 3D primitives by kilometres and could
  put them underground. Model loading now inserts primitives BEFORE waiting
  for GPU readiness, including with older Cesium versions.

  Aircraft resources come from GeoFS's actual model library, fetched on the
  GeoFS origin. The F/A-18 uses its Navy multiplayer texture, livery 1, NOT
  the Blue Angels paint. Correctly oriented geometric airframes remain
  visible while assets load or if a browser blocks a model or texture.
  The HUD reports a fallback rather than claiming a model loaded.

  F-16s start 20 statute miles (32.19 km) from the player's initial location
  and approach immediately. The Navy wingman starts nearby, follows, attacks
  threats, and carries 1,000 gun rounds plus 16 unguided rockets. SAMs and
  bandits can kill him. All downed AI aircraft burn and fall under gravity,
  then explode again on terrain contact. Nothing respawns automatically.

  Controls: comma flares, period chaff, U cycles rockets / AIM-9, L fires the
  selected weapon, shift+U rearms once you are out, / held gun, J SAM arm.
  Keep @grant none: the script needs GeoFS's own page objects.
*/

(function () {
  'use strict';

  if (window.__SAMNET) {
    console.log('[SAM] already online');
    return;
  }
  // The workbench assembles the modules into one copyable, standalone script.
  if (typeof installAircraft !== 'function' || typeof installAirDefense !== 'function' || typeof installHudOverlay !== 'function' || typeof makeRotaryAudio !== 'function') {
    console.error('[SAM] Incomplete source template. Use the workbench Copy or Download script button for the complete userscript.');
    return;
  }
  window.__SAMNET = true;

  var CONFIG = {
    lockTime: 1.0,
    reload: 30,
    launchFlashGap: 3,
    turnBoost: 6,
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
    // 100 statute miles: a battery further away than this draws nothing on the
    // glass, so the Baghdad net stays invisible from the other side of Europe
    siteVisible: 160934,
    scopeSize: 210,
    vehiclesPerSite: 5,
    smokeGap: 130,
    rocketSmokeGap: 45,
    smokeLife: 18,
    gunRpm: 900,
    gunSpeed: 1050,
    gunLife: 2.2,
    rocketDamage: 2,
    banditCount: 2,
    banditSpeed: 265,
    banditMaxSpeed: 335,
    banditTurnG: 12,
    banditEngage: 60000,
    banditFireRange: 4200,
    banditReload: 5,
    banditSpawnDistance: 32186.88,
    wingmanGun: 1000,
    wingmanRockets: 16,
    wingmanSpeed: 210,
    aim9Range: 9000,
    aim9Lock: 1.2,
    aim9Speed: 880,
    aim9TurnG: 28,
    aim9Life: 12,
    playerAim9: 4,
    playerRockets: 16,
    playerHp: 8
  };

  // armor = how many hits a battery soaks up. Rockets do two, gun rounds one,
  // so a dug-in SA-2 or an SA-5 in the mountains takes real work.
  var SITES = [
    { id: 'baghdad-0', name: 'BIAP — Baghdad Intl', short: 'BIAP', system: 'SA-2 Guideline', lat: 33.2625, lon: 44.2346, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50, armor: 4 },
    { id: 'baghdad-1', name: 'Camp Victory', short: 'VICTORY', system: 'SA-3 Goa', lat: 33.2833, lon: 44.1833, range: 25000, speed: 900, maxG: 16, seeker: 'RADAR', rounds: 4, reload: 40, armor: 3 },
    { id: 'baghdad-2', name: 'Rasheed AB', short: 'RASHEED', system: 'SA-6 Gainful', lat: 33.2417, lon: 44.5042, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32, armor: 3 },
    { id: 'baghdad-3', name: 'Taji Depot', short: 'TAJI', system: 'SA-6 Gainful', lat: 33.507, lon: 44.256, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32, armor: 3 },
    { id: 'baghdad-4', name: 'Tarmiyah North', short: 'TARMIYAH', system: 'SA-2 Guideline', lat: 33.65, lon: 44.38, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50, armor: 4 },
    { id: 'baghdad-5', name: 'Muthanna Centre', short: 'MUTHANNA', system: 'SA-8 Gecko', lat: 33.33, lon: 44.4, range: 12000, speed: 650, maxG: 22, seeker: 'RADAR', rounds: 6, reload: 24, armor: 2 },
    { id: 'baghdad-6', name: 'Karrada', short: 'KARRADA', system: 'SA-13 Gopher', lat: 33.3, lon: 44.42, range: 5000, speed: 550, maxG: 20, seeker: 'IR', rounds: 8, reload: 18, armor: 1 },
    { id: 'baghdad-7', name: 'Sadr City', short: 'SADR', system: 'SA-8 Gecko', lat: 33.39, lon: 44.45, range: 12000, speed: 650, maxG: 22, seeker: 'RADAR', rounds: 6, reload: 24, armor: 2 },
    { id: 'baghdad-8', name: 'Abu Ghraib West', short: 'ABU GHRAIB', system: 'SA-3 Goa', lat: 33.32, lon: 44.15, range: 25000, speed: 900, maxG: 16, seeker: 'RADAR', rounds: 4, reload: 40, armor: 3 },
    { id: 'baghdad-9', name: 'Mahmudiyah South', short: 'MAHMUDIYAH', system: 'SA-13 Gopher', lat: 33.06, lon: 44.36, range: 5000, speed: 550, maxG: 20, seeker: 'IR', rounds: 8, reload: 18, armor: 1 },
    { id: 'baghdad-10', name: 'Balad', short: 'BALAD', system: 'SA-2 Guideline', lat: 33.94, lon: 44.362, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50, armor: 4 },
    { id: 'baghdad-11', name: 'Karbala Road', short: 'KARBALA RD', system: 'SA-18 Igla', lat: 32.9, lon: 44.2, range: 5000, speed: 600, maxG: 18, seeker: 'IR', rounds: 4, reload: 14, armor: 1 },
    { id: 'baghdad-12', name: 'Baqubah NE', short: 'BAQUBAH', system: 'SA-6 Gainful', lat: 33.75, lon: 44.64, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32, armor: 3 },
    { id: 'zagros-0', name: 'Zagros — Penjwen Ridge', short: 'PENJWEN', system: 'SA-5 Gammon', lat: 35.02, lon: 45.92, range: 60000, speed: 1400, maxG: 12, seeker: 'RADAR', rounds: 4, reload: 55, armor: 5 },
    { id: 'zagros-1', name: 'Zagros — Halabja Valley', short: 'HALABJA', system: 'SA-6 Gainful', lat: 35.18, lon: 46.02, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32, armor: 4 },
    { id: 'zagros-2', name: 'Zagros — Darbandikhan Pass', short: 'DARBANDI', system: 'SA-3 Goa', lat: 35.11, lon: 45.68, range: 25000, speed: 900, maxG: 16, seeker: 'RADAR', rounds: 4, reload: 40, armor: 3 },
    { id: 'zagros-3', name: 'Zagros — Ilam Highlands', short: 'ILAM', system: 'SA-6 Gainful', lat: 33.62, lon: 46.42, range: 24000, speed: 800, maxG: 18, seeker: 'RADAR', rounds: 4, reload: 32, armor: 4 },
    { id: 'zagros-4', name: 'Zagros — Marivan Ridge', short: 'MARIVAN', system: 'SA-2 Guideline', lat: 35.48, lon: 46.12, range: 45000, speed: 1150, maxG: 10, seeker: 'RADAR', rounds: 3, reload: 50, armor: 5 }
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
    funnelUntil: 0,
    flares: [],
    chaff: [],
    sead: [],
    bursts: [],
    smoke: [],
    columns: [],
    shake: { amp: 0, until: 0 },
    bandits: [],
    banditsSpawned: false,
    wingman: null,
    wingmanMode: 'AUTO',
    comms: [],
    weather: '',
    wrecks: [],
    simTime: 0,
    paused: false,
    ao: null,
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
    aim9: [],
    aim9Left: 4,
    rocketsLeft: 16,
    weapon: 'ROCKETS',
    aim9Target: null,
    aim9LockT: 0,
    playerHp: 8,
    customSites: [],
    spawnKind: 'RADAR',
    panelOpen: 'main',
    lastError: ''
  };

  /* ----------------------------- math ----------------------------- */

  // WGS84 in BOTH directions, even before Cesium finishes initializing.
  // A 6371-km sphere is not interchangeable with Cesium's ellipsoid.
  var EARTH_A = 6378137;
  var EARTH_E2 = 6.6943799901413165e-3;
  function ecef(lat, lon, alt) {
    var phi = lat * D2R, lam = lon * D2R;
    var s = Math.sin(phi), c = Math.cos(phi);
    var n = EARTH_A / Math.sqrt(1 - EARTH_E2 * s * s);
    return { x: (n + alt) * c * Math.cos(lam), y: (n + alt) * c * Math.sin(lam), z: (n * (1 - EARTH_E2) + alt) * s };
  }

  function toLla(v) {
    var p = Math.sqrt(v.x * v.x + v.y * v.y);
    if (p < 1e-6) return { lat: v.z < 0 ? -90 : 90, lon: 0, alt: Math.abs(v.z) - 6356752.314245179 };
    var phi = Math.atan2(v.z, p * (1 - EARTH_E2));
    for (var i = 0; i < 6; i++) {
      var s = Math.sin(phi);
      var n = EARTH_A / Math.sqrt(1 - EARTH_E2 * s * s);
      phi = Math.atan2(v.z + EARTH_E2 * n * s, p);
    }
    var sin = Math.sin(phi), cos = Math.cos(phi);
    var radius = EARTH_A / Math.sqrt(1 - EARTH_E2 * sin * sin);
    return { lat: phi * RAD2D, lon: Math.atan2(v.y, v.x) * RAD2D, alt: p * cos + v.z * sin - radius * (1 - EARTH_E2 * sin * sin) };
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
    var enuRot = (C.Matrix4.getMatrix3 || C.Matrix4.getRotation)(enu, new C.Matrix3());
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
      Promise.resolve().then(function () { return C.sampleTerrainMostDetailed(viewer.terrainProvider, cartos); })
        .then(apply)
        .catch(function () {
          for (var i = 0; i < cartos.length; i++) {
            var h = viewer.scene.globe.getHeight(cartos[i]);
            cartos[i].height = typeof h === 'number' && isFinite(h) ? h : 0;
          }
          apply(cartos);
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
    '#sam-stack{position:fixed;top:84px;right:14px;z-index:99998;width:228px;display:flex;flex-direction:column;gap:8px}' +
    '#sam-net,#sam-spawner{padding:9px 10px 8px;border:1px solid rgba(224,178,74,.45);border-radius:5px;background:rgba(8,10,14,.88);color:#e9e4d9;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;box-shadow:0 12px 34px rgba(0,0,0,.55)}' +
    '#sam-net .hd,#sam-spawner .hd{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.16em;color:#e0b24a;margin-bottom:6px;cursor:pointer;user-select:none}' +
    '#sam-net .hd .caret,#sam-spawner .hd .caret{margin-left:auto;font-size:9px;color:#9aa2ad;transition:transform .15s}' +
    '#sam-net.collapsed .hd,#sam-spawner.collapsed .hd{margin-bottom:0}' +
    '#sam-net.collapsed .hd .caret,#sam-spawner.collapsed .hd .caret{transform:rotate(-90deg)}' +
    '#sam-net.collapsed .gr,#sam-net.collapsed .cm,#sam-net.collapsed .row,#sam-net.collapsed .full,#sam-net.collapsed .comms,#sam-net.collapsed .hint,#sam-net.collapsed .diag,#sam-spawner.collapsed .gr,#sam-spawner.collapsed .cm,#sam-spawner.collapsed .hint{display:none}' +
    '#sam-net .hd i,#sam-spawner .hd i{width:6px;height:6px;border-radius:50%;background:#3fbf7f;display:inline-block}' +
    '#sam-net .hd i.bad{background:#ff5a3c}' +
    '#sam-spawner .hd i{background:#e0b24a}' +
    '#sam-net .gr,#sam-spawner .gr{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:10px;color:#9aa2ad}' +
    '#sam-net .gr b,#sam-spawner .gr b{color:#e9e4d9;font-weight:500;text-align:right}' +
    '#sam-net .cm,#sam-spawner .cm{display:flex;gap:6px;margin-top:8px}' +
    '#sam-net button,#sam-spawner button{flex:1;padding:5px 4px;border:1px solid rgba(224,178,74,.35);border-radius:3px;background:rgba(224,178,74,.1);color:#e0b24a;font:10px ui-monospace,monospace;letter-spacing:.1em;cursor:pointer}' +
    '#sam-net button:hover,#sam-spawner button:hover{background:rgba(224,178,74,.22)}' +
    '#sam-net button.on,#sam-spawner button.on{background:rgba(224,178,74,.4);color:#fff6d8;border-color:rgba(224,178,74,.8)}' +
    '#sam-net .row{display:flex;gap:6px;margin-top:6px}' +
    '#sam-net .row button{flex:0 0 38px}' +
    '#sam-net .full{display:flex;margin-top:6px}' +
    '#sam-net .full button{flex:1;border-color:rgba(255,90,60,.45);background:rgba(255,90,60,.12);color:#ff8a72}' +
    '#sam-net .full button:hover{background:rgba(255,90,60,.24)}' +
    '#sam-net .full button.spawn{border-color:rgba(224,178,74,.4);background:rgba(224,178,74,.12);color:#e0b24a}' +
    '#sam-net .full button.spawn:hover{background:rgba(224,178,74,.22)}' +
    '#sam-net select{flex:1;min-width:0;padding:4px 3px;border:1px solid rgba(224,178,74,.3);border-radius:3px;background:rgba(14,18,24,.95);color:#e6c063;font:10px ui-monospace,monospace;letter-spacing:.06em;cursor:pointer}' +
    '#sam-net .hint,#sam-spawner .hint{margin-top:6px;font-size:9px;color:#6d747e;letter-spacing:.08em}' +
    '#sam-net .diag{margin-top:5px;font-size:9px;color:#5c636d;letter-spacing:.06em;border-top:1px solid rgba(224,178,74,.16);padding-top:4px}' +
    '#sam-net .diag.warn{color:#ff8a72}' +
    '#sam-net .comms{margin-top:6px;border-top:1px solid rgba(224,178,74,.16);padding-top:4px}' +
    '#sam-net .comms div{font-size:9px;line-height:1.55;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#sam-net .comms div.friendly{color:#7fe3b0}' +
    '#sam-net .comms div.alert{color:#ff8a72}' +
    '#sam-net .comms div.info{color:#c9b27a}';

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
    if (state.smoke.length > 1400) state.smoke.shift();
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
      for (var i = 0; i < 1400; i++) {
        WORLD.pool.push(coll.add({
          position: new C.Cartesian3(0, 0, 0),
          image: WORLD.smokeImg,
          scale: 1,
          sizeInMeters: true,
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
      var cap = p.kind === 'fire' ? 90 : 65;
      b.width = b.height = Math.max(1, Math.min(cap, p.size)) * 2;
      var img = p.kind === 'fire' ? WORLD.fireImg : WORLD.smokeImg;
      if (b.image !== img) b.image = img;
      // the whole trail holds its density for the puff's life, then thins out
      // over the last fifth
      b.color = puffColor(C, p.alpha * Math.min(1, pk / 0.2), p.kind);
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
    placeBodies(C, viewer, state.aim9, 'rocket');
  }

  function dropBody(o) {
    var viewer = getViewer();
    if (!o || !o.body) return;
    try { viewer.entities.remove(o.body); } catch (e) { /* already gone */ }
    o.body = null;
  }

  /* ---------------------- portable aircraft controller ---------------- */
  // Included verbatim inside the downloadable userscript; no runtime imports.
function installAircraft(env) {
  var state = env.state, CONFIG = env.config, C3 = env.C3, getViewer = env.viewer;
  var ecef = env.ecef, toLla = env.toLla, add = env.add, sub = env.sub;
  var mul = env.mul, unit = env.unit, len = env.len, dist = env.dist;
  var burst = env.burst, addSmoke = env.smoke, flash = env.flash;
  var dispenseAt = env.dispenseAt, callout = env.callout || function () {};
  var D2R = Math.PI / 180, RAD2D = 180 / Math.PI, resources = {};
  var PARTS = [
    [1.5, 12.5, 1.5, 0, 0, 0, '#8d94a0'], [0.9, 3.2, 0.9, 0, 7.2, 0, '#767d8a'],
    [0.85, 2.4, 0.72, 0, 3.4, 0.78, '#263140'], [9.4, 3.4, 0.22, 0, -0.8, -0.15, '#8d94a0'],
    [4.6, 1.7, 0.18, 0, -5.4, -0.1, '#8d94a0'], [0.22, 2.6, 2.3, 0, -4.9, 1.35, '#8d94a0'],
    [0.85, 3, 0.7, 0, -1, -0.78, '#5c636e']
  ];
  var NAVY_PARTS = PARTS.slice(0, 5).concat([
    [0.2, 2.8, 2.4, -1.5, -4.9, 1.3, '#818a94'], [0.2, 2.8, 2.4, 1.5, -4.9, 1.3, '#818a94'],
    [2.4, 4, 0.8, 0, -1, -0.7, '#5c636e']
  ]);
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function headingVec(lat, lon, deg) {
    var h = deg * D2R, p = lat * D2R, l = lon * D2R;
    return add(mul({ x: -Math.sin(p) * Math.cos(l), y: -Math.sin(p) * Math.sin(l), z: Math.cos(p) }, Math.cos(h)), mul({ x: -Math.sin(l), y: Math.cos(l), z: 0 }, Math.sin(h)));
  }
  function ground(lat, lon) {
    var C = C3(), v = getViewer();
    if (!C || !v || !v.scene || !v.scene.globe) return 0;
    var h = v.scene.globe.getHeight(C.Cartographic.fromDegrees(lon, lat));
    return typeof h === 'number' && isFinite(h) ? h : 0;
  }
  function destination(lat, lon, bearing, meters) {
    var p = lat * D2R, l = lon * D2R, d = meters / 6371000;
    var phi = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(bearing));
    return { lat: phi * RAD2D, lon: ((l + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(phi))) * RAD2D + 540) % 360 - 180 };
  }
  // Use verified GeoFS assets. All linked resources stay on the GeoFS origin.
  // Repack the official F/A-18 multiplayer GLB with the Navy texture in its
  // glTF material BEFORE loading, avoiding private GPU texture APIs on Macs.
  function modelResource(friendly) {
    var key = friendly ? 'navy' : 'f16';
    if (resources[key]) return resources[key];
    var path = friendly ? '/models/aircraft/premium/fa18/multiplayer.glb' : '/models/aircraft/premium/f16/gltf2/f16.gltf';
    var url = new URL(path, window.location.origin).href;
    resources[key] = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('GeoFS aircraft download: ' + r.status);
      return friendly ? r.arrayBuffer() : r.json();
    }).then(function (data) {
      if (!friendly) {
        ['buffers', 'images'].forEach(function (key) {
          (data[key] || []).forEach(function (item) { if (item.uri && !/^data:/.test(item.uri)) item.uri = new URL(item.uri, url).href; });
        });
        return URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'model/gltf+json' }));
      }
      var view = new DataView(data);
      if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('Unsupported GeoFS F/A-18 format');
      var oldLength = view.getUint32(12, true);
      var json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, oldLength)));
      json.images[0] = { uri: new URL('texture-low_1.jpg', url).href, name: 'GeoFS Navy livery 1' };
      var text = new TextEncoder().encode(JSON.stringify(json));
      var padded = (text.length + 3) & ~3, rest = data.slice(20 + oldLength);
      var packed = new ArrayBuffer(20 + padded + rest.byteLength), out = new DataView(packed);
      out.setUint32(0, 0x46546c67, true); out.setUint32(4, 2, true); out.setUint32(8, packed.byteLength, true);
      out.setUint32(12, padded, true); out.setUint32(16, 0x4e4f534a, true);
      var bytes = new Uint8Array(packed); bytes.fill(32, 20, 20 + padded); bytes.set(text, 20); bytes.set(new Uint8Array(rest), 20 + padded);
      return URL.createObjectURL(new Blob([packed], { type: 'model/gltf-binary' }));
    });
    return resources[key];
  }
  // Weather-driven finish: a PBR custom shader adds a sun specular highlight
  // and a fresnel sheen, stronger and cooler when the air is wet or overcast,
  // so the airframes catch the sky the way real paint does.
  var WX = { at: -1, key: '' };
  function weatherState() {
    var g = window.geofs || {}, api = g.api || {}, label = '', clouds = 0;
    try {
      var w = g.weather || api.weather || {};
      label = String(w.current || w.condition || w.name || w.type || '');
    } catch (e) { label = ''; }
    try { clouds = (g.clouds && g.clouds.length) || 0; } catch (e) { clouds = 0; }
    var l = label.toLowerCase();
    if (/rain|storm|thunder|snow|fog|mist|overcast|shower|haze|cloud/.test(l)) {
      return { label: label || 'overcast', wet: 1, gloss: 0.85, tint: [0.74, 0.79, 0.86] };
    }
    if (clouds > 18) return { label: label || 'scattered cloud', wet: 0.62, gloss: 0.72, tint: [0.84, 0.88, 0.92] };
    return { label: label || 'clear', wet: 0.26, gloss: 1, tint: [1, 0.98, 0.94] };
  }
  function styleModel(C, model) {
    if (!model || model.customShader || !C.CustomShader || !C.UniformType || !C.LightingModel) return;
    var wx = weatherState();
    try {
      model.customShader = new C.CustomShader({
        lightingModel: C.LightingModel.PBR,
        uniforms: {
          uTint: { type: C.UniformType.VEC3, value: new C.Cartesian3(wx.tint[0], wx.tint[1], wx.tint[2]) },
          uWet: { type: C.UniformType.FLOAT, value: wx.wet },
          uGloss: { type: C.UniformType.FLOAT, value: wx.gloss }
        },
        fragmentShaderText: [
          'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {',
          '  vec3 n = normalize(fsInput.attributes.normalEC);',
          '  vec3 v = normalize(-fsInput.attributes.positionEC);',
          '  vec3 sun = normalize(czm_sunDirectionEC);',
          '  vec3 h = normalize(sun + v);',
          '  float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);',
          '  float spec = pow(max(dot(n, h), 0.0), 64.0);',
          '  material.diffuse = mix(material.diffuse, uTint, 0.16);',
          '  material.specular += spec * uGloss;',
          '  material.emissive += uTint * fresnel * uWet * 0.22;',
          '}'
        ].join('\n')
      });
    } catch (e) { model.customShader = null; }
  }
  function refreshWeather(now) {
    if (now - WX.at < 1.5) return;
    WX.at = now;
    var wx = weatherState();
    var key = wx.wet + '|' + wx.gloss + '|' + wx.tint.join(',');
    if (key === WX.key) return;
    WX.key = key;
    state.weather = wx.label;
    var C = C3();
    var fleet = state.bandits.concat(state.wingman ? [state.wingman] : []);
    for (var i = 0; i < fleet.length; i++) {
      var sh = fleet[i] && fleet[i].model && fleet[i].model.customShader;
      if (!sh || !C) continue;
      try {
        sh.setUniform('uWet', wx.wet);
        sh.setUniform('uGloss', wx.gloss);
        sh.setUniform('uTint', new C.Cartesian3(wx.tint[0], wx.tint[1], wx.tint[2]));
      } catch (e) { /* older Cesium keeps the values it started with */ }
    }
  }
  function makeJet(id, label, pos, vel, friendly) {
    return { id: id, label: label, pos: pos, vel: vel, lla: toLla(pos), speed: len(vel), alive: true,
      friendly: friendly, phase: friendly ? 'FORMATION' : 'APPROACH', parts: [], model: null,
      built: false, readyAt: 0, gunAt: 0, bank: 0, modelState: 'loading', modelError: '',
      hp: 6, cmAt: 0, a9: friendly ? 4 : 2, a9At: 0,
      gun: friendly ? CONFIG.wingmanGun : Infinity, rockets: friendly ? CONFIG.wingmanRockets : Infinity };
  }
  var banditSeq = 0;
  // Two F-16s, always 20 miles (32 km) out from wherever the aircraft is now,
  // so a flight can be re-flown anywhere in the world from the panel button.
  function spawnBandits() {
    if (!state.ppos || !state.plla) return 0;
    var p = state.plla, h = state.heading || 0, spawned = 0;
    var inst = window.geofs.aircraft.instance, htr = inst && inst.htr;
    if (len(state.pvel) < 5 && htr && isFinite(htr[0])) h = htr[0];
    var airborne = 0;
    for (var a = 0; a < state.bandits.length; a++) if (state.bandits[a].alive) airborne += 1;
    var count = Math.min(CONFIG.banditCount, Math.max(0, 6 - airborne));
    for (var i = 0; i < count; i++) {
      var at = destination(p.lat, p.lon, (h + 65 + i * 3) * D2R, CONFIG.banditSpawnDistance);
      var pos = ecef(at.lat, at.lon, Math.max(state.palt + 900, ground(at.lat, at.lon) + 1800));
      banditSeq += 1;
      var jet = makeJet('bandit-' + banditSeq, 'F-16 ' + banditSeq, pos, mul(unit(sub(state.ppos, pos)), CONFIG.banditSpeed), false);
      jet.offset = i ? 420 : -420;
      state.bandits.push(jet);
      spawned += 1;
    }
    return spawned;
  }
  function spawn() {
    if (state.banditsSpawned || !state.ppos) return;
    state.banditsSpawned = true;
    spawnBandits();
    var p = state.plla, h = state.heading || 0, C = C3();
    var fwd = headingVec(p.lat, p.lon, h), right = headingVec(p.lat, p.lon, h + 90);
    var wing = add(add(add(state.ppos, mul(right, 85)), mul(fwd, -65)), mul(unit(state.ppos), 25));
    state.wingman = makeJet('wingman', 'NAVY 2 · F/A-18', wing, mul(fwd, Math.max(120, len(state.pvel))), true);
    if (C) flash('NAVY 2 — ON YOUR WING');
  }
  function buildJet(C, viewer, b) {
    b.built = true;
    b.shape = b.friendly ? NAVY_PARTS : PARTS;
    b.shape.forEach(function (p) {
      b.parts.push(viewer.entities.add({ position: new C.Cartesian3(b.pos.x, b.pos.y, b.pos.z), box: {
        dimensions: new C.Cartesian3(p[0], p[1], p[2]), material: C.Color.fromCssColorString(p[6]) } }));
    });
    var scene = viewer.scene;
    modelResource(b.friendly).then(function (url) {
      if (b.phase === 'CRASHED') return null;
      var opts = { url: url, minimumPixelSize: 20, maximumScale: 8, incrementallyLoadTextures: false,
        shadows: 0, modelMatrix: C.Transforms.eastNorthUpToFixedFrame(new C.Cartesian3(b.pos.x, b.pos.y, b.pos.z)) };
      var api = window.geofs.api;
      if (api.loadModel) return api.loadModel(opts);
      if (C.Model.fromGltfAsync) return C.Model.fromGltfAsync(opts);
      return C.Model.fromGltf(opts);
    }).then(function (model) {
      if (!model) { if (b.phase !== 'CRASHED') throw new Error('GeoFS model could not load'); return; }
      if (b.phase === 'CRASHED') { if (!model.isDestroyed()) model.destroy(); return; }
      // Older Cesium only resolves readyPromise AFTER insertion and rendering.
      scene.primitives.add(model); b.model = model;
      styleModel(C, model);
      if (model.errorEvent) model.errorEvent.addEventListener(function (error) {
        var message = String(error.message || error);
        // A shader that will not compile costs the finish, not the airframe.
        if (/shader/i.test(message) && b.model && b.model.customShader) {
          b.model.customShader = null;
          b.modelError = 'shader off: ' + message.slice(0, 70);
          return;
        }
        b.modelError = message; b.modelState = 'fallback';
        if (b.model) scene.primitives.remove(b.model); b.model = null;
      });
    }).catch(function (error) { b.modelState = 'fallback'; b.modelError = String(error.message || error); });
  }
  function placeJet(C, b) {
    var lla = b.lla, fwd = len(b.vel) > 0.5 ? unit(b.vel) : headingVec(lla.lat, lla.lon, state.heading || 0);
    var up = headingVec(lla.lat - 90, lla.lon, 0);
    var right = unit(cross(fwd, up)), top = unit(cross(right, fwd));
    if (len(right) < 0.5) return;
    var north = headingVec(lla.lat, lla.lon, 0), east = headingVec(lla.lat, lla.lon, 90);
    var heading = Math.atan2(dot(fwd, east), dot(fwd, north));
    var pitch = Math.asin(Math.max(-1, Math.min(1, dot(fwd, up))));
    // the lean comes from steerJet's coordinated turn, not from a guess at the
    // frame-to-frame heading change, so the airframe rolls in and holds it
    var bank = b.bank || 0, r = add(mul(right, Math.cos(bank)), mul(top, Math.sin(bank)));
    var u = add(mul(top, Math.cos(bank)), mul(right, -Math.sin(bank)));
    var m = new C.Matrix3();
    C.Matrix3.setColumn(m, 0, new C.Cartesian3(r.x, r.y, r.z), m);
    C.Matrix3.setColumn(m, 1, new C.Cartesian3(fwd.x, fwd.y, fwd.z), m);
    C.Matrix3.setColumn(m, 2, new C.Cartesian3(u.x, u.y, u.z), m);
    var q = C.Quaternion.fromRotationMatrix(m), ready = b.model && b.model.ready;
    if (b.model) {
      var api = window.geofs.api;
      if (api.setModelPositionOrientationAndScale) api.setModelPositionOrientationAndScale(b.model, [lla.lat, lla.lon, lla.alt], [heading * RAD2D, pitch * RAD2D, bank * RAD2D], 1);
      else b.model.modelMatrix = C.Transforms.headingPitchRollToFixedFrame(new C.Cartesian3(b.pos.x, b.pos.y, b.pos.z), new C.HeadingPitchRoll(heading - Math.PI / 2, pitch, bank));
      if (ready && b.modelState !== 'model') {
        b.modelState = 'model';
        if (b.friendly && b.model.getNode) { var gear = b.model.getNode('gear'); if (gear) gear.show = false; }
      }
    }
    b.parts.forEach(function (part, i) {
      var p = b.shape[i], at = add(add(add(b.pos, mul(r, p[3])), mul(fwd, p[4])), mul(u, p[5]));
      part.position = new C.Cartesian3(at.x, at.y, at.z); part.orientation = q; part.show = !ready;
    });
  }
  function kill(b) {
    if (!b || !b.alive) return;
    b.alive = false; b.phase = 'BURNING'; b.burnAt = 0; b.bank = 0.7; b.fallTime = 0;
    state.wrecks.push(b); burst(b.pos, 2.2);
    flash(b.friendly ? 'NAVY 2 HIT — WINGMAN DOWN' : 'BANDIT DOWN — ' + b.label);
    callout(b.friendly ? 'NAVY 2 IS DOWN — WINGMAN LOST' : 'SPLASH — F-16 DOWN', b.friendly ? 'alert' : 'friendly');
  }
  // Gun rounds chew an airframe instead of deleting it: six hits bring a jet
  // down, or one round straight through the fuselage core.
  function hit(b, dmg, critical) {
    if (!b || !b.alive) return false;
    if (critical) { kill(b); return true; }
    b.hp -= dmg;
    if (b.hp > 0) {
      if (b.friendly) flash('NAVY 2 HIT — ' + Math.max(0, b.hp) + ' HP LEFT');
      else if (state.ppos && dist(b.pos, state.ppos) < 5000) flash('HIT — ' + b.label + ' · ' + Math.max(0, b.hp) + ' HP');
      return false;
    }
    kill(b);
    return true;
  }
  // AIM-9 launch shared by Navy 2 and the F-16s; the core flies them.
  function launchAim9(owner, from, vel, target, vsPlayer) {
    if (!state.aim9) state.aim9 = [];
    var dir = len(vel) > 5 ? unit(vel) : headingVec(state.plla.lat, state.plla.lon, state.heading || 0);
    var start = add(from, mul(dir, 12));
    state.aim9.push({ owner: owner, target: target || null, vsPlayer: !!vsPlayer, pos: start,
      vel: mul(dir, 380), speed: 380, life: 0, ttl: CONFIG.aim9Life, smokeGap: 0, lla: toLla(start), decoy: null, rollAt: 0 });
    var s = env.sound();
    if (s && s.launch && state.ppos && dist(from, state.ppos) < 6000) s.launch();
  }
  // The F-16s carry flares only, but plenty of them, and pop them the moment an
  // IR round is chasing them.
  function banditDefend(b, dt) {
    b.cmAt = (b.cmAt || 0) - dt;
    if (b.cmAt > 0) return;
    var threat = false, i, d;
    for (i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      if (m.targetJet !== b || m.decoy || m.seeker !== 'IR') continue;
      d = dist(m.pos, b.pos);
      if (d < 3500) { threat = true; break; }
    }
    if (!threat) {
      for (i = 0; i < state.aim9.length; i++) {
        var a = state.aim9[i];
        if (a.target !== b || a.decoy) continue;
        d = dist(a.pos, b.pos);
        if (d < 3000) { threat = true; break; }
      }
    }
    if (threat) { dispenseAt(b.pos, b.vel, 'IR', 2); b.cmAt = 1.5; }
  }
  function removeJet(b, C, viewer) {
    if (b.model) viewer.scene.primitives.remove(b.model);
    b.model = null; b.parts.forEach(function (p) { viewer.entities.remove(p); }); b.parts = [];
  }
  function updateWrecks(dt, C, viewer) {
    for (var i = state.wrecks.length - 1; i >= 0; i--) {
      var b = state.wrecks[i]; b.fallTime += dt; b.bank += dt * 1.2;
      // a wreck has no lift left: it drops at twice gravity and keeps a little
      // of its forward speed, so the fall reads heavy instead of floaty
      b.vel = add(mul(b.vel, Math.exp(-0.02 * dt)), mul(unit(b.pos), -19.6 * dt));
      b.pos = add(b.pos, mul(b.vel, dt)); b.lla = toLla(b.pos);
      b.burnAt -= dt;
      if (b.burnAt <= 0) {
        b.burnAt = 0.055;
        addSmoke(b.pos, 13, 0.55, 0.95, 'fire');
        addSmoke(add(b.pos, mul(unit(b.pos), 4)), 9, 10, 0.65, 'dark');
      }
      if (!b.built) buildJet(C, viewer, b);
      placeJet(C, b);
      if (b.lla.alt <= ground(b.lla.lat, b.lla.lon) + 2) {
        b.phase = 'CRASHED'; b.pos = ecef(b.lla.lat, b.lla.lon, ground(b.lla.lat, b.lla.lon) + 2);
        burst(b.pos, 3.4); state.columns.push({ ecef: b.pos, next: 0 });
        removeJet(b, C, viewer); state.wrecks.splice(i, 1);
      }
    }
  }
  var G = 9.81;
  function headingOf(b, v) {
    return Math.atan2(dot(v, headingVec(b.lla.lat, b.lla.lon, 90)), dot(v, headingVec(b.lla.lat, b.lla.lon, 0)));
  }
  // A jet turns by rolling and pulling, not by pointing its nose. The flight
  // path is capped at a real climb or dive angle, the turn is flown inside a G
  // limit, the bank angle comes from that coordinated turn, and speed trades
  // away climbing and builds back up diving.
  function steerJet(b, target, dt, speed) {
    var up = unit(b.pos);
    var to = sub(target, b.pos);
    var flat = unit(sub(to, mul(up, dot(to, up))));
    if (!isFinite(flat.x) || len(flat) < 0.2) flat = headingVec(b.lla.lat, b.lla.lon, state.heading || 0);
    var agl = b.lla.alt - ground(b.lla.lat, b.lla.lon);
    var cap = agl < 600 ? Math.sin(38 * D2R) : Math.sin(22 * D2R);
    var vert = Math.max(-Math.sin(32 * D2R), Math.min(cap, dot(unit(to), up)));
    if (agl < 450) vert = Math.max(vert, Math.sin(18 * D2R));
    var desired = unit(add(mul(flat, Math.sqrt(Math.max(0, 1 - vert * vert))), mul(up, vert)));
    var cur = unit(b.vel);
    // a dead-astern target needs a perpendicular component or it never turns
    if (dot(cur, desired) < -0.995) desired = unit(add(desired, mul(headingVec(b.lla.lat, b.lla.lon, 90), 0.12)));
    var angle = Math.acos(Math.max(-1, Math.min(1, dot(cur, desired))));
    var maxTurn = (CONFIG.banditTurnG * G / Math.max(90, b.speed)) * dt;
    var t = angle > 1e-6 ? Math.min(1, maxTurn / angle) : 1;
    var next = unit(add(mul(cur, 1 - t), mul(desired, t)));
    var dh = headingOf(b, next) - headingOf(b, cur);
    rollTo(b, Math.atan2(Math.sin(dh), Math.cos(dh)), dt);
    var fpa = Math.asin(Math.max(-1, Math.min(1, dot(next, up))));
    var want = Math.max(120, Math.min(CONFIG.banditMaxSpeed || 335, speed * (1 - 0.55 * Math.sin(fpa))));
    b.speed += (want - b.speed) * Math.min(1, dt * 1.4);
    b.vel = mul(next, b.speed);
    b.pos = add(b.pos, mul(b.vel, dt)); b.lla = toLla(b.pos);
  }
  function rollTo(b, dh, dt) {
    var want = Math.max(-1.3, Math.min(1.3, Math.atan2(b.speed * (dh / Math.max(1e-4, dt)), G)));
    var roll = 2.8 * dt;
    b.bank += Math.max(-roll, Math.min(roll, want - b.bank));
  }
  function fireAt(b, target, targetVel, now, targetJet) {
    var d = dist(b.pos, target), owner = b.friendly ? 'wingman' : 'bandit';
    // Navy 2 has to close right in and his bursts are short, so a bandit can
    // outfly him. The F-16s are gentler on the player than on the wingman, who
    // still gets the full treatment.
    var gunRange = b.friendly ? 1500 : targetJet ? 2800 : 2100;
    var cone = b.friendly ? 0.975 : targetJet ? 0.94 : 0.965;
    var cycle = b.friendly ? 2.6 : targetJet ? 1.2 : 1.7;
    var burst = b.friendly ? 0.5 : targetJet ? 0.95 : 0.8;
    var lead = add(target, mul(targetVel || { x: 0, y: 0, z: 0 }, Math.min(2, d / CONFIG.gunSpeed)));
    var aim = unit(sub(lead, b.pos));
    if (dot(unit(b.vel), aim) < cone) return;
    // long bursts with only a short break: the F-16s keep the gun in the fight
    if (d < gunRange && now >= b.gunAt && b.gun > 0 && now % cycle < burst) {
      b.gunAt = now + 0.07; b.gun -= 1;
      var start = add(b.pos, mul(unit(b.vel), 15));
      var spread = unit(add(aim, { x: (Math.random() - 0.5) * 0.009, y: (Math.random() - 0.5) * 0.009, z: (Math.random() - 0.5) * 0.009 }));
      state.bullets.push({ pos: start, vel: add(b.vel, mul(spread, CONFIG.gunSpeed)), life: CONFIG.gunLife, lla: toLla(start), plla: toLla(start), owner: owner });
      if (b.friendly && now > (b.sayGunAt || 0)) { b.sayGunAt = now + 4.5; callout('NAVY 2: GUNS GUNS', 'friendly'); }
    }
    // Navy 2 carries four AIM-9s and takes the shot when he is pointed at one.
    if (b.friendly && targetJet && targetJet.alive && b.a9 > 0 && now >= (b.a9At || 0) && d > 800 && d < 5000) {
      b.a9 -= 1; b.a9At = now + 45;
      launchAim9('wingman', b.pos, b.vel, targetJet, false);
      callout('NAVY 2: FOX TWO', 'friendly');
    }
    var rocketRange = b.friendly ? 2400 : targetJet ? CONFIG.banditFireRange : 2800;
    if (d > rocketRange || d < 420 || now < b.readyAt || b.rockets < 2) return;
    b.readyAt = now + CONFIG.banditReload * (b.friendly ? 1.6 : targetJet ? 1 : 1.5); b.rockets -= 2;
    var rocketAim = unit(sub(add(target, mul(targetVel || { x: 0, y: 0, z: 0 }, d / (800 + b.speed))), b.pos));
    var right = unit(cross(unit(b.vel), unit(b.pos)));
    for (var i = 0; i < 2; i++) {
      var at = add(add(b.pos, mul(unit(b.vel), 12)), mul(right, i ? 3 : -3));
      state.sead.push({ pos: at, vel: add(b.vel, mul(rocketAim, 800)), life: 0, ttl: 14, trail: [], smokeGap: 0, lla: toLla(at), owner: owner });
    }
    if (state.ppos && dist(b.pos, state.ppos) < 4000) env.sound().sead();
    if (b.friendly) callout('NAVY 2: RIFLE — ROCKETS AWAY', 'friendly');
  }
  // Navy 2 defends itself: any missile locked on it gets flares or chaff, and
  // inside 3 km it breaks across the round instead of flying into it.
  function wingmanDefend(w, dt) {
    w.cmAt = (w.cmAt || 0) - dt;
    w.sayCm = (w.sayCm || 0) - dt;
    var threat = null, closest = Infinity;
    for (var i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      if (m.targetJet !== w || m.decoy) continue;
      var d = dist(m.pos, w.pos);
      if (d < closest && d < 3500) { closest = d; threat = m; }
    }
    if (!threat) return null;
    // Same countermeasure fit as the player: unlimited flares and chaff.
    var isIR = threat.seeker === 'IR';
    if (w.cmAt <= 0) {
      dispenseAt(w.pos, w.vel, isIR ? 'IR' : 'RADAR', 2);
      w.cmAt = 1.2;
      if (w.sayCm <= 0) {
        w.sayCm = 4;
        callout('NAVY 2: ' + (isIR ? 'FLARES' : 'CHAFF') + ' — DECOYING', 'alert');
      }
    }
    return threat;
  }
  function stationTarget() {
    var f = env.aimDir(state.pvel), r = headingVec(state.plla.lat, state.plla.lon, (state.heading || 0) + 90);
    return add(add(add(state.ppos, mul(f, -65)), mul(r, 85)), mul(unit(state.ppos), 25));
  }
  // Every change of job goes out over the radio, throttled so a jinking fight
  // cannot spam the panel.
  function setPhase(w, phase, now) {
    if (w.phase === phase) return;
    w.phase = phase;
    if (now - (w.phaseAt || 0) < 2.5) return;
    w.phaseAt = now;
    var lines = {
      ENGAGING: ['NAVY 2: BREAKING OFF — ENGAGING', 'friendly'],
      EVADING: ['NAVY 2: BREAK — MISSILE INBOUND', 'alert'],
      FORMATION: ['NAVY 2: REJOINING FORMATION', 'friendly'],
      SWEEP: ['NAVY 2: SWEEPING AHEAD', 'info']
    };
    var line = lines[phase];
    if (line) callout(line[0], line[1]);
  }
  function updateWingman(dt, now, C, viewer) {
    var w = state.wingman;
    if (!w || !w.alive) return;
    var mode = state.wingmanMode || 'AUTO';
    var threat = wingmanDefend(w, dt);

    // ENGAGE hunts across the map, AUTO only takes what comes near, FORMATION
    // stays on the wing whatever is out there.
    var reach = mode === 'ENGAGE' ? 90000 : mode === 'AUTO' ? 16000 : 0;
    var target = null, targetVel = null, targetJet = null, best = Infinity, i;
    for (i = 0; reach > 0 && i < state.bandits.length; i++) {
      var b = state.bandits[i];
      if (!b.alive) continue;
      var d = dist(w.pos, b.pos);
      if (d < best && d < reach) { best = d; target = b.pos; targetVel = b.vel; targetJet = b; }
    }
    var siteReach = mode === 'ENGAGE' ? 45000 : mode === 'AUTO' ? 9000 : 0;
    for (i = 0; !target && state.armed && (w.rockets > 0 || w.gun > 0) && i < state.sites.length; i++) {
      var site = state.sites[i];
      if (site.alive === false || site.active === false) continue;
      var sd = dist(w.pos, site.ecef);
      if (sd < best && sd < siteReach) { best = sd; target = add(site.ecef, mul(unit(site.ecef), 6)); targetVel = null; }
    }
    // AUTO is left to its own judgement: it wanders off the wing now and then
    // and comes back on its own
    if (mode === 'AUTO' && !target && now > (w.patrolAt || 0)) {
      w.patrolAt = now + 34 + Math.random() * 22;
      w.patrolUntil = now + 11 + Math.random() * 7;
      w.patrolSide = Math.random() < 0.5 ? -1 : 1;
    }

    if (threat) {
      setPhase(w, 'EVADING', now);
      var side = unit(cross(unit(w.vel), unit(w.pos)));
      if (!isFinite(side.x) || len(side) < 0.3) side = headingVec(w.lla.lat, w.lla.lon, (state.heading || 0) + 90);
      steerJet(w, add(add(w.pos, mul(side, 2600)), mul(unit(w.vel), 900)), dt, CONFIG.wingmanSpeed);
    } else if (target && (w.gun > 0 || w.rockets > 0)) {
      setPhase(w, 'ENGAGING', now);
      steerJet(w, target, dt, CONFIG.wingmanSpeed);
      fireAt(w, target, targetVel, now, targetJet);
    } else if (mode === 'ENGAGE' || (mode === 'AUTO' && now < (w.patrolUntil || 0))) {
      // nothing in reach: sweep out ahead of the flight and go looking for work
      setPhase(w, 'SWEEP', now);
      var fwd = env.aimDir(state.pvel);
      var sweep = add(add(state.ppos, mul(fwd, mode === 'ENGAGE' ? 24000 : 9000)),
        mul(headingVec(state.plla.lat, state.plla.lon, (state.heading || 0) + 90), (w.patrolSide || 1) * 3000));
      steerJet(w, sweep, dt, CONFIG.wingmanSpeed);
    } else {
      setPhase(w, 'FORMATION', now);
      var before = unit(w.vel), station = stationTarget();
      // Formation velocity matching, no teleporting or mandatory minimum speed.
      var correction = mul(sub(station, w.pos), 0.65), magnitude = len(correction);
      if (magnitude > 150) correction = mul(correction, 150 / magnitude);
      var velocity = add(state.pvel, correction);
      w.vel = add(w.vel, mul(sub(velocity, w.vel), Math.min(1, dt * 2))); w.speed = len(w.vel);
      w.pos = add(w.pos, mul(w.vel, dt)); w.lla = toLla(w.pos);
      var dh = headingOf(w, unit(w.vel)) - headingOf(w, before);
      rollTo(w, Math.atan2(Math.sin(dh), Math.cos(dh)), dt);
    }
    if (w.lla.alt <= ground(w.lla.lat, w.lla.lon) + 2) { kill(w); return; }
    if (!w.built) buildJet(C, viewer, w); placeJet(C, w);
  }
  function update(dt, now) {
    var C = C3(), viewer = getViewer();
    if (!C || !viewer || !viewer.scene || !viewer.entities) return;
    spawn();
    refreshWeather(now);
    for (var i = 0; i < state.bandits.length; i++) {
      var b = state.bandits[i]; if (!b.alive) continue;
      var w = state.wingman, target = state.ppos, velocity = state.pvel, d = dist(b.pos, target);
      if (w && w.alive && dist(b.pos, w.pos) < d * 0.98) { target = w.pos; velocity = w.vel; d = dist(b.pos, target); }
      b.phase = d > 6500 ? 'APPROACH' : 'DOGFIGHT';
      // climb for a height advantage on the way in, then dive onto the target,
      // each jet on its own line so the pair never flies the same path
      var aim = add(target, mul(velocity, Math.min(2, d / CONFIG.banditSpeed)));
      aim = add(aim, mul(unit(b.pos), d > 7000 ? 700 : d > 1600 ? -280 : 0));
      aim = add(aim, mul(headingVec(b.lla.lat, b.lla.lon, (state.heading || 0) + 90), b.offset || 0));
      // run the target down at full speed until the merge, then slow to fight
      steerJet(b, aim, dt, d > 3000 ? (CONFIG.banditMaxSpeed || 335) : CONFIG.banditSpeed);
      if (now * 1000 >= state.hitUntil || target !== state.ppos) fireAt(b, target, velocity, now, target === state.ppos ? null : w);
      banditDefend(b, dt);
      // two AIM-9s per F-16, fired when the target is inside the seeker cone
      // shooting at the player, a bandit gets a shorter, narrower AIM-9 envelope
      var onPlayer = target === state.ppos;
      if (now >= (b.a9At || 0) && b.a9 > 0 && d < (onPlayer ? 5000 : 7500) && d > 600) {
        var aimVec = unit(sub(target, b.pos));
        if (dot(unit(b.vel), aimVec) > (onPlayer ? 0.95 : 0.9)) {
          b.a9 -= 1; b.a9At = now + (onPlayer ? 26 : 18);
          launchAim9('bandit', b.pos, b.vel, onPlayer ? null : w, onPlayer);
        }
      }
      if (!b.built) buildJet(C, viewer, b); placeJet(C, b);
    }
    updateWingman(dt, now, C, viewer); updateWrecks(dt, C, viewer);
  }
  // Wipe every AI airframe out of the scene so a reset starts from a clean sky.
  function reset() {
    var viewer = getViewer(), C = C3();
    var all = state.bandits.concat(state.wrecks, state.wingman ? [state.wingman] : []);
    for (var i = 0; i < all.length; i++) {
      if (!all[i] || !viewer) continue;
      try { removeJet(all[i], C, viewer); } catch (e) { /* already gone */ }
    }
    state.bandits = []; state.wrecks = []; state.wingman = null; state.banditsSpawned = false;
  }
  return { update: update, kill: kill, hit: hit, ground: ground, reset: reset, spawnBandits: spawnBandits };
}
  var AIR = installAircraft({
    state: state, config: CONFIG, C3: C3, viewer: getViewer, ecef: ecef, toLla: toLla,
    add: add, sub: sub, mul: mul, unit: unit, len: len, dist: dist,
    burst: burst, smoke: addSmoke, flash: flash, sound: function () { return SFX; }, aimDir: aimDir,
    dispenseAt: dispenseAt, callout: callout
  });

  // Included verbatim inside the downloadable userscript; no runtime imports.
// AIM-9 dogfight missiles (player, Navy 2, F-16s) and the field SAM spawner.
function installAirDefense(env) {
  var state = env.state, CONFIG = env.config;
  var ecef = env.ecef, toLla = env.toLla, add = env.add, sub = env.sub;
  var mul = env.mul, unit = env.unit, len = env.len, dist = env.dist;
  var segDist = env.segDist, burst = env.burst, addSmoke = env.smoke;
  var flash = env.flash, callout = env.callout || function () {};
  var ground = env.ground;

  var PRESETS = {
    RADAR: { system: 'SA-6 Gainful', range: 24000, speed: 800, maxG: 18, rounds: 4, reload: 32, armor: 3 },
    IR: { system: 'SA-13 Gopher', range: 5000, speed: 550, maxG: 20, rounds: 8, reload: 18, armor: 1 }
  };

  function beep() { var s = env.sound(); if (s && s.deny) s.deny(); }
  function whoosh() { var s = env.sound(); if (s && s.launch) s.launch(); }

  /* --------------------------- AIM-9 --------------------------- */

  // The seeker only sees heat in a narrow cone off the nose, so a shot needs a
  // held lock first: target inside 9 km, inside ~35 degrees, for 1.2 seconds.
  function seekerTarget() {
    var p = state.ppos;
    if (!p) return null;
    var nose = env.aimDir(state.pvel);
    var best = null, bestD = Infinity;
    for (var i = 0; i < state.bandits.length; i++) {
      var b = state.bandits[i];
      if (!b.alive) continue;
      var to = sub(b.pos, p), d = len(to);
      if (d > CONFIG.aim9Range || d < 250) continue;
      var dir = mul(to, 1 / d);
      if (nose.x * dir.x + nose.y * dir.y + nose.z * dir.z < 0.82) continue;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function updateLock(dt) {
    var t = seekerTarget();
    if (!t || t !== state.aim9Target) { state.aim9Target = t; state.aim9LockT = 0; return; }
    state.aim9LockT += dt;
  }

  function isLocked() {
    return !!state.aim9Target && state.aim9Target.alive && state.aim9LockT >= CONFIG.aim9Lock;
  }

  function launch(owner, from, vel, target, vsPlayer) {
    if (!state.aim9) state.aim9 = [];
    var dir = len(vel) > 5 ? unit(vel) : env.aimDir(state.pvel || { x: 0, y: 0, z: 0 });
    var start = add(from, mul(dir, 12));
    state.aim9.push({
      owner: owner, target: target || null, vsPlayer: !!vsPlayer,
      pos: start, vel: mul(dir, 380), speed: 380,
      life: 0, ttl: CONFIG.aim9Life, smokeGap: 0, lla: toLla(start), decoy: null, rollAt: 0
    });
    whoosh();
  }

  function fire() {
    var p = state.ppos;
    if (!p) { flash('NO AIRCRAFT YET'); beep(); return false; }
    if (!state.aim9Left) { flash('NO AIM-9 LEFT'); beep(); return false; }
    if (!isLocked()) { flash('AIM-9 — NO LOCK'); beep(); return false; }
    state.aim9Left -= 1;
    launch('player', p, state.pvel, state.aim9Target, false);
    flash('AIM-9 AWAY — ' + state.aim9Target.label);
    return true;
  }

  // An AIM-9 chases the aircraft, never a launcher: flares are the only thing
  // that spoils it, which is why the F-16s carry them. Only flares burning near
  // the aircraft the round is chasing can pull it off.
  function pickFlare(m, now) {
    if (now < (m.rollAt || 0)) return null;
    m.rollAt = now + 0.2;
    var ref = m.target && m.target.alive ? m.target.pos : state.ppos;
    if (!ref) return null;
    var cur = unit(m.vel), best = null, bestD = Infinity;
    for (var i = 0; i < state.flares.length; i++) {
      var f = state.flares[i];
      if (dist(f.pos, ref) > 1800) continue;
      var d = dist(f.pos, m.pos);
      if (d > 2200) continue;
      var dir = unit(sub(f.pos, m.pos));
      if (dir.x * cur.x + dir.y * cur.y + dir.z * cur.z < 0.35) continue;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (!best) return null;
    return Math.random() < CONFIG.flareEffect * (1 - bestD / 2200) ? best : null;
  }

  function update(dt, now) {
    if (!state.aim9) state.aim9 = [];
    updateLock(dt);
    var grace = state.simTime * 1000 < state.hitUntil;
    for (var i = state.aim9.length - 1; i >= 0; i--) {
      var m = state.aim9[i];
      m.life += dt;
      var from = m.pos;
      if (m.target && !m.target.alive) { burst(m.pos, 0.8); env.dropBody(m); state.aim9.splice(i, 1); continue; }
      if (!m.decoy) m.decoy = pickFlare(m, now);
      var aim = m.decoy ? m.decoy.pos : (m.target ? m.target.pos : (m.vsPlayer ? state.ppos : null));
      if (!aim) { env.dropBody(m); state.aim9.splice(i, 1); continue; }

      m.speed = Math.min(CONFIG.aim9Speed, m.speed + 900 * dt);
      var to = sub(aim, m.pos), dd = len(to) || 1;
      var des = mul(to, 1 / dd);
      var cur = unit(m.vel);
      var dv = Math.max(-1, Math.min(1, cur.x * des.x + cur.y * des.y + cur.z * des.z));
      var ang = Math.acos(dv);
      var turn = Math.min(ang, ((CONFIG.aim9TurnG * 9.81) / Math.max(150, m.speed)) * dt);
      var t = ang > 1e-6 ? turn / ang : 1;
      m.vel = mul(unit(add(mul(cur, 1 - t), mul(des, t))), m.speed);
      m.pos = add(m.pos, mul(m.vel, dt));
      m.lla = toLla(m.pos);

      m.smokeGap -= len(m.vel) * dt;
      if (m.smokeGap <= 0) {
        m.smokeGap = CONFIG.rocketSmokeGap;
        addSmoke(m.pos, 7, CONFIG.smokeLife, 0.42);
      }

      if (m.decoy && segDist(from, m.pos, m.decoy.pos) < 60) {
        burst(m.pos, 0.7); env.dropBody(m); state.aim9.splice(i, 1); continue;
      }
      if (m.owner === 'bandit') {
        if (m.target && m.target.alive && segDist(from, m.pos, m.target.pos) < 30) {
          env.killJet(m.target); burst(m.pos, 1.6); env.dropBody(m); state.aim9.splice(i, 1); continue;
        }
        if (!grace && m.vsPlayer && state.ppos && segDist(from, m.pos, state.ppos) < 30) {
          env.playerHit(); burst(m.pos, 1.6); env.dropBody(m); state.aim9.splice(i, 1); continue;
        }
      } else {
        var hitJet = null;
        for (var j = 0; j < state.bandits.length; j++) {
          var bj = state.bandits[j];
          if (!bj.alive) continue;
          if (segDist(from, m.pos, bj.pos) < 30) { hitJet = bj; break; }
        }
        if (hitJet) { env.killJet(hitJet); burst(m.pos, 1.6); env.dropBody(m); state.aim9.splice(i, 1); continue; }
      }
      if (m.life > m.ttl || m.lla.alt < ground(m.lla.lat, m.lla.lon)) {
        env.dropBody(m); state.aim9.splice(i, 1);
      }
    }
  }

  function draw(ctx, proj) {
    if (!proj) return;
    for (var i = 0; i < state.aim9.length; i++) {
      var m = state.aim9[i];
      var sp = proj.project(m.lla.lat, m.lla.lon, m.lla.alt);
      if (!sp) continue;
      var hot = m.owner === 'bandit';
      ctx.strokeStyle = hot ? '#ff5a3c' : '#f6f2e6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hot ? '#ff8a72' : '#ffffff';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function aim9Text() {
    var n = state.aim9Left;
    if (isLocked()) return 'AIM-9 ' + n + ' · LOCK';
    if (state.aim9Target) return 'AIM-9 ' + n + ' · SEEK';
    return 'AIM-9 ' + n;
  }

  /* ---------------------- field SAM spawner --------------------- */

  // A battery placed under the aircraft, on whatever ground is there. It sits
  // OFFLINE, with its launcher vans on the terrain, until GO arms it.
  function spawnSite() {
    var p = state.plla;
    if (!p) { flash('NO AIRCRAFT YET'); beep(); return false; }
    var kind = state.spawnKind === 'IR' ? 'IR' : 'RADAR';
    var preset = PRESETS[kind];
    var n = state.customSites.length + 1;
    var alt = ground(p.lat, p.lon) || 0;
    var site = {
      id: 'field-' + n + '-' + Math.round(Math.random() * 99999),
      name: 'Field Site ' + n, short: 'SITE ' + n, system: preset.system,
      lat: p.lat, lon: p.lon, alt: alt,
      range: preset.range, speed: preset.speed, maxG: preset.maxG,
      seeker: kind, rounds: preset.rounds, reload: preset.reload,
      ecef: ecef(p.lat, p.lon, alt), track: 0, readyAt: 0,
      armor: preset.armor, hp: preset.armor,
      status: 'OFFLINE', alive: true, active: false, custom: true, entities: []
    };
    state.sites.push(site);
    state.customSites.push(site);
    env.buildFleet();
    flash('BATTERY SET — ' + site.short + ' · ' + kind + ' (OFFLINE)');
    return true;
  }

  function activate() {
    var n = 0;
    for (var i = 0; i < state.customSites.length; i++) {
      var s = state.customSites[i];
      if (s.alive === false) continue;
      s.active = true;
      s.status = 'IDLE';
      n += 1;
    }
    if (!n) { flash('NO FIELD SITES — PRESS SET'); beep(); return; }
    flash('FIELD SITES ACTIVE — ' + n);
    callout('NETWORK: ' + n + ' FIELD SITES ONLINE', 'alert');
  }

  function counts() {
    var total = state.customSites.length, online = 0;
    for (var i = 0; i < total; i++) {
      var s = state.customSites[i];
      if (s.active && s.alive !== false) online += 1;
    }
    return { total: total, online: online };
  }

  function panelHtml() {
    return '<div class="hd" id="sam-sp-hd"><i></i>SAM SPAWNER<span class="caret">▾</span></div>' +
      '<div class="gr">' +
      '<span>FIELD SITES</span><b id="sam-sp-count">0</b>' +
      '<span>STATE</span><b id="sam-sp-state">—</b>' +
      '</div>' +
      '<div class="cm"><button id="sam-sp-radar" class="on">RADAR</button><button id="sam-sp-ir">IR</button></div>' +
      '<div class="cm"><button id="sam-sp-set">SET</button><button id="sam-sp-go">GO</button></div>' +
      '<div class="hint">SET places a battery under you · GO arms them</div>';
  }

  function wire(toggle) {
    var radar = document.getElementById('sam-sp-radar');
    var ir = document.getElementById('sam-sp-ir');
    function paint() {
      if (radar) radar.className = state.spawnKind === 'IR' ? '' : 'on';
      if (ir) ir.className = state.spawnKind === 'IR' ? 'on' : '';
    }
    if (radar) radar.addEventListener('click', function () { state.spawnKind = 'RADAR'; paint(); });
    if (ir) ir.addEventListener('click', function () { state.spawnKind = 'IR'; paint(); });
    paint();
    var setb = document.getElementById('sam-sp-set');
    if (setb) setb.addEventListener('click', function () {
      var s = env.sound();
      if (s && s.unlock) s.unlock();
      spawnSite();
    });
    var gob = document.getElementById('sam-sp-go');
    if (gob) gob.addEventListener('click', function () {
      var s = env.sound();
      if (s && s.unlock) s.unlock();
      activate();
    });
    var hd = document.getElementById('sam-sp-hd');
    if (hd && toggle) hd.addEventListener('click', toggle);
  }

  function reset() {
    if (state.aim9) {
      for (var i = state.aim9.length - 1; i >= 0; i--) {
        env.dropBody(state.aim9[i]);
        state.aim9.splice(i, 1);
      }
    }
    state.aim9Target = null;
    state.aim9LockT = 0;
    state.aim9Left = CONFIG.playerAim9;
    state.playerHp = CONFIG.playerHp;
    for (var j = 0; j < state.customSites.length; j++) {
      var idx = state.sites.indexOf(state.customSites[j]);
      if (idx >= 0) state.sites.splice(idx, 1);
    }
    state.customSites = [];
    env.buildFleet();
  }

  return {
    update: update, fire: fire, draw: draw, launch: launch, locked: isLocked,
    aim9Text: aim9Text, spawnSite: spawnSite, activate: activate,
    counts: counts, panelHtml: panelHtml, wire: wire, reset: reset
  };
}
  var AD = installAirDefense({
    state: state, config: CONFIG, C3: C3, ecef: ecef, toLla: toLla,
    add: add, sub: sub, mul: mul, unit: unit, len: len, dist: dist, segDist: segDist,
    burst: burst, smoke: addSmoke, flash: flash, sound: function () { return SFX; },
    aimDir: aimDir, callout: callout,
    ground: function (lat, lon) { return AIR.ground(lat, lon); },
    buildFleet: buildFleet, dropBody: dropBody, playerHit: playerHit,
    killJet: function (jet) { AIR.kill(jet); }
  });

  // Included verbatim inside the downloadable userscript; no runtime imports.
// The two cues sit where the real HUD glass sits: a gun funnel while the
// trigger is down and the AIM-9 seeker circle while that weapon is selected.
// Both are projected from the aircraft's nose, so they follow it in a turn.
function installHudOverlay(env) {
  var state = env.state, add = env.add, mul = env.mul;
  var aimDir = env.aimDir, toLla = env.toLla, AD = env.AD;
  var GREEN = '126,255,170';

  function boresight(proj, meters) {
    if (!proj || !state.ppos) return null;
    var lla = toLla(add(state.ppos, mul(aimDir(state.pvel), meters)));
    return proj.project(lla.lat, lla.lon, lla.alt);
  }

  function cross(ctx, x, y, r, colour) {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r * 0.42, y);
    ctx.moveTo(x + r * 0.42, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y - r * 0.42);
    ctx.moveTo(x, y + r * 0.42);
    ctx.lineTo(x, y + r);
    ctx.stroke();
  }

  // F/A-18 gun funnel: nested arcs the target's wingspan fits, closing onto
  // the pipper as the range comes down.
  function funnel(ctx, c, alpha) {
    var colour = 'rgba(' + GREEN + ',' + alpha.toFixed(2) + ')';
    var base = Math.max(70, Math.min(150, window.innerHeight * 0.19));
    var radii = [base, base * 0.72, base * 0.5];
    var a0 = -Math.PI * 0.8, a1 = -Math.PI * 0.2;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.4;
    for (var i = 0; i < radii.length; i++) {
      var r = radii[i];
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, a0, a1);
      ctx.stroke();
      // end ticks, longer on the outer arc where the wingspan brackets sit
      var tick = i === 0 ? 11 : 6;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a0) * r, c.y + Math.sin(a0) * r);
      ctx.lineTo(c.x + Math.cos(a0) * (r + tick), c.y + Math.sin(a0) * (r + tick));
      ctx.moveTo(c.x + Math.cos(a1) * r, c.y + Math.sin(a1) * r);
      ctx.lineTo(c.x + Math.cos(a1) * (r + tick), c.y + Math.sin(a1) * (r + tick));
      ctx.stroke();
    }
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 8);
    ctx.lineTo(c.x, c.y - base * 1.04);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.2, 0, Math.PI * 2);
    ctx.stroke();
    cross(ctx, c.x, c.y, 10, colour);
    ctx.fillStyle = colour;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('GUN', c.x + base * 0.66, c.y - base * 0.7);
  }

  function seeker(ctx, w, h) {
    var locked = AD.locked();
    var c = null, t = state.aim9Target;
    if (t && t.alive && state.projector) c = state.projector.project(t.lla.lat, t.lla.lon, t.lla.alt);
    if (!c) c = boresight(state.projector, 1500) || { x: w / 2, y: h * 0.46 };
    var r = locked ? 27 : 21;
    var colour = locked ? 'rgba(160,255,200,0.95)' : 'rgba(' + GREEN + ',0.5)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.3;
    if (!locked) ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    cross(ctx, c.x, c.y, r + 7, colour);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(locked ? 'AIM-9 LOCK' : 'AIM-9 SEARCH', c.x + r + 9, c.y + 3);
  }

  function draw(ctx, w, h, now) {
    if (state.paused || !state.ppos) return;
    if (state.gunHeld) state.funnelUntil = now + 0.7;
    var alpha = Math.max(0, Math.min(1, ((state.funnelUntil || 0) - now) / 0.6));
    if (alpha > 0.02) funnel(ctx, boresight(state.projector, 1200) || { x: w / 2, y: h * 0.46 }, alpha);
    if (state.weapon === 'AIM9') seeker(ctx, w, h);
  }

  return { draw: draw };
}
  var HUD = installHudOverlay({
    state: state, add: add, mul: mul, aimDir: aimDir, toLla: toLla, AD: AD
  });

  function playerHit() {
    state.kills += 1;
    state.hitUntil = state.simTime * 1000 + 9000;
    state.playerHp = CONFIG.playerHp;
    addShake(14, 5);
    flash('IMPACT — AIRCRAFT DESTROYED');
  }

  // A single round does not down a fighter: the airframe takes damage, and only
  // a round through the fuselage core (engine, cockpit, fuel) is an instant kill.
  function hitPlayer(critical) {
    if (critical) { playerHit(); return; }
    state.playerHp -= 1;
    if (state.playerHp <= 0) { playerHit(); return; }
    addShake(3.5, 0.5);
    SFX.explosion(0.22);
    flash('HIT — AIRFRAME ' + state.playerHp + '/' + CONFIG.playerHp);
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
      if (state.ppos && dist(s.ecef, state.ppos) > CONFIG.siteVisible) continue;
      var c = proj.project(s.lat, s.lon, (s.alt || 0) + 3);
      if (!c) continue;
      var hot = s.status === 'TRACK' || s.status === 'LAUNCH';
      drawBattery(ctx, s, c, hot || i === nearestIdx);
    }

    var visibleJets = state.bandits.slice();
    if (state.wingman) visibleJets.push(state.wingman);
    for (i = 0; i < visibleJets.length; i++) {
      var bd = visibleJets[i];
      if (!bd.alive) continue;
      var jp = proj.project(bd.lla.lat, bd.lla.lon, bd.lla.alt);
      if (!jp) continue;
      ctx.strokeStyle = bd.friendly ? '#7fe3b0' : '#ff5a3c';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(jp.x, jp.y - 6);
      ctx.lineTo(jp.x + 6, jp.y);
      ctx.lineTo(jp.x, jp.y + 6);
      ctx.lineTo(jp.x - 6, jp.y);
      ctx.closePath();
      ctx.stroke();
      if (state.ppos && dist(bd.pos, state.ppos) < 9000) {
        ctx.font = '10px ui-monospace, monospace';
        var jt = bd.label;
        var jw = ctx.measureText(jt).width;
        ctx.fillStyle = 'rgba(10,13,17,0.8)';
        ctx.fillRect(jp.x - jw / 2 - 4, jp.y + 9, jw + 8, 14);
        ctx.fillStyle = bd.friendly ? '#7fe3b0' : '#ff8a72';
        ctx.textAlign = 'center';
        ctx.fillText(jt, jp.x, jp.y + 19);
        ctx.textAlign = 'left';
      }
    }

    // Canvas smoke is only the fallback. With the Cesium layer up the puffs
    // are billboards, so the cockpit occludes them the way it should.
    if (!WORLD.ready) {
      for (i = 0; i < state.smoke.length; i++) {
        var puf = state.smoke[i];
        var sp2 = proj.project(puf.lla.lat, puf.lla.lon, puf.lla.alt);
        if (!sp2) continue;
        var pk = puf.life / puf.ttl;
        var r = Math.max(1, Math.min(40, puf.size));
        // hold density through most of the life, then thin out at the end
        drawPuff(ctx, puf.kind === 'fire' ? fireSprite() : smokeSprite(), sp2.x, sp2.y, r, puf.alpha * Math.min(1, pk / 0.2));
      }
    }

    // Missiles always carry a ring on the glass as well as their body in the
    // scene: a 6 m round at 15 km is a couple of pixels, and you need to know
    // where the thing hunting you is.
    for (i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      var mp = proj.project(m.lla.lat, m.lla.lon, m.lla.alt);
      if (!mp) continue;
      var mc = m.decoy ? '#7fd7ff' : '#ff3b2f';
      ctx.fillStyle = mc;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mc;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 7.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (i = 0; i < state.sead.length; i++) {
      var rk = state.sead[i];
      var sp = proj.project(rk.lla.lat, rk.lla.lon, rk.lla.alt);
      if (!sp) continue;
      ctx.fillStyle = rk.owner === 'bandit' ? '#ff8a72' : '#f6f2e6';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    AD.draw(ctx, proj);

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
    var head = (state.heading || 0) * D2R;

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
      if (state.ppos && dist(s.ecef, state.ppos) > CONFIG.siteVisible) continue;
      if (s.alive === false) {
        plot(s.lat, s.lon, 'rgba(140,140,140,0.7)', 2.6, true);
        continue;
      }
      var hot = s.status === 'TRACK' || s.status === 'LAUNCH';
      plot(s.lat, s.lon, hot ? '#ff6a3d' : '#e0b24a', hot ? 3 : 2.4, false);
    }
    for (i = 0; i < state.bandits.length; i++) {
      if (!state.bandits[i].alive) continue;
      plot(state.bandits[i].lla.lat, state.bandits[i].lla.lon, '#ff5a3c', 3, true);
    }
    if (state.wingman && state.wingman.alive) plot(state.wingman.lla.lat, state.wingman.lla.lon, '#7fe3b0', 3.5, false);
    for (i = 0; i < state.missiles.length; i++) {
      var m = state.missiles[i];
      plot(m.lla.lat, m.lla.lon, m.decoy ? '#7fd7ff' : '#ff5a3c', 1.8, false);
    }
    for (i = 0; i < state.sead.length; i++) {
      var sk = state.sead[i];
      plot(sk.lla.lat, sk.lla.lon, sk.owner === 'bandit' ? '#ff8a72' : '#7fd7ff', 1.6, false);
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
    ctx.fillText('HDG ' + String(Math.round((state.heading + 360) % 360)).padStart(3, '0'), x0 + 5, y0 + 11);
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
    if (state.simTime * 1000 < state.hitUntil) {
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
    HUD.draw(ctx, w, h, now);
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

  // Self-contained rotary-cannon synthesis, embedded in the downloaded script.
function makeRotaryAudio(c, destination) {
  var duration = 2, count = Math.floor(c.sampleRate * duration);
  var buffer = c.createBuffer(1, count, c.sampleRate), data = buffer.getChannelData(0);
  var low = 0;
  for (var i = 0; i < count; i++) {
    var t = i / c.sampleRate, phase = (t * 96) % 1;
    var noise = Math.random() * 2 - 1;
    low = low * 0.92 + noise * 0.08;
    var crack = Math.exp(-phase * 42);
    var body = Math.sin(t * Math.PI * 2 * 96) * 0.32 + Math.sin(t * Math.PI * 2 * 48) * 0.2;
    data[i] = Math.tanh((noise * (0.14 + crack * 1.8) + low * 2.8 + body) * 1.35) * 0.88;
  }
  var source = c.createBufferSource(), high = c.createBiquadFilter();
  var lowpass = c.createBiquadFilter(), gain = c.createGain(), active = false;
  source.buffer = buffer; source.loop = true;
  high.type = 'highpass'; high.frequency.value = 48;
  lowpass.type = 'lowpass'; lowpass.frequency.value = 6200; lowpass.Q.value = 0.65;
  gain.gain.value = 0;
  source.connect(high); high.connect(lowpass); lowpass.connect(gain); gain.connect(destination);
  source.start();
  return {
    shoot: function () {
      if (active) return;
      active = true;
      var t = c.currentTime;
      source.playbackRate.cancelScheduledValues(t); source.playbackRate.setValueAtTime(0.76, t);
      source.playbackRate.linearRampToValueAtTime(1, t + 0.12);
      gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0.82, t + 0.035);
    },
    stop: function () {
      if (!active) return;
      active = false;
      var t = c.currentTime;
      gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      source.playbackRate.cancelScheduledValues(t); source.playbackRate.setValueAtTime(source.playbackRate.value, t);
      source.playbackRate.linearRampToValueAtTime(0.55, t + 0.2);
    }
  };
}
  var SFX = (function () {
    var ctx = null;
    var buf = null;
    var rotary = null;
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
    var warnNext = 0;
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
      // Continuous 96-Hz rotary rasp, overlapping cracks, bass and spin-down.
      // Audio cadence changes only the sound, not projectile fire rate.
      gun: function () {
        var c = ac();
        if (!c) return;
        if (!rotary) rotary = makeRotaryAudio(c, bus(c));
        rotary.shoot();
      },
      gunStop: function () { if (rotary) rotary.stop(); },
      deny: function () { tone(180, 0.16, 0.06, 'square', 130); },
      // RWR launch tone: one high beep every interval, tightening as the round
      // closes. Interval 0 silences it.
      warn: function (interval) {
        if (interval <= 0) { warnNext = 0; return; }
        var c = ac();
        if (!c) return;
        var t = performance.now();
        if (t < warnNext) return;
        warnNext = t + interval;
        tone(1240, 0.055, 0.05, 'square');
      }
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

  // Radio traffic on the panel: the wingman calls its own shots and breaks so
  // you can tell what Navy 2 is doing without hunting for it in the sky.
  function callout(text, tone) {
    state.comms.push({ text: text, tone: tone || 'info' });
    if (state.comms.length > 4) state.comms.shift();
  }

  function renderComms() {
    var el = document.getElementById('sam-comms');
    if (!el) return;
    var list = state.comms;
    var sig = '';
    for (var i = 0; i < list.length; i++) sig += list[i].tone + list[i].text + '|';
    if (el.getAttribute('data-sig') === sig) return;
    el.setAttribute('data-sig', sig);
    var html = '';
    for (var j = list.length - 1; j >= 0; j--) {
      html += '<div class="' + list[j].tone + '">' + list[j].text + '</div>';
    }
    el.innerHTML = html;
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
    var options = '<option value="">TELEPORT TO…</option>';
    for (var si = 0; si < state.sites.length; si++) {
      options += '<option value="' + si + '">' + state.sites[si].short + '</option>';
    }
    var stack = document.createElement('div');
    stack.id = 'sam-stack';

    var box = document.createElement('div');
    box.id = 'sam-net';
    box.innerHTML =
      '<div class="hd" id="sam-hd"><i id="sam-led"></i>SAM NETWORK<span class="caret">▾</span></div>' +
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
      '<span>WEATHER</span><b id="sam-wx">—</b>' +
      '<span>ROCKETS</span><b id="sam-sead">READY</b>' +
      '<span>BANDITS</span><b id="sam-bandits">0</b>' +
      '<span>WINGMAN</span><b id="sam-wingman">JOINING</b>' +
      '<span>NAVY LOADOUT</span><b id="sam-loadout">1000 G / 16 R</b>' +
      '<span>AIRFRAME</span><b id="sam-hp">8/8</b>' +
      '<span>HITS TAKEN</span><b id="sam-kills">0</b>' +
      '</div>' +
      '<div class="cm"><button id="sam-flare">FLARES ∞</button><button id="sam-chaff">CHAFF ∞</button></div>' +
      '<div class="cm"><button id="sam-rocket" class="on">ROCKETS 16</button><button id="sam-aim9">AIM-9 4</button></div>' +
      '<div class="cm"><button id="sam-fire">FIRE · L</button><button id="sam-reload">REARM · ⇧U</button></div>' +
      '<div class="row"><select id="sam-tp" title="Fly to a battery">' + options + '</select><button id="sam-go">GO</button></div>' +
      '<div class="row"><select id="sam-wing" title="Task Navy 2"><option value="AUTO">NAVY 2 · AUTO</option><option value="ENGAGE">NAVY 2 · ENGAGE</option><option value="FORMATION">NAVY 2 · FORMATION</option></select></div>' +
      '<div class="full"><button id="sam-spawn" class="spawn">SPAWN F-16s · 20 MI</button></div>' +
      '<div class="full"><button id="sam-reset">RESET EVERYTHING</button></div>' +
      '<div class="comms" id="sam-comms"></div>' +
      '<div class="hint">, flares · . chaff · U weapon · L fire · ⇧U rearm · / gun · J arm</div>' +
      '<div class="diag" id="sam-diag">starting…</div>';
    stack.appendChild(box);

    var spawner = document.createElement('div');
    spawner.id = 'sam-spawner';
    spawner.innerHTML = AD.panelHtml();
    stack.appendChild(spawner);

    document.body.appendChild(stack);

    var fb = document.getElementById('sam-flare');
    var cb = document.getElementById('sam-chaff');
    if (fb) fb.addEventListener('click', function () { dispense('IR', 2); });
    if (cb) cb.addEventListener('click', function () { dispense('RADAR', 2); });
    var rb = document.getElementById('sam-rocket');
    if (rb) rb.addEventListener('click', function () { selectWeapon('ROCKETS'); });
    var a9b = document.getElementById('sam-aim9');
    if (a9b) a9b.addEventListener('click', function () { selectWeapon('AIM9'); });
    var fireb = document.getElementById('sam-fire');
    if (fireb) fireb.addEventListener('click', function () { fireWeapon(); });
    var rearb = document.getElementById('sam-reload');
    if (rearb) rearb.addEventListener('click', function () { reloadWeapon(); });
    var tp = document.getElementById('sam-tp');
    var go = document.getElementById('sam-go');
    if (go) go.addEventListener('click', function () {
      var idx = tp ? parseInt(tp.value, 10) : NaN;
      if (isNaN(idx) || !state.sites[idx]) { flash('PICK A BATTERY'); SFX.deny(); return; }
      teleportTo(state.sites[idx]);
    });
    var rst = document.getElementById('sam-reset');
    if (rst) rst.addEventListener('click', function () { resetAll(); });
    // Two F-16s, 20 miles out from wherever the aircraft is right now.
    var spb = document.getElementById('sam-spawn');
    if (spb) spb.addEventListener('click', function () {
      SFX.unlock();
      var n = AIR.spawnBandits ? AIR.spawnBandits() : 0;
      if (n) { flash('F-16s INBOUND — 20 MI'); callout('NETWORK: ' + n + ' BANDITS 20 MILES OUT', 'alert'); }
      else if (state.ppos) { flash('SKY FULL — SIX BANDITS UP'); SFX.deny(); }
      else { flash('NO AIRCRAFT YET'); SFX.deny(); }
    });
    var wsel = document.getElementById('sam-wing');
    if (wsel) wsel.addEventListener('change', function () {
      state.wingmanMode = wsel.value;
      flash('NAVY 2 — ' + wsel.value);
      callout(wsel.value === 'FORMATION' ? 'NAVY 2: REJOINING FORMATION' : wsel.value === 'ENGAGE' ? 'NAVY 2: BREAKING OFF — ENGAGE' : 'NAVY 2: AUTO — ON MY OWN', wsel.value === 'ENGAGE' ? 'alert' : 'friendly');
    });

    // Only one panel is open at a time: opening one folds the other away, and
    // closing it brings both headers back.
    function setPanel(which) {
      state.panelOpen = which;
      box.classList.toggle('collapsed', which !== 'main');
      spawner.classList.toggle('collapsed', which !== 'spawner');
    }
    var hd = document.getElementById('sam-hd');
    if (hd) hd.addEventListener('click', function () { setPanel(state.panelOpen === 'main' ? null : 'main'); });
    AD.wire(function () { setPanel(state.panelOpen === 'spawner' ? null : 'spawner'); });
    setPanel(state.panelOpen || null);

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
    setText('sam-status', state.paused ? 'PAUSED' : state.armed ? (nearest ? nearest.status : 'IDLE') : 'DISARMED');
    setText('sam-range', nearest ? (nearestD / 1000).toFixed(1) + ' KM' : '—');
    setText('sam-alt', Math.round((state.palt || 0) * 3.281) + ' FT');
    setText('sam-inbound', String(state.missiles.length - decoyed));
    setText('sam-seeker', cm ? cm.seeker : '—');
    setText('sam-decoyed', String(decoyed));
    setText('sam-closest', closest < Infinity ? (closest / 1000).toFixed(1) + ' KM' : '—');
    setText('sam-sites', alive + '/' + state.sites.length);
    setText('sam-wx', state.weather || '—');
    var jets = 0;
    for (i = 0; i < state.bandits.length; i++) if (state.bandits[i].alive) jets += 1;
    setText('sam-bandits', String(jets));
    var w = state.wingman;
    setText('sam-wingman', w ? ((state.wingmanMode || 'AUTO') === 'AUTO' ? w.phase : state.wingmanMode + ' · ' + w.phase) : 'JOINING');
    setText('sam-loadout', w && w.alive ? w.gun + ' G / ' + w.rockets + ' R / ' + w.a9 + ' A9' : '—');
    setText('sam-hp', (state.playerHp || 0) + '/' + CONFIG.playerHp);
    var rkb = document.getElementById('sam-rocket');
    if (rkb) {
      var rt = 'ROCKETS ' + state.rocketsLeft;
      if (rkb.textContent !== rt) rkb.textContent = rt;
      rkb.className = state.weapon === 'ROCKETS' ? 'on' : '';
    }
    var a9 = document.getElementById('sam-aim9');
    if (a9) {
      var t9 = AD.locked() ? 'AIM-9 · LOCK' : 'AIM-9 ' + state.aim9Left;
      if (a9.textContent !== t9) a9.textContent = t9;
      a9.className = state.weapon === 'AIM9' ? 'on' : '';
    }
    var cc = AD.counts();
    setText('sam-sp-count', String(cc.total));
    setText('sam-sp-state', cc.total ? (cc.online ? cc.online + ' ONLINE' : 'OFFLINE') : '—');
    var mine = 0;
    for (i = 0; i < state.sead.length; i++) if (state.sead[i].owner !== 'bandit') mine += 1;
    setText('sam-sead', mine ? mine + ' AWAY' : 'READY');
    setText('sam-kills', String(state.kills));
    renderComms();

    if (!window.geofs) diag('window.geofs not found — is GeoFS loaded?', true);
    else if (!C3()) diag('Cesium not exposed yet', true);
    else if (!p) diag('waiting for aircraft position…', true);
    else if (!state.projector) diag('scope only · no screen projector', false);
    else {
      var aircraft = state.bandits.slice();
      if (state.wingman) aircraft.push(state.wingman);
      var loaded = 0, fallback = 0;
      for (i = 0; i < aircraft.length; i++) {
        if (aircraft[i].modelState === 'model') loaded++;
        if (aircraft[i].modelState === 'fallback') fallback++;
      }
      diag('v4.6 · ' + (WORLD.ready ? '3D' : '2D fallback') + ' · ' + loaded + '/3 models' + (fallback ? ' · ' + fallback + ' fallback' : '') + ' · ' + state.fleet.length / 2 + ' vans', fallback > 0);
    }
  }

  /* ----------------------------- weapons -------------------------- */

  // Fly the aircraft to a battery and clear the rounds already chasing it, so a
  // teleport is a clean insertion instead of an instant death.
  function teleportTo(site) {
    var g = window.geofs;
    var inst = g && g.aircraft && g.aircraft.instance;
    if (!inst || !site) { flash('NO AIRCRAFT YET'); SFX.deny(); return; }
    var alt = (site.alt || 0) + 1600;
    try {
      if (typeof inst.setPosition === 'function') inst.setPosition(site.lat, site.lon);
      else if (typeof inst.teleport === 'function') inst.teleport(site.lat, site.lon, alt);
      else if (typeof inst.moveTo === 'function') inst.moveTo(site.lat, site.lon, alt);
    } catch (e) { /* the state write below is what the simulation reads */ }
    try {
      if (inst.llaLocation) {
        inst.llaLocation[0] = site.lat;
        inst.llaLocation[1] = site.lon;
        inst.llaLocation[2] = alt;
      }
      var v = g.animation && g.animation.values;
      if (v) {
        v.altitude = alt * 3.28084;
        v.verticalSpeed = 0;
        if (typeof v.airspeed === 'number' && v.airspeed < 90) v.airspeed = 120;
      }
      if (typeof inst.update === 'function') inst.update(0);
    } catch (e) { /* GeoFS keeps flying on its own clock */ }
    for (var i = state.missiles.length - 1; i >= 0; i--) {
      if (!state.missiles[i].targetJet) killMissile(i, false);
    }
    state.prevPos = null;
    state.prevT = 0;
    state.pvel = { x: 0, y: 0, z: 0 };
    // Navy 2 comes along: it reappears on the wing instead of crossing the map
    var wing = state.wingman;
    if (wing && wing.alive) {
      var fwd = aimDir({ x: 0, y: 0, z: 0 });
      var east = { x: -Math.sin(site.lon * D2R), y: Math.cos(site.lon * D2R), z: 0 };
      var at = add(add(ecef(site.lat, site.lon, alt), mul(east, 85)), mul(fwd, -65));
      wing.pos = at;
      wing.vel = mul(fwd, 160);
      wing.speed = 160;
      wing.lla = toLla(at);
    }
    flash('TELEPORT — ' + site.short);
  }

  function dispenseAt(p, pv, kind, count) {
    if (!p) return;
    var isIR = kind === 'IR';
    var list = isIR ? state.flares : state.chaff;
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
  }

  function dispense(kind, count) {
    var p = state.ppos;
    if (!p) return;
    SFX.unlock();
    dispenseAt(p, state.pvel || { x: 0, y: 0, z: 0 }, kind, count);
    if (kind === 'IR') SFX.flare(); else SFX.chaff();
    flash(kind === 'IR' ? 'FLARES AWAY' : 'CHAFF AWAY');
  }

  function launch(site, target, pvel, now, targetJet) {
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
      targetJet: targetJet || null,
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
      }), 10, CONFIG.smokeLife + 2, 0.45);
    }

    SFX.launch();
    // a launch a second would strobe the banner, so a wave is announced once
    if (now - state.launchFlashAt > CONFIG.launchFlashGap) {
      state.launchFlashAt = now;
      flash('LAUNCH — ' + site.short + ' · ' + m.seeker);
    }
  }

  function steer(m, target, dt, pvel) {
    // Full lead all the way in: aim where the aircraft will be when the
    // missile gets there, not where it is now. Only inside 350 m does it chase
    // the real position, where a lead would just make it wobble.
    var aim = target;
    if (pvel) {
      var range = len(sub(target, m.pos));
      var tti = range / Math.max(1, m.speed);
      var lead = Math.max(0, Math.min(1, (range - 350) / 500));
      aim = add(target, mul(pvel, tti * lead));
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
      if (m.targetJet) AIR.kill(m.targetJet);
      else playerHit();
      for (var q = 0; q < 8; q++) {
        addSmoke(add(m.pos, {
          x: (Math.random() - 0.5) * 36,
          y: (Math.random() - 0.5) * 36,
          z: (Math.random() - 0.5) * 24
        }), 12, CONFIG.smokeLife + 2, 0.5);
      }
    }
  }

  // A hit that does not kill it: the dug-in sites soak up several. Rockets do
  // two points, gun rounds one.
  function damageSite(s, amount) {
    if (!s || s.alive === false) return;
    s.hp -= amount;
    if (s.hp > 0) {
      flash('HIT — ' + s.short + ' · ' + s.hp + '/' + s.armor);
      SFX.explosion(0.4);
      return;
    }
    destroySite(s);
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
    if (state.rocketsLeft < 4) { flash('NO ROCKETS — SHIFT+U TO REARM'); SFX.deny(); return; }
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
    state.rocketsLeft -= 4;
    SFX.sead();
    flash('ROCKETS AWAY — ' + state.rocketsLeft + ' LEFT');
  }

  // One trigger for both weapons: U picks, L fires, so the same key always
  // shoots whatever is selected. Shift+U reloads everything.
  function selectWeapon(kind) {
    state.weapon = kind === 'AIM9' ? 'AIM9' : 'ROCKETS';
    SFX.unlock();
    flash('WEAPON — ' + (state.weapon === 'AIM9' ? 'AIM-9' : 'ROCKETS'));
  }

  function fireWeapon() {
    SFX.unlock();
    if (state.weapon === 'AIM9') { AD.fire(); return; }
    fireRockets();
  }

  function reloadWeapon() {
    state.rocketsLeft = CONFIG.playerRockets;
    state.aim9Left = CONFIG.playerAim9;
    SFX.unlock();
    flash('REARMED — ' + state.rocketsLeft + ' ROCKETS · ' + state.aim9Left + ' AIM-9');
  }

  // Back to a fresh fight: batteries repaired, sky cleared of everything the
  // network and the aircraft put in it, bandits and Navy 2 respawned.
  function resetAll() {
    var i;
    for (i = state.missiles.length - 1; i >= 0; i--) {
      dropBody(state.missiles[i]);
      state.missiles.splice(i, 1);
    }
    for (i = 0; i < state.sead.length; i++) dropBody(state.sead[i]);
    for (i = 0; i < state.sites.length; i++) {
      var s = state.sites[i];
      s.alive = true;
      s.hp = s.armor;
      s.status = 'IDLE';
      s.track = 0;
      s.readyAt = 0;
      for (var k = 0; k < (s.entities || []).length; k++) {
        try { s.entities[k].show = true; } catch (e) { /* entity already removed */ }
      }
    }
    state.bullets = [];
    state.sead = [];
    state.flares = [];
    state.chaff = [];
    state.smoke = [];
    state.bursts = [];
    state.columns = [];
    state.kills = 0;
    state.hitUntil = 0;
    state.shake.until = 0;
    state.shake.amp = 0;
    state.comms = [];
    state.armed = true;
    state.gunHeld = false;
    state.gunAt = 0;
    state.rocketsLeft = CONFIG.playerRockets;
    state.weapon = 'ROCKETS';
    state.prevPos = null;
    state.prevT = 0;
    if (AD.reset) AD.reset();
    if (AIR.reset) AIR.reset();
    state.bandits = [];
    state.wrecks = [];
    state.wingman = null;
    state.banditsSpawned = false;
    SFX.gunStop();
    SFX.warn(0);
    flash('ALL SYSTEMS RESET');
    callout('NETWORK: RESET — ALL BATTERIES ONLINE', 'info');
  }

  // RWR launch tone: one beep that tightens as the nearest round closes, and
  // silence once nothing is hunting the aircraft.
  function updateLaunchWarning() {
    var p = state.ppos;
    var closest = Infinity;
    var i;
    if (p) {
      for (i = 0; i < state.missiles.length; i++) {
        var m = state.missiles[i];
        if (m.decoy || m.targetJet) continue;
        var d = dist(m.pos, p);
        if (d < closest) closest = d;
      }
      for (i = 0; i < state.aim9.length; i++) {
        var a = state.aim9[i];
        if (!a.vsPlayer || a.decoy) continue;
        var ad = dist(a.pos, p);
        if (ad < closest) closest = ad;
      }
    }
    if (closest > 12000) { SFX.warn(0); return; }
    var k = Math.max(0, Math.min(1, closest / 12000));
    SFX.warn(70 + 880 * k * k);
  }

  /* --------------------------- simulation ------------------------- */

  function update(dt, now) {
    var p = readPlayer();
    if (!p) return;

    var ppos = ecef(p.lat, p.lon, p.alt);
    var pvel = { x: 0, y: 0, z: 0 };
    var positionTime = performance.now() / 1000;
    if (state.prevPos && state.prevT) {
      var span = Math.max(0.001, positionTime - state.prevT);
      pvel = mul(sub(ppos, state.prevPos), 1 / span);
      if (len(pvel) > 1200) pvel = { x: 0, y: 0, z: 0 };
    }
    state.prevPos = ppos;
    state.prevT = positionTime;
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
      var wing = state.wingman && state.wingman.alive ? state.wingman : null;
      var targetJet = wing && (grace || dist(s.ecef, wing.pos) < dist(s.ecef, ppos)) ? wing : null;
      var target = targetJet ? targetJet.pos : ppos;
      var targetVel = targetJet ? targetJet.vel : pvel;
      var targetAlt = targetJet ? targetJet.lla.alt : p.alt;
      var d = dist(s.ecef, target);
      if (s.alive === false) { s.status = 'DESTROYED'; continue; }
      if (s.active === false) { s.status = 'OFFLINE'; s.track = 0; continue; }
      if (!state.armed || (grace && !targetJet)) { s.status = 'IDLE'; s.track = 0; continue; }
      if (d > s.range) { s.track = Math.max(0, s.track - dt * 2); s.status = 'IDLE'; continue; }
      if (targetAlt < MIN_ALT || targetAlt > MAX_ALT) {
        s.track = Math.max(0, s.track - dt * 2);
        s.status = targetAlt < MIN_ALT ? 'TOO LOW' : 'TOO HIGH';
        continue;
      }
      if (now < s.readyAt) { s.status = 'RELOAD'; continue; }
      s.status = s.track > 0.05 ? 'TRACK' : 'SEARCH';
      s.track += dt;
      if (s.track >= CONFIG.lockTime && state.missiles.length < CONFIG.maxSimultaneous) {
        launch(s, target, targetVel, now, targetJet);
        s.readyAt = now + CONFIG.reload;
        s.track = 0;
        s.status = 'LAUNCH';
      }
    }

    for (i = state.missiles.length - 1; i >= 0; i--) {
      var m = state.missiles[i];
      m.life += dt;
      if (m.targetJet && !m.targetJet.alive && !m.decoy) { killMissile(i, false); continue; }
      m.speed = Math.min(m.speedMax, m.speed + 340 * dt);
      if (!m.decoy) tryDecoy(m, now);
      var mFrom = m.pos;
      if (m.decoy) {
        if (m.decoy.life <= 0) { killMissile(i, false); continue; }
        steer(m, m.decoy.pos, dt);
      } else {
        steer(m, m.targetJet ? m.targetJet.pos : ppos, dt, m.targetJet ? m.targetJet.vel : pvel);
      }
      m.lla = toLla(m.pos);

      // space puffs by distance flown, not by frame: same density at any
      // speed, and no more puffs than the trail actually needs
      m.smokeGap -= len(m.vel) * dt;
      if (m.smokeGap <= 0) {
        m.smokeGap = CONFIG.smokeGap;
        addSmoke(m.pos, 9, CONFIG.smokeLife, 0.5);
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
      // Navy 2 is as easy to hit as the player: the same lethal radius, the
      // same seeker, so a battery that locks him up can bring him down.
      if (segDist(mFrom, m.pos, m.targetJet ? m.targetJet.pos : ppos) <= CONFIG.hitRadius) { killMissile(i, true); continue; }
      if (m.life > m.ttl || m.lla.alt < 0) killMissile(i, false);
    }

    for (i = state.sead.length - 1; i >= 0; i--) {
      var rk = state.sead[i];
      var rkFrom = rk.pos;
      rk.life += dt;
      rk.vel = add(rk.vel, mul(unit(rk.pos), -7 * dt));
      rk.pos = add(rk.pos, mul(rk.vel, dt));
      rk.lla = toLla(rk.pos);

      rk.smokeGap -= len(rk.vel) * dt;
      if (rk.smokeGap <= 0) {
        rk.smokeGap = CONFIG.rocketSmokeGap;
        addSmoke(rk.pos, 9, CONFIG.smokeLife, 0.55);
      }

      var sl = rk.trail[rk.trail.length - 1];
      if (!sl || dist(sl, rk.pos) > 60) {
        rk.trail.push({ lat: rk.lla.lat, lon: rk.lla.lon, alt: rk.lla.alt });
        if (rk.trail.length > 50) rk.trail.shift();
      }

      // a bandit salvo is aimed at the aircraft, yours at anything Iraqi
      if (rk.owner === 'bandit') {
        if (state.wingman && state.wingman.alive && segDist(rkFrom, rk.pos, state.wingman.pos) < 25) {
          AIR.kill(state.wingman); dropBody(rk); state.sead.splice(i, 1); continue;
        }
        if (!grace && state.ppos && segDist(rkFrom, rk.pos, state.ppos) < CONFIG.hitRadius) {
          burst(rk.pos, 1.5);
          dropBody(rk);
          state.sead.splice(i, 1);
          playerHit();
          continue;
        }
      } else {
        var jetHit = null;
        for (var jb = 0; jb < state.bandits.length; jb++) {
          var bj = state.bandits[jb];
          if (!bj.alive) continue;
          if (segDist(rkFrom, rk.pos, bj.pos) < 60) { jetHit = bj; break; }
        }
        if (jetHit) {
          burst(rk.pos, 1.4);
          AIR.kill(jetHit);
          dropBody(rk);
          state.sead.splice(i, 1);
          continue;
        }
      }

      var struck = null;
      for (var qi = 0; qi < state.sites.length; qi++) {
        var site = state.sites[qi];
        if (site.alive === false) continue;
        if (rk.owner !== 'bandit' && segDist(rkFrom, rk.pos, site.ecef) < 90) { struck = site; break; }
      }
      if (struck) {
        burst(rk.pos, 1.2);
        damageSite(struck, CONFIG.rocketDamage);
        dropBody(rk);
        state.sead.splice(i, 1);
        continue;
      }
      if (rk.life > rk.ttl || rk.lla.alt < AIR.ground(rk.lla.lat, rk.lla.lon)) {
        if (rk.lla.alt < AIR.ground(rk.lla.lat, rk.lla.lon)) burst(rk.pos, 0.7);
        dropBody(rk);
        state.sead.splice(i, 1);
      }
    }

    for (i = state.bullets.length - 1; i >= 0; i--) {
      var bl = state.bullets[i];
      bl.plla = bl.lla;
      var bFrom = bl.pos;
      bl.vel = add(bl.vel, mul(unit(bl.pos), -9.8 * dt));
      bl.pos = add(bl.pos, mul(bl.vel, dt));
      bl.lla = toLla(bl.pos);
      bl.life -= dt;

      if (bl.owner === 'bandit') {
        if (state.wingman && state.wingman.alive && segDist(bFrom, bl.pos, state.wingman.pos) < 16) {
          AIR.hit(state.wingman, 1, segDist(bFrom, bl.pos, state.wingman.pos) < 4);
          state.bullets.splice(i, 1);
          continue;
        }
        if (!grace && segDist(bFrom, bl.pos, ppos) < 16) {
          hitPlayer(segDist(bFrom, bl.pos, ppos) < 4);
          state.bullets.splice(i, 1);
          continue;
        }
        if (bl.life <= 0 || bl.lla.alt < AIR.ground(bl.lla.lat, bl.lla.lon)) state.bullets.splice(i, 1);
        continue;
      }
      // Friendly rounds can knock a battery out.
      var bStruck = null;
      for (var bi = 0; bi < state.sites.length; bi++) {
        var bs = state.sites[bi];
        if (bs.alive === false) continue;
        if (segDist(bFrom, bl.pos, bs.ecef) < 70) { bStruck = bs; break; }
      }
      if (bStruck) {
        damageSite(bStruck, 1);
        state.bullets.splice(i, 1);
        continue;
      }

      var bJet = null;
      for (var bj2 = 0; bj2 < state.bandits.length; bj2++) {
        var bj3 = state.bandits[bj2];
        if (!bj3.alive) continue;
        if (segDist(bFrom, bl.pos, bj3.pos) < 45) { bJet = bj3; break; }
      }
      if (bJet) {
        AIR.hit(bJet, 1, segDist(bFrom, bl.pos, bJet.pos) < 4);
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
        f.vel = add(f.vel, mul(unit(f.pos), -5 * dt));
        f.pos = add(f.pos, mul(f.vel, dt));
        f.lla = toLla(f.pos);
        f.smokeAt = (f.smokeAt || 0) - dt;
        if (f.smokeAt <= 0) {
          f.smokeAt = 0.12;
          addSmoke(f.pos, 0.8, 1.2, f.kind === 'IR' ? 0.06 : 0.025);
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
      addSmoke(add(col.ecef, mul(unit(col.ecef), ch)), 6 + ch * 0.26, 9, 0.5, 'dark');
    }

    for (i = state.bursts.length - 1; i >= 0; i--) {
      state.bursts[i].life -= dt;
      if (state.bursts[i].life <= 0) state.bursts.splice(i, 1);
    }

    AD.update(dt, now);
    AIR.update(dt, now);
    updateLaunchWarning();
  }

  /* ------------------------------- boot --------------------------- */

  var lastT = 0;

  // Read GeoFS's pause flag, not lack of motion: parked aircraft are not paused.
  // Combat timers advance only on simulation time.
  function isPaused() {
    var g = window.geofs;
    if (g) {
      if (g.pause === true || g.pause === 1 || g.paused === true) return true;
      if (g.animation && g.animation.paused === true) return true;
      var v = g.animation && g.animation.values;
      if (v && v.paused === true) return true;
    }
    var btn = document.getElementById('geofs-pauseButton');
    if (btn && btn.className && /paused/.test(btn.className)) return true;
    return false;
  }

  function tick(ts) {
    var now = ts / 1000;
    var dt = lastT ? Math.min(0.05, now - lastT) : 0.016;
    lastT = now;
    try {
      state.paused = isPaused();
      if (state.paused) {
        state.prevPos = null;
        state.prevT = 0;
      } else {
        state.simTime += dt;
        update(dt, state.simTime);
      }

      if (!state.projector) state.projector = findProjector();
      if (!state.fleetBuilt) { sampleHeights(); if (!state.fleetBuilt) buildFleet(); }
      if (!WORLD.ready) initWorldLayer();
      if (state.paused || !state.gunHeld) SFX.gunStop();
      syncBodies();
      syncSmoke();

      state.lastError = '';
    } catch (e) {
      if (String(e) !== state.lastError) {
        state.lastError = String(e);
        console.warn('[SAM]', e);
      }
    }
    // A failed optional 3D feature must not hide the HUD and all other visuals.
    render(now);
    applyShake(now);
    updateHud(now);
    if (state.lastError) diag('Visual error: ' + state.lastError.slice(0, 110), true);
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
        armor: s.armor || 1, hp: s.armor || 1,
        status: 'IDLE', alive: true, active: true, custom: false, entities: []
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
      if (event.target && /input|textarea|select/i.test(event.target.tagName || '')) return;
      SFX.unlock();
      if (key === ',') { event.preventDefault(); dispense('IR', 2); }
      else if (key === '.') { event.preventDefault(); dispense('RADAR', 2); }
      else if (key === 'l') { event.preventDefault(); fireWeapon(); }
      else if (key === 'u') {
        event.preventDefault();
        if (event.shiftKey) reloadWeapon();
        else selectWeapon(state.weapon === 'AIM9' ? 'ROCKETS' : 'AIM9');
      }
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
      reset: function () { resetAll(); },
      diagnostics: function () {
        return {
          geofsObject: !!window.geofs,
          cesium: !!C3(),
          projector: state.projector ? state.projector.kind : null,
          aircraft: readPlayer(),
          fleetBuilt: state.fleetBuilt,
          fleetEntities: state.fleet.length,
          worldLayer: WORLD.ready ? 'cesium billboards' : 'canvas fallback',
          paused: state.paused,
          version: '4.7.0',
          weather: state.weather,
          wingmanMode: state.wingmanMode,
          coordinates: 'WGS84',
          banditPhases: state.bandits.map(function (b) { return { label: b.label, phase: b.phase, visual: b.modelState, error: b.modelError }; }),
          wingman: state.wingman ? { phase: state.wingman.phase, visual: state.wingman.modelState, error: state.wingman.modelError, gun: state.wingman.gun, rockets: state.wingman.rockets } : null,
          burningAircraft: state.wrecks.length,
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
