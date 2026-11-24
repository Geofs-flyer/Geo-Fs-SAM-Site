// ==UserScript==
// @name         GeoFS SAM Network — BAGHDAD
// @namespace    geofs.sam.network
// @version      1.0.0
// @description  13 SAM sites with tracking missiles and countermeasures for GeoFS
// @author       SAM Network workbench
// @match        https://www.geo-fs.com/*
// @match        https://geo-fs.com/*
// @match        https://www.geofs.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     GeoFS SAM network
     Sites engage the aircraft when it enters their engagement ring.
     Missiles fly a turn-limited pursuit and can be decoyed by flares
     (IR seekers) or chaff (radar seekers).
     --------------------------------------------------------------- */

  const CONFIG = {
  "lockTime": 2,
  "maxSimultaneous": 8,
  "hitRadius": 40,
  "minAltFt": 1000,
  "maxAltFt": 18000,
  "flareCount": 30,
  "flareEffect": 0.7,
  "chaffEffect": 0.35,
  "decoyRange": 3500,
  "graceAfterHit": true,
  "flareLife": 6
};
  const SITES = [
  {
    "id": "baghdad-0",
    "name": "BIAP — Baghdad Intl",
    "system": "SA-2 Guideline",
    "lat": 33.2625,
    "lon": 44.2346,
    "alt": 0,
    "range": 45000,
    "speed": 1150,
    "maxG": 10,
    "seeker": "RADAR",
    "rounds": 3,
    "reload": 50
  },
  {
    "id": "baghdad-1",
    "name": "Camp Victory",
    "system": "SA-3 Goa",
    "lat": 33.2833,
    "lon": 44.1833,
    "alt": 0,
    "range": 25000,
    "speed": 900,
    "maxG": 16,
    "seeker": "RADAR",
    "rounds": 4,
    "reload": 40
  },
  {
    "id": "baghdad-2",
    "name": "Rasheed AB",
    "system": "SA-6 Gainful",
    "lat": 33.2417,
    "lon": 44.5042,
    "alt": 0,
    "range": 24000,
    "speed": 800,
    "maxG": 18,
    "seeker": "RADAR",
    "rounds": 4,
    "reload": 32
  },
  {
    "id": "baghdad-3",
    "name": "Taji Depot",
    "system": "SA-6 Gainful",
    "lat": 33.507,
    "lon": 44.256,
    "alt": 0,
    "range": 24000,
    "speed": 800,
    "maxG": 18,
    "seeker": "RADAR",
    "rounds": 4,
    "reload": 32
  },
  {
    "id": "baghdad-4",
    "name": "Tarmiyah North",
    "system": "SA-2 Guideline",
    "lat": 33.65,
    "lon": 44.38,
    "alt": 0,
    "range": 45000,
    "speed": 1150,
    "maxG": 10,
    "seeker": "RADAR",
    "rounds": 3,
    "reload": 50
  },
  {
    "id": "baghdad-5",
    "name": "Muthanna Centre",
    "system": "SA-8 Gecko",
    "lat": 33.33,
    "lon": 44.4,
    "alt": 0,
    "range": 12000,
    "speed": 650,
    "maxG": 22,
    "seeker": "RADAR",
    "rounds": 6,
    "reload": 24
  },
  {
    "id": "baghdad-6",
    "name": "Karrada",
    "system": "SA-13 Gopher",
    "lat": 33.3,
    "lon": 44.42,
    "alt": 0,
    "range": 5000,
    "speed": 550,
    "maxG": 20,
    "seeker": "IR",
    "rounds": 8,
    "reload": 18
  },
  {
    "id": "baghdad-7",
    "name": "Sadr City",
    "system": "SA-8 Gecko",
    "lat": 33.39,
    "lon": 44.45,
    "alt": 0,
    "range": 12000,
    "speed": 650,
    "maxG": 22,
    "seeker": "RADAR",
    "rounds": 6,
    "reload": 24
  },
  {
    "id": "baghdad-8",
    "name": "Abu Ghraib West",
    "system": "SA-3 Goa",
    "lat": 33.32,
    "lon": 44.15,
    "alt": 0,
    "range": 25000,
    "speed": 900,
    "maxG": 16,
    "seeker": "RADAR",
    "rounds": 4,
    "reload": 40
  },
  {
    "id": "baghdad-9",
    "name": "Mahmudiyah South",
    "system": "SA-13 Gopher",
    "lat": 33.06,
    "lon": 44.36,
    "alt": 0,
    "range": 5000,
    "speed": 550,
    "maxG": 20,
    "seeker": "IR",
    "rounds": 8,
    "reload": 18
  },
  {
    "id": "baghdad-10",
    "name": "Balad",
    "system": "SA-2 Guideline",
    "lat": 33.94,
    "lon": 44.362,
    "alt": 0,
    "range": 45000,
    "speed": 1150,
    "maxG": 10,
    "seeker": "RADAR",
    "rounds": 3,
    "reload": 50
  },
  {
    "id": "baghdad-11",
    "name": "Karbala Road",
    "system": "SA-18 Igla",
    "lat": 32.9,
    "lon": 44.2,
    "alt": 0,
    "range": 5000,
    "speed": 600,
    "maxG": 18,
    "seeker": "IR",
    "rounds": 4,
    "reload": 14
  },
  {
    "id": "baghdad-12",
    "name": "Baqubah NE",
    "system": "SA-6 Gainful",
    "lat": 33.75,
    "lon": 44.64,
    "alt": 0,
    "range": 24000,
    "speed": 800,
    "maxG": 18,
    "seeker": "RADAR",
    "rounds": 4,
    "reload": 32
  }
];

  /* engagement envelope — sites only track inside this altitude band */
  const MIN_ALT = CONFIG.minAltFt * 0.3048;
  const MAX_ALT = CONFIG.maxAltFt * 0.3048;

  const R = 6371000;
  const D2R = Math.PI / 180;
  const RAD2D = 180 / Math.PI;

  const state = {
    sites: [],
    missiles: [],
    flares: [],
    chaff: [],
    cm: { flares: CONFIG.flareCount, chaff: CONFIG.flareCount },
    kills: 0,
    armed: true,
    hitUntil: 0,
    hud: null,
    hudAt: 0,
    prevPos: null,
    prevT: 0,
    ppos: null,
    palt: 0,
    pvel: null,
    layerDone: false,
    flashText: '',
    flashUntil: 0
  };

  /* ---------- geodesy ---------- */

  function ecef(lat, lon, alt) {
    const phi = lat * D2R;
    const lam = lon * D2R;
    const r = (R + alt) * Math.cos(phi);
    return { x: r * Math.cos(lam), y: r * Math.sin(lam), z: (R + alt) * Math.sin(phi) };
  }

  function toLla(v) {
    const r = Math.sqrt(v.x * v.x + v.y * v.y);
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
  function unit(a) { const l = len(a) || 1; return mul(a, 1 / l); }
  function dist(a, b) { return len(sub(a, b)); }

  /* ---------- aircraft ---------- */

  function readPlayer() {
    const g = window.geofs;
    if (!g || !g.aircraft || !g.aircraft.instance) return null;
    const a = g.aircraft.instance;
    let p = a.llaLocation;
    if (!p || typeof p[0] !== 'number') p = a.location;
    if (!p || typeof p[0] !== 'number') return null;
    let alt = p[2];
    if (typeof alt !== 'number' || !isFinite(alt)) {
      const v = g.animation && g.animation.values;
      alt = v && typeof v.altitude === 'number' ? v.altitude * 0.3048 : 0;
    }
    return { lat: p[0], lon: p[1], alt: Math.max(0, alt) };
  }

  /* ---------- Cesium layer ---------- */

  function cesium() {
    const g = window.geofs;
    if (g && g.api && g.api.Cesium && g.api.viewer && g.api.viewer.entities) {
      return { C: g.api.Cesium, viewer: g.api.viewer };
    }
    return null;
  }

  function removeEntity(entity) {
    const c = cesium();
    if (!c || !entity) return;
    try { c.viewer.entities.remove(entity); } catch (err) { /* gone */ }
  }

  function drawSites() {
    const c = cesium();
    if (!c) return false;
    const colour = c.C.Color.fromCssColorString('#e0b24a');
    for (let i = 0; i < state.sites.length; i++) {
      const s = state.sites[i];
      if (s.drawn) continue;
      s.drawn = true;
      try {
        c.viewer.entities.add({
          position: c.C.Cartesian3.fromDegrees(s.lon, s.lat, 0),
          ellipse: {
            semiMajorAxis: s.range,
            semiMinorAxis: s.range,
            height: 0,
            material: colour.withAlpha(0.05),
            outline: true,
            outlineColor: colour.withAlpha(0.45)
          }
        });
        c.viewer.entities.add({
          position: c.C.Cartesian3.fromDegrees(s.lon, s.lat, (s.alt || 0) + 30),
          point: {
            pixelSize: 9,
            color: colour,
            outlineColor: c.C.Color.fromCssColorString('#0c0a06'),
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
      } catch (err) {
        console.warn('[SAM] site marker failed', err);
      }
    }
    return true;
  }

  function attachMissile(m) {
    const c = cesium();
    if (!c) return;
    try {
      m.lla = toLla(m.pos);
      m.point = c.viewer.entities.add({
        position: c.C.Cartesian3.fromDegrees(m.lla.lon, m.lla.lat, m.lla.alt),
        point: {
          pixelSize: 6,
          color: c.C.Color.fromCssColorString('#ff6a3d'),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      const trail = m.trail;
      m.line = c.viewer.entities.add({
        polyline: {
          positions: new c.C.CallbackProperty(function () { return trail; }, false),
          width: 2,
          material: c.C.Color.fromCssColorString('#ff8a5c').withAlpha(0.8)
        }
      });
    } catch (err) {
      m.point = null;
    }
  }

  function moveMissile(m) {
    const c = cesium();
    if (!c || !m.point) return;
    try {
      m.lla = toLla(m.pos);
      m.point.position = new c.C.ConstantPositionProperty(
        c.C.Cartesian3.fromDegrees(m.lla.lon, m.lla.lat, m.lla.alt)
      );
      if (m.trail.length === 0 || dist(m.pos, m.lastTrail || m.pos) > 70) {
        m.trail.push(c.C.Cartesian3.fromDegrees(m.lla.lon, m.lla.lat, m.lla.alt));
        m.lastTrail = m.pos;
        if (m.trail.length > 70) m.trail.shift();
      }
    } catch (err) { /* frame skipped */ }
  }

  function attachFlare(f) {
    const c = cesium();
    if (!c) return;
    try {
      const l = toLla(f.pos);
      f.point = c.viewer.entities.add({
        position: c.C.Cartesian3.fromDegrees(l.lon, l.lat, Math.max(l.alt, 1)),
        point: {
          pixelSize: 5,
          color: c.C.Color.fromCssColorString(f.kind === 'IR' ? '#ffd166' : '#9fd7ff'),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    } catch (err) {
      f.point = null;
    }
  }

  /* ---------- HUD ---------- */

  const HUD_CSS =
    '#sam-net{position:fixed;top:84px;right:14px;z-index:99998;width:216px;padding:9px 10px 8px;border:1px solid rgba(224,178,74,.45);border-radius:5px;background:rgba(8,10,14,.86);color:#e9e4d9;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;box-shadow:0 12px 34px rgba(0,0,0,.55)}' +
    '#sam-net .hd{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.16em;color:#e0b24a;margin-bottom:6px}' +
    '#sam-net .hd i{width:6px;height:6px;border-radius:50%;background:#3fbf7f;display:inline-block}' +
    '#sam-net .gr{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:10px;color:#9aa2ad}' +
    '#sam-net .gr b{color:#e9e4d9;font-weight:500;text-align:right}' +
    '#sam-net .cm{display:flex;gap:6px;margin-top:8px}' +
    '#sam-net button{flex:1;padding:5px 4px;border:1px solid rgba(224,178,74,.35);border-radius:3px;background:rgba(224,178,74,.1);color:#e0b24a;font:10px ui-monospace,monospace;letter-spacing:.1em;cursor:pointer}' +
    '#sam-net button:hover{background:rgba(224,178,74,.22)}' +
    '#sam-net .hint{margin-top:6px;font-size:9px;color:#6d747e;letter-spacing:.08em}' +
    '#sam-warn{position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:99999;padding:8px 18px;border:1px solid rgba(255,80,60,.6);border-radius:4px;background:rgba(40,8,6,.88);color:#ff8a72;font:12px ui-monospace,monospace;letter-spacing:.16em;display:none}' +
    '#sam-warn.on{display:block}' +
    '#sam-kill{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:rgba(20,3,2,.6);color:#ff6b4a;font:600 26px ui-monospace,monospace;letter-spacing:.3em;text-align:center}' +
    '#sam-kill.on{display:flex}' +
    '#sam-kill span{font-size:11px;letter-spacing:.2em;color:#e0b24a}';

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== value) el.textContent = value;
  }

  function buildHud() {
    if (document.getElementById('sam-net')) return;

    const style = document.createElement('style');
    style.textContent = HUD_CSS;
    document.head.appendChild(style);

    const box = document.createElement('div');
    box.id = 'sam-net';
    box.innerHTML =
      '<div class="hd"><i></i>SAM NETWORK</div>' +
      '<div class="gr">' +
      '<span>THREAT</span><b id="sam-threat">—</b>' +
      '<span>STATUS</span><b id="sam-status">—</b>' +
      '<span>RANGE</span><b id="sam-range">—</b>' +
      '<span>ALTITUDE</span><b id="sam-alt">—</b>' +
      '<span>INBOUND</span><b id="sam-inbound">0</b>' +
      '<span>SEEKER</span><b id="sam-seeker">—</b>' +
      '<span>DECOYED</span><b id="sam-decoyed">0</b>' +
      '<span>CLOSEST</span><b id="sam-closest">—</b>' +
      '<span>ROUNDS LEFT</span><b id="sam-rounds">0</b>' +
      '<span>HITS TAKEN</span><b id="sam-kills">0</b>' +
      '</div>' +
      '<div class="cm"><button id="sam-flare">FLARES <span id="sam-flares">0</span></button>' +
      '<button id="sam-chaff">CHAFF <span id="sam-chaffn">0</span></button></div>' +
      '<div class="hint">FLARES: , · CHAFF: . · ARM: J</div>';
    document.body.appendChild(box);

    const warn = document.createElement('div');
    warn.id = 'sam-warn';
    document.body.appendChild(warn);

    const kill = document.createElement('div');
    kill.id = 'sam-kill';
    kill.innerHTML = '<div>AIRCRAFT DESTROYED</div><span>SAM NETWORK SCORE <b id="sam-score">0</b></span>';
    document.body.appendChild(kill);

    const flareBtn = document.getElementById('sam-flare');
    const chaffBtn = document.getElementById('sam-chaff');
    if (flareBtn) flareBtn.addEventListener('click', function () { dispense('IR', 2); });
    if (chaffBtn) chaffBtn.addEventListener('click', function () { dispense('RADAR', 2); });

    state.hud = box;
  }

  function flash(text) {
    state.flashText = text;
    state.flashUntil = performance.now() + 1800;
  }

  function updateHud(now) {
    if (!state.hud || now - state.hudAt < 0.12) return;
    state.hudAt = now;

    const p = state.ppos;
    let nearest = null;
    let nearestD = Infinity;
    let rounds = 0;

    for (let i = 0; i < state.sites.length; i++) {
      const s = state.sites[i];
      rounds += s.rounds;
      if (!p) continue;
      const d = dist(s.ecef, p);
      if (d < nearestD) { nearestD = d; nearest = s; }
    }

    let closest = Infinity;
    let closestMissile = null;
    let decoyed = 0;
    for (let i = 0; i < state.missiles.length; i++) {
      const m = state.missiles[i];
      if (m.decoy) decoyed += 1;
      if (!p) continue;
      const d = dist(m.pos, p);
      if (d < closest) { closest = d; closestMissile = m; }
    }

    setText('sam-threat', nearest ? String(nearest.name).slice(0, 18) : '—');
    setText('sam-status', state.armed ? (nearest ? nearest.status : 'IDLE') : 'DISARMED');
    setText('sam-range', nearest ? (nearestD / 1000).toFixed(1) + ' KM' : '—');
    setText('sam-alt', Math.round((state.palt || 0) * 3.281) + ' FT');
    setText('sam-inbound', String(state.missiles.length - decoyed));
    setText('sam-seeker', closestMissile ? closestMissile.seeker : '—');
    setText('sam-decoyed', String(decoyed));
    setText('sam-closest', closest < Infinity ? (closest / 1000).toFixed(1) + ' KM' : '—');
    setText('sam-rounds', String(rounds));
    setText('sam-kills', String(state.kills));
    setText('sam-flares', String(state.cm.flares));
    setText('sam-chaffn', String(state.cm.chaff));
    setText('sam-score', String(state.kills));

    const warn = document.getElementById('sam-warn');
    if (warn) {
      const danger = closest < 4000;
      const showing = now * 1000 < state.flashUntil;
      if (danger || showing) {
        const ir = closestMissile && closestMissile.seeker === 'IR';
        warn.textContent = danger
          ? 'MISSILE INBOUND ' + (closest / 1000).toFixed(1) + ' KM — ' + (ir ? 'X FLARES' : 'Z CHAFF')
          : state.flashText;
        warn.className = 'on';
      } else {
        warn.className = '';
      }
    }

    const kill = document.getElementById('sam-kill');
    if (kill) kill.className = now * 1000 < state.hitUntil ? 'on' : '';
  }

  /* ---------- weapons ---------- */

  function dispense(kind, count) {
    const p = state.ppos;
    if (!p) return;
    const isIR = kind === 'IR';
    const left = isIR ? state.cm.flares : state.cm.chaff;
    const n = Math.min(count, left);
    if (n <= 0) { flash('NO COUNTERMEASURES LEFT'); return; }

    const list = isIR ? state.flares : state.chaff;
    const drift = mul(state.pvel || { x: 0, y: 0, z: 0 }, 0.82);
    for (let i = 0; i < n; i++) {
      const pos = add(p, {
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 40,
        z: -4 - Math.random() * 4
      });
      const f = {
        pos: pos,
        vel: { x: drift.x, y: drift.y, z: drift.z - 9 },
        life: CONFIG.flareLife,
        kind: kind,
        point: null
      };
      list.push(f);
      if (isIR) state.cm.flares -= 1; else state.cm.chaff -= 1;
      attachFlare(f);
    }
    flash(isIR ? 'FLARES AWAY' : 'CHAFF AWAY');
  }

  function launch(site, target, pvel) {
    const from = site.ecef;
    const tof = dist(from, target) / site.speed;
    const aim = add(target, mul(pvel, tof * 0.5));
    const dir = unit(sub(aim, from));

    const m = {
      id: site.id + '-' + state.missiles.length + '-' + Math.floor(Math.random() * 9999),
      site: site.id,
      name: site.name,
      seeker: site.seeker,
      pos: from,
      vel: mul(dir, site.speed * 0.4),
      speed: site.speed * 0.4,
      speedMax: site.speed,
      maxG: site.maxG,
      trail: [],
      life: 0,
      ttl: Math.max(22, (site.range / site.speed) * 2.6),
      decoy: null,
      state: 'TRACKING',
      nextRoll: 0,
      point: null,
      line: null,
      lla: { lat: site.lat, lon: site.lon, alt: site.alt }
    };

    state.missiles.push(m);
    attachMissile(m);
    flash('LAUNCH — ' + site.name);
  }

  function steer(m, target, dt) {
    const to = sub(target, m.pos);
    const d = len(to) || 1;
    const des = mul(to, 1 / d);
    const cur = unit(m.vel);
    let dot = cur.x * des.x + cur.y * des.y + cur.z * des.z;
    dot = Math.max(-1, Math.min(1, dot));
    const ang = Math.acos(dot);
    const turn = Math.min(ang, ((m.maxG * 9.81) / m.speed) * dt);
    const t = ang > 1e-6 ? turn / ang : 1;
    const nd = unit(add(mul(cur, 1 - t), mul(des, t)));
    m.vel = mul(nd, m.speed);
    m.pos = add(m.pos, mul(m.vel, dt));
  }

  /* Each roll, every countermeasure in the seeker cone gets a chance to pull
     the missile off the aircraft. The closer it is, the stronger it looks. */
  function tryDecoy(m, now) {
    if (m.life < 1) return;                 /* booster still burning */
    if (now < m.nextRoll) return;
    m.nextRoll = now + 0.2;

    const isIR = m.seeker === 'IR';
    const pool = isIR ? state.flares : state.chaff;
    const effect = isIR ? CONFIG.flareEffect : CONFIG.chaffEffect;
    if (!pool.length || effect <= 0) return;

    const cur = unit(m.vel);
    let best = null;
    let bestD = Infinity;

    for (let i = 0; i < pool.length; i++) {
      const f = pool[i];
      const d = dist(f.pos, m.pos);
      if (d > CONFIG.decoyRange) continue;
      const dir = unit(sub(f.pos, m.pos));
      const cosang = dir.x * cur.x + dir.y * cur.y + dir.z * cur.z;
      if (cosang < 0.4) continue;
      if (d < bestD) { bestD = d; best = f; }
    }

    if (!best) return;
    if (Math.random() < effect * (1 - bestD / CONFIG.decoyRange)) {
      m.decoy = best;
      m.state = 'DECOYED';
      flash('DECOYED — MISSILE DEFEATED');
      console.log('[SAM] ' + m.name + ' decoyed at ' + Math.round(bestD) + ' m');
    }
  }

  function killMissile(index, isHit) {
    const m = state.missiles[index];
    if (!m) return;
    removeEntity(m.point);
    removeEntity(m.line);
    state.missiles.splice(index, 1);
    if (isHit) {
      state.kills += 1;
      state.hitUntil = performance.now() + 9000;
      flash('IMPACT — AIRCRAFT DESTROYED');
      console.log('[SAM] aircraft hit by ' + m.name);
    }
  }

  function stepFlares(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.life -= dt;
      f.vel.z -= 5 * dt;
      f.pos = add(f.pos, mul(f.vel, dt));
      if (f.life <= 0) {
        removeEntity(f.point);
        list.splice(i, 1);
        continue;
      }
      const c = cesium();
      if (c && f.point) {
        try {
          const l = toLla(f.pos);
          f.point.position = new c.C.ConstantPositionProperty(
            c.C.Cartesian3.fromDegrees(l.lon, l.lat, Math.max(l.alt, 1))
          );
        } catch (err) { /* frame skipped */ }
      }
    }
  }

  /* ---------- simulation ---------- */

  function update(dt, now) {
    const p = readPlayer();
    if (!p) return;

    const ppos = ecef(p.lat, p.lon, p.alt);
    let pvel = { x: 0, y: 0, z: 0 };
    if (state.prevPos && state.prevT) {
      const span = Math.max(0.02, now - state.prevT);
      pvel = mul(sub(ppos, state.prevPos), 1 / span);
      if (len(pvel) > 1200) pvel = { x: 0, y: 0, z: 0 };
    }
    state.prevPos = ppos;
    state.prevT = now;
    state.ppos = ppos;
    state.palt = p.alt;
    state.pvel = pvel;

    const grace = CONFIG.graceAfterHit && now * 1000 < state.hitUntil;
    let airborne = state.missiles.length;

    for (let i = 0; i < state.sites.length; i++) {
      const s = state.sites[i];
      const d = dist(s.ecef, ppos);
      const inRange = d <= s.range;

      if (!state.armed || grace) { s.status = 'IDLE'; s.track = 0; continue; }
      if (s.rounds <= 0) { s.status = 'EMPTY'; s.track = 0; continue; }

      if (!inRange) {
        s.track = Math.max(0, s.track - dt * 2);
        s.status = 'IDLE';
        continue;
      }

      /* outside the altitude band the site can search but never lock */
      if (p.alt < MIN_ALT || p.alt > MAX_ALT) {
        s.track = Math.max(0, s.track - dt * 2);
        s.status = p.alt < MIN_ALT ? 'TOO LOW' : 'TOO HIGH';
        continue;
      }
      if (now < s.readyAt) { s.status = 'RELOAD'; continue; }

      s.status = s.track > 0.05 ? 'TRACK' : 'SEARCH';
      s.track += dt;

      if (s.track >= CONFIG.lockTime && airborne < CONFIG.maxSimultaneous) {
        launch(s, ppos, pvel);
        s.rounds -= 1;
        s.readyAt = now + s.reload;
        s.track = 0;
        s.status = 'LAUNCH';
        airborne += 1;
      }
    }

    for (let i = state.missiles.length - 1; i >= 0; i--) {
      const m = state.missiles[i];
      m.life += dt;
      m.speed = Math.min(m.speedMax, m.speed + 340 * dt);

      if (!m.decoy) tryDecoy(m, now);

      /* decoyed: the seeker is chasing the countermeasure, so it can no
         longer fuse on the aircraft. It burns out on the decoy instead. */
      if (m.decoy) {
        if (m.decoy.life <= 0) { killMissile(i, false); continue; }
        steer(m, m.decoy.pos, dt);
        moveMissile(m);
        if (dist(m.pos, m.decoy.pos) <= 80) { killMissile(i, false); continue; }
        continue;
      }

      steer(m, ppos, dt);
      moveMissile(m);

      if (dist(m.pos, ppos) <= CONFIG.hitRadius) { killMissile(i, true); continue; }

      const lla = toLla(m.pos);
      if (m.life > m.ttl || lla.alt < 0) { killMissile(i, false); continue; }
    }

    stepFlares(state.flares, dt);
    stepFlares(state.chaff, dt);
  }

  let lastT = 0;
  function tick(ts) {
    const now = ts / 1000;
    const dt = lastT ? Math.min(0.05, now - lastT) : 0.016;
    lastT = now;
    try {
      update(dt, now);
      updateHud(now);
    } catch (err) {
      console.warn('[SAM]', err);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- boot ---------- */

  function boot() {
    for (let i = 0; i < SITES.length; i++) {
      const s = SITES[i];
      state.sites.push({
        id: s.id,
        name: s.name,
        system: s.system,
        lat: s.lat,
        lon: s.lon,
        alt: s.alt || 0,
        range: s.range,
        speed: s.speed,
        maxG: s.maxG,
        seeker: s.seeker,
        rounds: s.rounds,
        reload: s.reload,
        ecef: ecef(s.lat, s.lon, s.alt || 0),
        track: 0,
        readyAt: 0,
        status: 'IDLE',
        drawn: false
      });
    }

    buildHud();
    setText('sam-flares', String(state.cm.flares));
    setText('sam-chaffn', String(state.cm.chaff));

    const layer = setInterval(function () {
      if (state.layerDone) { clearInterval(layer); return; }
      if (drawSites()) state.layerDone = true;
    }, 1200);

    window.addEventListener('keydown', function (event) {
      if (event.repeat || event.metaKey || event.ctrlKey) return;
      const key = String(event.key || '').toLowerCase();
      if (key === ',') { event.preventDefault(); dispense('IR', 2); }
      else if (key === '.') { event.preventDefault(); dispense('RADAR', 2); }
      else if (key === 'j') { state.armed = !state.armed; flash(state.armed ? 'NETWORK ARMED' : 'NETWORK DISARMED'); }
    });

    window.geofsSAM = {
      state: state,
      sites: state.sites,
      config: CONFIG,
      arm: function () { state.armed = true; },
      disarm: function () { state.armed = false; },
      flares: function () { dispense('IR', 2); },
      chaff: function () { dispense('RADAR', 2); },
      clear: function () {
        for (let i = state.missiles.length - 1; i >= 0; i--) killMissile(i, false);
      },
      addSite: function (o) {
        if (!o || typeof o.lat !== 'number' || typeof o.lon !== 'number') return null;
        const site = {
          id: 'live-' + state.sites.length,
          name: o.name || 'Battery',
          system: o.system || 'custom',
          lat: o.lat,
          lon: o.lon,
          alt: o.alt || 0,
          range: o.range || 20000,
          speed: o.speed || 900,
          maxG: o.maxG || 18,
          seeker: o.seeker === 'IR' ? 'IR' : 'RADAR',
          rounds: o.rounds || 4,
          reload: o.reload || 30,
          ecef: ecef(o.lat, o.lon, o.alt || 0),
          track: 0,
          readyAt: 0,
          status: 'IDLE',
          drawn: false
        };
        state.sites.push(site);
        drawSites();
        return site;
      }
    };

    requestAnimationFrame(tick);
    console.log('[SAM] network online — ' + state.sites.length + ' sites');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
