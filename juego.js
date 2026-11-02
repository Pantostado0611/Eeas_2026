// Campamento Scout — exploración + supervivencia ligera, en primera persona con dibujos 2D

const cv = document.getElementById('juego');
const ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize);
resize();

// ---------- Utilidades ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Mundo ----------
const WORLD = 4000;
const CAMP = { x: WORLD / 2, y: WORLD / 2 };
const NUM_FLAGS = 5;
const STEP = 20;        // unidades del mundo por cada paso (Rover)
const CAMP_ZONE = 230;  // radio de la zona de acampado
const TOL_STEPS = 5, TOL_DEG = 15; // margen permitido al marcar en la libreta

let rnd, trees, rocks, bushes, sticks, lakes, flags, tents, decos, solids, landmarks;

// Dirección de b vista desde a (el norte es arriba)
const DIRS = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'];
const dirName = (a, b) => DIRS[(Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) + 8) % 8];
const DIRS4 = ['este', 'sur', 'oeste', 'norte'];
const dirName4 = (a, b) => DIRS4[(Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 2)) + 4) % 4];
// Rumbo en grados como en una brújula: 0° norte, 90° este, 180° sur, 270° oeste
const bearingOfAngle = ang => Math.round(((ang * 180 / Math.PI + 90) % 360 + 360) % 360) % 360;
const bearing = (a, b) => bearingOfAngle(Math.atan2(b.y - a.y, b.x - a.x));
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const stepsFromCamp = () => Math.round(dist(player, CAMP) / STEP); // pasos en línea recta desde la fogata
const conArt = (prep, l) => (prep + ' ' + l.art + ' ' + l.name).replace('de el ', 'del ').replace('a el ', 'al ');

function free(x, y, r, list, pad) {
  for (const o of list) if (Math.hypot(o.x - x, o.y - y) < o.r + r + pad) return false;
  return true;
}

function genWorld(seed) {
  rnd = mulberry32(seed);
  trees = []; rocks = []; bushes = []; sticks = []; lakes = []; flags = []; tents = []; decos = [];
  const R = (a, b) => a + rnd() * (b - a);

  // Banderas (checkpoints) en anillo alrededor del campamento
  const off = rnd() * Math.PI * 2;
  for (let i = 0; i < NUM_FLAGS; i++) {
    const a = off + i / NUM_FLAGS * Math.PI * 2 + R(-0.25, 0.25);
    const d = R(1000, 1650);
    flags.push({ x: CAMP.x + Math.cos(a) * d, y: CAMP.y + Math.sin(a) * d, r: 30, n: i + 1, done: false });
  }
  const keep = [{ x: CAMP.x, y: CAMP.y, r: 260 }, ...flags.map(f => ({ x: f.x, y: f.y, r: 110 }))];

  // Lagos
  for (let tries = 0; lakes.length < 4 && tries < 200; tries++) {
    const l = { x: R(300, WORLD - 300), y: R(300, WORLD - 300), r: R(130, 240) };
    if (free(l.x, l.y, l.r, keep, 40) && free(l.x, l.y, l.r, lakes, 150)) lakes.push(l);
  }

  // Lugares característicos: salen con su nombre en el mapa grande
  const lakeNames = [['el', 'Lago Espejo'], ['la', 'Laguna Azul'], ['el', 'Lago de las Ranas'], ['el', 'Charco del Oso']];
  landmarks = lakes.map((l, i) => ({ art: lakeNames[i][0], name: lakeNames[i][1], kind: 'lago', x: l.x, y: l.y, r: l.r, zone: l.r + 90 }));
  landmarks.push({ art: 'el', name: 'Campamento', kind: 'camp', x: CAMP.x, y: CAMP.y, r: 230, zone: 230 });
  const spots = [['el', 'Claro de las Flores', 'claro', 170], ['la', 'Roca del Águila', 'roca', 90], ['el', 'Árbol Gigante', 'arbol', 110], ['el', 'Pinar Oscuro', 'pinar', 380]];
  for (const [art, name, kind, r] of spots) {
    for (let tries = 0; tries < 400; tries++) {
      const p = { art, name, kind, x: R(350, WORLD - 350), y: R(350, WORLD - 350), r, zone: r + 40 };
      const ok = kind === 'pinar'
        ? free(p.x, p.y, r * 0.4, landmarks, 100)
        : free(p.x, p.y, r, keep, 40) && free(p.x, p.y, r, landmarks, 120);
      if (ok) { landmarks.push(p); break; }
    }
  }
  const lm = k => landmarks.find(l => l.kind === k);
  const blocked = [...keep, ...lakes, ...landmarks.filter(l => ['claro', 'roca', 'arbol'].includes(l.kind))];
  const roca = lm('roca'), arbol = lm('arbol'), pinar = lm('pinar'), claro = lm('claro');
  if (roca) for (const [dx, dy, r] of [[0, 0, 55], [-55, 32, 38], [50, 38, 34], [12, -58, 30]]) rocks.push({ x: roca.x + dx, y: roca.y + dy, r, seed: rnd() });
  if (arbol) trees.push({ x: arbol.x, y: arbol.y, r: 30, canopy: 135, pine: false, shade: 0.3 });

  // Pista de cada bandera según el lugar conocido más cercano
  for (const f of flags) {
    let best = null, bd = Infinity;
    for (const l of landmarks) {
      if (l.kind === 'camp') continue;
      const d = Math.hypot(f.x - l.x, f.y - l.y) - l.r;
      if (d < bd) { bd = d; best = l; }
    }
    f.lm = best; // la pista se arma según la categoría (ver flagHint)
    f.route = { deg: bearing(CAMP, f), steps: Math.round(dist(CAMP, f) / STEP) }; // ruta de Rover desde la fogata
    f.mark = null; f.result = null;
  }

  // Tiendas del campamento
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.9;
    tents.push({ x: CAMP.x + Math.cos(a) * 150, y: CAMP.y + Math.sin(a) * 150, r: 34, ang: a, color: ['#d9813b', '#3b7bd9', '#c9b13a'][i] });
  }

  // Árboles
  for (let tries = 0; trees.length < 950 && tries < 6000; tries++) {
    const x = R(40, WORLD - 40), y = R(40, WORLD - 40);
    const inPinar = pinar && Math.hypot(x - pinar.x, y - pinar.y) < pinar.r;
    const t = { x, y, r: 14, canopy: R(38, 66), pine: inPinar || rnd() < 0.45, shade: inPinar ? 0 : rnd() };
    if (free(t.x, t.y, 30, blocked, 0) && free(t.x, t.y, 0, trees, 34)) trees.push(t);
  }
  // Rocas
  for (let tries = 0; rocks.length < 130 && tries < 3000; tries++) {
    const k = { x: R(40, WORLD - 40), y: R(40, WORLD - 40), r: R(14, 32), seed: rnd() };
    if (free(k.x, k.y, k.r, blocked, 10) && free(k.x, k.y, k.r, trees, 4)) rocks.push(k);
  }
  const all = () => [...blocked, ...trees, ...rocks];
  // Arbustos con bayas
  for (let tries = 0; bushes.length < 170 && tries < 4000; tries++) {
    const b = { x: R(60, WORLD - 60), y: R(60, WORLD - 60), r: 22, berries: 3, regrow: 0 };
    if (Math.hypot(b.x - CAMP.x, b.y - CAMP.y) < 350) continue;
    if (free(b.x, b.y, b.r, all(), 10) && free(b.x, b.y, b.r, bushes, 30)) bushes.push(b);
  }
  for (let i = 0; i < 260; i++) placeStick();
  // Decoración del suelo (pasto, flores, hojas)
  for (let i = 0; i < 3500; i++) decos.push({ x: R(0, WORLD), y: R(0, WORLD), k: Math.floor(rnd() * 4), a: rnd() * 6.28 });
  if (claro) for (let i = 0; i < 280; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * claro.r;
    decos.push({ x: claro.x + Math.cos(a) * d, y: claro.y + Math.sin(a) * d, k: 2, a: rnd() * 6.28 });
  }
  decos = decos.filter(d => free(d.x, d.y, 0, lakes, 0)); // nada de pasto encima del agua

  solids = [...trees, ...rocks, ...lakes, ...tents, { x: CAMP.x, y: CAMP.y, r: 26 }];
  buildMap();
}

// Mapa del bosque: se dibuja una sola vez (sin jugador ni banderas, como un mapa de papel).
// MAP = tamaño del minimapa en pantalla; MAP_RES = resolución, para que el mapa grande se vea nítido
const MAP = 180, MAP_RES = 700;
const mapCv = document.createElement('canvas');
function buildMap() {
  const k = MAP_RES / WORLD, m = mapCv.getContext('2d');
  mapCv.width = mapCv.height = MAP_RES;
  const circle = (x, y, r, col) => { m.fillStyle = col; m.beginPath(); m.arc(x * k, y * k, r * k, 0, 7); m.fill(); };
  m.fillStyle = '#86ad60'; m.fillRect(0, 0, MAP_RES, MAP_RES);
  for (const l of landmarks) {
    if (l.kind === 'pinar') circle(l.x, l.y, l.r, '#5d8a4a');
    if (l.kind === 'claro') circle(l.x, l.y, l.r, '#b9d482');
  }
  for (const t of trees) circle(t.x, t.y, t.canopy, t.pine ? 'rgba(25,65,35,0.5)' : 'rgba(45,85,30,0.45)');
  for (const l of lakes) { circle(l.x, l.y, l.r + 12, '#8f8259'); circle(l.x, l.y, l.r, '#3f86b3'); }
  for (const k2 of rocks) circle(k2.x, k2.y, k2.r, '#8b8d88');
  circle(CAMP.x, CAMP.y, 230, '#b39b62');
  for (const t of tents) circle(t.x, t.y, 34, t.color);
  circle(CAMP.x, CAMP.y, 30, '#e8692a');
  const arbol = landmarks.find(l => l.kind === 'arbol');
  if (arbol) { circle(arbol.x, arbol.y, 135, '#2d5a26'); circle(arbol.x - 30, arbol.y - 30, 60, '#3f7a33'); }
  m.strokeStyle = 'rgba(60,40,20,0.6)'; m.lineWidth = 3; m.strokeRect(1.5, 1.5, MAP_RES - 3, MAP_RES - 3);
  miniCv.width = miniCv.height = MAP; // copia ya achicada para el minimapa (más rápido de dibujar)
  miniCv.getContext('2d').drawImage(mapCv, 0, 0, MAP, MAP);
}
const miniCv = document.createElement('canvas');

// Dibuja el mapa en pantalla; con nombres solo cuando es grande (en chico no caben)
function drawMapAt(x0, y0, size, labels) {
  ctx.drawImage(mapCv, x0, y0, size, size);
  if (!labels) return;
  const k = size / WORLD;
  ctx.font = `bold ${Math.round(size / 42)}px sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const l of landmarks) {
    const x = clamp(x0 + l.x * k, x0 + 70, x0 + size - 70);
    const y = Math.max(y0 + 18, y0 + l.y * k - (l.kind === 'pinar' ? 0 : l.r * k + 8));
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.strokeText(l.name, x, y);
    ctx.fillStyle = '#3a2a14'; ctx.fillText(l.name, x, y);
  }
}

function placeStick() {
  for (let tries = 0; tries < 50; tries++) {
    const s = { x: 60 + Math.random() * (WORLD - 120), y: 60 + Math.random() * (WORLD - 120), a: Math.random() * 6.28, r: 8 };
    if (player && Math.hypot(s.x - player.x, s.y - player.y) < 500) continue;
    if (free(s.x, s.y, 10, lakes, 0) && free(s.x, s.y, 10, rocks, 0) && free(s.x, s.y, 4, trees, 0)) { sticks.push(s); return; }
  }
}

// ---------- Categorías scout = dificultades (el color del uniforme es solo de adorno) ----------
// energy/fire: qué tan rápido se gastan; rain: cada cuánto llueve (más bajo = más seguido)
const CATEGORIES = [
// hint: cómo son las pistas de las banderas ('4' = N/S/E/O, '8' = con diagonales, 'grados' = rumbo en grados)
  { name: 'Lobezno/a', color: '#e8c23a', diff: 'Fácil', energy: 0.7, fire: 0.7, rain: 1.4, food: 4, hint: '4',
    desc: ['Te cansas más lento y la', 'fogata dura más. Pistas:', 'norte, sur, este u oeste.'] },
  { name: 'Tropero/a', color: '#3fae4a', diff: 'Normal', energy: 1, fire: 1, rain: 1, food: 2, hint: '8',
    desc: ['La aventura como es.', 'Pistas con noreste,', 'sureste, noroeste...'] },
  { name: 'Caminante', color: '#3b7bd9', diff: 'Difícil', energy: 1.25, fire: 1.25, rain: 0.8, food: 0, hint: 'grados',
    desc: ['Te cansas más rápido y', 'llueve más seguido.', 'Pistas en grados.'] },
  { name: 'Rover', color: '#d63a2f', diff: 'Muy difícil', energy: 1.5, fire: 1.5, rain: 0.6, food: 0, hint: 'ruta',
    desc: ['Banderas invisibles.', 'Sigue rumbo y pasos y', 'anótalo en la libreta.', '¡Suerte!'] },
];
let cat = CATEGORIES[1]; // se cambia a la guardada cuando se cargan los ajustes

// ---------- Estado ----------
const DAY_LEN = 240; // segundos por día completo
let state = 'title';
let player, fire, time, day, energy, wood, food, rain, rainTimer, nextRain, playTime;
let menuHits = [], waitingBind = null, confirmExit = false; // botones del menú de Esc y control que se está cambiando
let toasts = [], drops = [];

function startGame() {
  player = null;
  genWorld(20261101);
  player = { x: CAMP.x, y: CAMP.y + 200, ang: -Math.PI / 2, pitch: 0, step: 0, moving: false };
  fire = { fuel: 70 };
  time = 0.05; day = 1;
  cat = CATEGORIES[settings.cat] || CATEGORIES[1];
  energy = 100; wood = 0; food = cat.food;
  rain = false; rainTimer = 0; nextRain = (70 + Math.random() * 60) * cat.rain;
  toasts = []; playTime = 0; drops = []; mapOpen = false; book = false; reveal = null;
  state = 'play';
  if (cat.hint === 'ruta') toast(`Sigue el rumbo y los pasos desde la fogata. Marca con ${keyHint('marcar')} donde creas que está cada bandera.`, 7);
  else toast('Encuentra las 5 banderas con la brújula. ¡No dejes que se apague la fogata!', 6);
}

function toast(text, t = 3) { toasts.push({ text, t }); if (toasts.length > 3) toasts.shift(); }

function hour() { return (6 + time * 24) % 24; }
function darkness() {
  const h = hour();
  if (h >= 6 && h < 18) return 0;
  if (h >= 18 && h < 20) return (h - 18) / 2 * 0.86;
  if (h >= 4 && h < 6) return (6 - h) / 2 * 0.86;
  return 0.86;
}
const isNight = () => darkness() > 0.5;

function target() {
  if (cat.hint === 'ruta') {
    const r = flags.find(f => !f.done && !f.mark);
    if (r) return { x: r.x, y: r.y, name: 'Bandera ' + r.n, hint: flagHint(r) };
    if (flags.some(f => !f.done)) return { x: CAMP.x, y: CAMP.y, name: 'Campamento', hint: 'Ahí se revisa tu libreta' };
  }
  const f = flags.find(f => !f.done);
  return f ?{ x: f.x, y: f.y, name: 'Bandera ' + f.n, hint: flagHint(f) } : { x: CAMP.x, y: CAMP.y, name: 'Campamento', hint: '' };
}
function flagHint(f) {
  const l = f.lm;
  if (!l || !cat.hint) return '';
  if (cat.hint === '4') return 'al ' + dirName4(l, f) + ' ' + conArt('de', l);
  if (cat.hint === '8') return 'al ' + dirName(l, f) + ' ' + conArt('de', l);
  if (cat.hint === 'ruta') return `${f.route.deg}° y ${f.route.steps} pasos desde la fogata`;
  return 'a ' + bearing(l, f) + '° ' + conArt('de', l);
}

// ---------- Ajustes (se guardan en este navegador) ----------
const DEFAULT_BINDS = { adelante: 'w', atras: 's', izquierda: 'a', derecha: 'd', arriba: 'arrowup', abajo: 'arrowdown', correr: 'shift', usar: 'e', comer: 'f', mapa: 'm', marcar: 'q', libreta: 'l' };
const BIND_NAMES = { adelante: 'Caminar adelante', atras: 'Caminar atrás', izquierda: 'Girar a la izquierda', derecha: 'Girar a la derecha', arriba: 'Mirar arriba', abajo: 'Mirar abajo', correr: 'Correr', usar: 'Usar / recoger', comer: 'Comer', mapa: 'Mapa', marcar: 'Marcar (Rover)', libreta: 'Libreta (Rover)' };
let settings = { sens: 5, giro: 5, invert: false, cat: 1, binds: { ...DEFAULT_BINDS } };
try {
  const s = JSON.parse(localStorage.getItem('scout_ajustes'));
  if (s) settings = { ...settings, ...s, binds: { ...DEFAULT_BINDS, ...s.binds } };
} catch (e) { /* sin guardado: se usan los de siempre */ }
cat = CATEGORIES[settings.cat] || CATEGORIES[1];
function saveSettings() { try { localStorage.setItem('scout_ajustes', JSON.stringify(settings)); } catch (e) { /* no se pudo guardar */ } }
const keyName = k => ({ ' ': 'Espacio', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', shift: 'Shift', control: 'Ctrl', alt: 'Alt', tab: 'Tab', enter: 'Enter', backspace: 'Borrar' }[k] || k.toUpperCase());
const bindKey = a => keyName(settings.binds[a]);
// En celular se nombra el botón en vez de la tecla
const keyHint = a => isTouch ? ({ usar: 'Usar', comer: 'Comer', marcar: 'Marcar', libreta: 'Libreta', mapa: 'Mapa' }[a] || bindKey(a)) : bindKey(a);
function rebind(action, k) {
  const other = Object.keys(settings.binds).find(a => a !== action && settings.binds[a] === k);
  if (other) settings.binds[other] = settings.binds[action]; // si la tecla ya se usaba, se intercambian
  settings.binds[action] = k;
  saveSettings();
}

// ---------- Entrada ----------
const keys = {};
let menuOpenedAt = 0;
const mouseLocked = () => document.pointerLockElement === cv;
function openMenu() {
  state = 'menu'; waitingBind = null; confirmExit = false; menuOpenedAt = performance.now();
  for (const k in keys) keys[k] = false;
  if (mouseLocked()) document.exitPointerLock();
}
function closeMenu() { state = 'play'; waitingBind = null; confirmExit = false; }
function exitToTitle() { state = 'title'; confirmExit = false; player = null; mapOpen = false; book = false; reveal = null; }
function lockMouse() {
  if (!cv.requestPointerLock || mouseLocked()) return;
  const p = cv.requestPointerLock();
  if (p && p.catch) p.catch(() => {}); // el navegador a veces no deja justo después de soltarlo
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
  if (waitingBind) { // en el menú, esperando la tecla nueva para un control
    e.preventDefault();
    if (k !== 'escape') rebind(waitingBind, k);
    waitingBind = null;
    return;
  }
  if (e.repeat) return;
  keys[k] = true;
  if (k === 'enter' && (state === 'title' || state === 'win' || state === 'lose')) startGame();
  if (state === 'title') { // elegir categoría con flechas, A/D o 1-4
    if (k === 'arrowleft' || k === 'a') pickCategory(settings.cat - 1);
    if (k === 'arrowright' || k === 'd') pickCategory(settings.cat + 1);
    if (k >= '1' && k <= '4') pickCategory(+k - 1);
  }
  if (k === 'escape' && (state === 'win' || state === 'lose')) { state = 'title'; return; }
  if (k === 'escape') {
    if (state === 'play') { if (mapOpen) mapOpen = false; else if (book) { if (!reveal) book = false; } else openMenu(); }
    else if (state === 'menu' && confirmExit) confirmExit = false;
    else if (state === 'menu' && performance.now() - menuOpenedAt > 300) closeMenu();
    return;
  }
  if (state === 'play') {
    for (const a of ['usar', 'comer', 'mapa', 'libreta', 'marcar']) if (k === settings.binds[a]) doAction(a);
    if (k === 'backspace' && book && !reveal) eraseLastMark();
  }
});
// Acciones del juego (las usan el teclado y los botones táctiles)
function doAction(a) {
  if (a === 'usar') interact();
  if (a === 'comer') eat();
  if (a === 'mapa' && !book) mapOpen = !mapOpen;
  if (a === 'menu') openMenu();
  if (cat.hint === 'ruta') {
    if (a === 'libreta' && !reveal) { book = !book; mapOpen = false; }
    if (a === 'marcar' && !book) markFlag();
  }
}
function eraseLastMark() {
  const m = flags.filter(f => !f.done && f.mark).pop();
  if (m) { m.mark = null; toast('Borraste la marca de la Bandera ' + m.n + '.'); }
}
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

let dragSlider = null;
function pickCategory(i) {
  settings.cat = clamp(i, 0, CATEGORIES.length - 1);
  cat = CATEGORIES[settings.cat];
  saveSettings();
}
// Clic (o toque) en las pantallas de título, menú, mapa y libreta. Devuelve true si lo usó.
function tapAt(cx, cy) {
  const inside = h => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h;
  if (state === 'title') { // clic en una tarjeta la elige; clic en la ya elegida (o en Empezar) arranca
    for (const h of menuHits) if (inside(h)) { h.fn(); break; }
    return true;
  }
  if (state === 'menu') {
    for (const h of menuHits) if (inside(h)) { h.fn(cx); if (h.slider) dragSlider = h; break; }
    return true;
  }
  if (state === 'win' || state === 'lose') { if (isTouch) state = 'title'; return true; }
  if (state !== 'play') return true;
  if (mapOpen) { mapOpen = false; return true; }
  if (book) {
    if (reveal) return true;
    if (bookErase && inside(bookErase)) eraseLastMark(); else book = false;
    return true;
  }
  return false;
}
cv.addEventListener('mousedown', e => {
  if (tapAt(e.clientX, e.clientY)) return;
  const { x, y } = miniRect();
  if (e.clientX >= x && e.clientX <= x + MAP && e.clientY >= y && e.clientY <= y + MAP) { mapOpen = true; return; }
  lockMouse();
});

// ---------- Controles táctiles (celular) ----------
// Mitad izquierda: palanca para caminar y girar. Resto: arrastrar para mirar. Botones a la derecha.
let isTouch = matchMedia('(pointer: coarse)').matches; // también se activa al primer toque
const touch = { stick: null, look: null, run: false, fwd: 0, turn: 0, flash: null };
const STICK_R = 60;
function touchButtons() {
  const b = [];
  const add = (id, label, x, y, r = 32) => b.push({ id, label, x, y, r });
  add('usar', 'Usar', W - 70, H - 72, 38);
  add('correr', 'Correr', W - 70, H - 158, 30);
  add('comer', 'Comer', W - 158, H - 50, 30);
  if (cat.hint === 'ruta') { add('marcar', 'Marcar', W - 152, H - 130, 30); add('libreta', 'Libreta', H > W ? W - 70 : W - 240, H > W ? H - 240 : H - 50, 30); }
  if (H > W) { add('mapa', 'Mapa', W - 120, 206, 24); add('menu', 'Menú', W - 54, 206, 24); } // vertical: debajo de la brújula
  else { add('mapa', 'Mapa', W / 2 - 46, 30, 24); add('menu', 'Menú', W / 2 + 46, 30, 24); }
  return b;
}
function touchPress(id) {
  touch.flash = { id, t: 0.15 };
  if (id === 'correr') { touch.run = !touch.run; return; }
  doAction(id);
}
function stickMove(s) {
  let dx = s.x - s.ox, dy = s.y - s.oy;
  const d = Math.hypot(dx, dy);
  if (d > STICK_R) { s.ox = s.x - dx / d * STICK_R; s.oy = s.y - dy / d * STICK_R; dx = s.x - s.ox; dy = s.y - s.oy; } // la base sigue al dedo
  const dead = v => Math.abs(v) < 0.18 ? 0 : v;
  touch.fwd = dead(-dy / STICK_R); touch.turn = dead(dx / STICK_R);
}
cv.addEventListener('touchstart', e => {
  e.preventDefault(); isTouch = true;
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY;
    if (tapAt(x, y)) continue;
    const btn = touchButtons().find(b => Math.hypot(x - b.x, y - b.y) < b.r + 10);
    if (btn) { touchPress(btn.id); continue; }
    if (x < W * 0.45 && !touch.stick) { touch.stick = { id: t.identifier, ox: x, oy: y, x, y }; stickMove(touch.stick); }
    else if (!touch.look) touch.look = { id: t.identifier, x, y };
  }
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY;
    if (dragSlider && state === 'menu') dragSlider.fn(x);
    if (touch.stick && touch.stick.id === t.identifier) { touch.stick.x = x; touch.stick.y = y; stickMove(touch.stick); }
    if (touch.look && touch.look.id === t.identifier && state === 'play' && !mapOpen && !book) {
      const k = settings.sens * 0.0012;
      player.ang += (x - touch.look.x) * k;
      player.pitch = clamp(player.pitch - (y - touch.look.y) * k * (settings.invert ? -1 : 1), -0.5, 0.5);
      touch.look.x = x; touch.look.y = y;
    }
  }
}, { passive: false });
function touchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (touch.stick && touch.stick.id === t.identifier) { touch.stick = null; touch.fwd = touch.turn = 0; }
    if (touch.look && touch.look.id === t.identifier) touch.look = null;
  }
  if (!e.touches.length) dragSlider = null;
}
cv.addEventListener('touchend', touchEnd, { passive: false });
cv.addEventListener('touchcancel', touchEnd, { passive: false });

function drawTouchControls() {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // palanca
  const s = touch.stick, bx = s ? s.ox : 100, by = s ? s.oy : H - 100;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.arc(s ? s.x : bx, s ? s.y : by, 26, 0, 7); ctx.fill();
  if (!s) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '12px sans-serif'; ctx.fillText('caminar', bx, by + STICK_R + 14); }
  // botones
  for (const b of touchButtons()) {
    const on = (b.id === 'correr' && touch.run) || (touch.flash && touch.flash.id === b.id);
    ctx.fillStyle = on ? 'rgba(224,162,58,0.85)' : 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    ctx.fillStyle = on ? '#222' : '#fff'; ctx.font = `bold ${b.r > 30 ? 14 : 11}px sans-serif`;
    ctx.fillText(b.label, b.x, b.y);
  }
  if (H > W) { // en vertical casi no cabe: sugerir girar el celular
    ctx.font = 'bold 13px sans-serif';
    const msg = '📱 Gira el celular para jugar mejor', w = ctx.measureText(msg).width + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(W / 2 - w / 2, H * 0.62, w, 24, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(msg, W / 2, H * 0.62 + 12);
  }
  ctx.restore();
}
addEventListener('mousemove', e => {
  if (dragSlider && state === 'menu') dragSlider.fn(e.clientX);
  if (mouseLocked() && state === 'play' && !mapOpen && !book) {
    const k = settings.sens * 0.0006;
    player.ang += e.movementX * k;
    player.pitch = clamp(player.pitch - e.movementY * k * (settings.invert ? -1 : 1), -0.5, 0.5);
  }
});
addEventListener('mouseup', () => { dragSlider = null; });
// Esc suelta el mouse (lo hace el navegador): en ese momento se abre el menú
document.addEventListener('pointerlockchange', () => { if (!mouseLocked() && state === 'play') openMenu(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') openMenu(); });

function nearInteract() {
  const u = '[' + keyHint('usar') + '] ';
  if (dist(player, CAMP) < 80) return { kind: 'fire', label: wood > 0 ? u + 'Echar leña' : 'Necesitas leña' };
  for (const b of bushes) if (b.berries > 0 && dist(player, b) < b.r + 30) return { kind: 'bush', obj: b, label: u + 'Recoger bayas' };
  return null;
}

function interact() {
  const n = nearInteract();
  if (!n) return;
  if (n.kind === 'fire') {
    if (wood <= 0) { toast('No traes leña. Busca ramas en el bosque.'); return; }
    if (fire.fuel <= 0) toast('¡Volviste a prender la fogata!');
    const need = Math.ceil((100 - fire.fuel) / 20);
    const used = Math.max(1, Math.min(wood, need));
    wood -= used; fire.fuel = Math.min(100, fire.fuel + used * 20);
    toast('Echaste ' + used + ' de leña al fuego.');
  } else if (n.kind === 'bush') {
    const got = Math.min(n.obj.berries, 10 - food);
    if (got <= 0) { toast('Ya no te caben más bayas.'); return; }
    food += got; n.obj.berries -= got; n.obj.regrow = 0;
    toast('+' + got + ' bayas');
  }
}

// ---------- Libreta (Rover) ----------
// Marcas donde crees que está la bandera; al volver al campamento se revisan en orden del 1 al 5.
let book = false, reveal = null, bookErase = null; // bookErase: botón táctil de borrar marca
function markFlag() {
  if (dist(player, CAMP) < CAMP_ZONE) { toast('Sal del campamento para marcar.'); return; }
  const f = flags.find(f => !f.done && !f.mark);
  if (!f) { toast('Ya marcaste todas. Vuelve al campamento a revisar tu libreta.'); return; }
  f.mark = { deg: bearing(CAMP, player), steps: stepsFromCamp() };
  toast(`📒 Bandera ${f.n} anotada: ${f.mark.deg}°, ${f.mark.steps} pasos`, 4);
  if (!flags.some(g => !g.done && !g.mark)) toast('¡Libreta completa! Regresa al campamento.', 4);
}
function updateReveal(dt) {
  reveal.t += dt;
  if (reveal.i < NUM_FLAGS) {
    if (reveal.t < 0.9) return;
    reveal.t = 0;
    const f = flags[reveal.i++];
    if (f.done) return;
    const ok = Math.abs(f.mark.steps - f.route.steps) <= TOL_STEPS && angDiff(f.mark.deg, f.route.deg) <= TOL_DEG;
    if (ok) { f.done = true; f.result = 'ok'; } else { f.result = 'mal'; f.mark = null; }
  } else if (reveal.t > 1.6) {
    reveal = null;
    if (flags.every(f => f.done)) { book = false; state = 'win'; }
    else toast('Las que salieron mal se borraron: búscalas otra vez.', 5);
  }
}

function drawBook() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  const w = Math.min(560, W - 40), h = 400, x0 = (W - w) / 2, y0 = (H - h) / 2;
  ctx.fillStyle = '#f4ecd2'; roundRect(x0, y0, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#8e7a4a'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(80,120,180,0.25)'; ctx.lineWidth = 1; // renglones
  for (let y = y0 + 90; y < y0 + h - 50; y += 28) { ctx.beginPath(); ctx.moveTo(x0 + 20, y); ctx.lineTo(x0 + w - 20, y); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#3a2a14'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('📒 Libreta de campo', W / 2, y0 + 42);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#6b5a3a';
  ctx.fillText(`Se vale fallar hasta ${TOL_STEPS} pasos y ${TOL_DEG}°`, W / 2, y0 + 66);
  flags.forEach((f, i) => {
    const y = y0 + 110 + i * 52;
    const checking = reveal && reveal.i === i + 1 && reveal.t < 0.9 || reveal && reveal.i <= i;
    ctx.textAlign = 'left'; ctx.fillStyle = '#3a2a14'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Bandera ${f.n}`, x0 + 24, y);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#6b5a3a';
    ctx.fillText(`Pista: ${f.route.deg}° y ${f.route.steps} pasos`, x0 + 24, y + 20);
    ctx.textAlign = 'right'; ctx.font = 'bold 15px sans-serif';
    let txt, col;
    if (f.done) { txt = '✓ ¡Encontrada!'; col = '#2e8b3a'; }
    else if (reveal && reveal.i <= i && f.mark) { txt = `${f.mark.deg}°, ${f.mark.steps} pasos  …`; col = '#3a2a14'; }
    else if (f.mark) { txt = `Tu marca: ${f.mark.deg}°, ${f.mark.steps} pasos`; col = '#2a4a8a'; }
    else if (f.result === 'mal') { txt = '✗ Mal, búscala otra vez'; col = '#c0392b'; }
    else { txt = '— sin marcar —'; col = '#9a8a6a'; }
    if (checking && f.mark && !f.done) col = '#b07a10';
    ctx.fillStyle = col; ctx.fillText(txt, x0 + w - 24, y + 10);
  });
  ctx.textAlign = 'center'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#6b5a3a';
  bookErase = null;
  if (isTouch && !reveal && flags.some(f => !f.done && f.mark)) { // botón para borrar la última marca
    bookErase = { x: x0 + w - 190, y: y0 + h - 44, w: 170, h: 30 };
    ctx.fillStyle = '#c0392b'; roundRect(bookErase.x, bookErase.y, bookErase.w, bookErase.h, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Borrar última marca', bookErase.x + bookErase.w / 2, bookErase.y + 20);
    ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#6b5a3a';
    ctx.fillText('Toca afuera para cerrar', x0 + 20, y0 + h - 24);
    return;
  }
  ctx.fillText(reveal ? 'Revisando...' : isTouch ? 'Toca para cerrar' : `${bindKey('libreta')} o clic: cerrar · Borrar: quitar la última marca`, W / 2, y0 + h - 18);
}

function eat() {
  if (food <= 0) { toast('No tienes comida. Busca arbustos con bayas.'); return; }
  if (energy >= 99) { toast('No tienes hambre.'); return; }
  food--; energy = Math.min(100, energy + 14);
  toast('Ñam. +energía');
}

// ---------- Actualización ----------
function update(dt) {
  for (const t of toasts) t.t -= dt;
  toasts = toasts.filter(t => t.t > 0);
  if (touch.flash && (touch.flash.t -= dt) <= 0) touch.flash = null;
  if (state === 'play' && reveal) { updateReveal(dt); return; }
  if (state !== 'play' || mapOpen || book) return;
  playTime += dt;

  // Tiempo y días
  time += dt / DAY_LEN;
  if (time >= 1) { time -= 1; day++; toast('☀ Amanece el día ' + day); }

  // Clima
  if (rain) {
    rainTimer -= dt;
    if (rainTimer <= 0) { rain = false; nextRain = (90 + Math.random() * 120) * cat.rain; toast('Dejó de llover.'); }
  } else {
    nextRain -= dt;
    if (nextRain <= 0) { rain = true; rainTimer = 30 + Math.random() * 35; toast('🌧 Empezó a llover: el fuego se gasta más rápido.', 4); }
  }

  // Movimiento en primera persona: A/D giran, W/S caminan hacia adelante/atrás
  const down = a => keys[settings.binds[a]];
  let turn = 0, fwd = 0, look = 0;
  if (down('izquierda')) turn--;
  if (down('derecha')) turn++;
  if (down('adelante')) fwd++;
  if (down('atras')) fwd--;
  if (down('arriba')) look++;
  if (down('abajo')) look--;
  turn = clamp(turn + touch.turn, -1, 1); fwd = clamp(fwd + touch.fwd, -1, 1); // palanca táctil
  const running = (down('correr') || touch.run) && fwd > 0;
  player.ang += turn * (0.6 + settings.giro * 0.34) * dt;
  player.pitch = clamp(player.pitch + look * 1.1 * dt, -0.5, 0.5);
  player.moving = fwd !== 0;
  if (player.moving) {
    const sp = (running ? 250 : 150) * (fwd < 0 ? 0.6 : 1) * (energy < 15 ? 0.6 : 1);
    player.x += Math.cos(player.ang) * fwd * sp * dt; player.y += Math.sin(player.ang) * fwd * sp * dt;
    player.step += dt * (running ? 14 : 9);
  }
  // Choques (círculos)
  const PR = 16;
  for (const s of solids) {
    const dx = player.x - s.x, dy = player.y - s.y, d = Math.hypot(dx, dy), m = s.r + PR;
    if (d < m && d > 0.001) { player.x = s.x + dx / d * m; player.y = s.y + dy / d * m; }
  }
  player.x = clamp(player.x, 30, WORLD - 30);
  player.y = clamp(player.y, 30, WORLD - 30);

  // Al entrar a un lugar conocido te dice su nombre
  const place = landmarks.find(l => Math.hypot(player.x - l.x, player.y - l.y) < l.zone);
  const pn = place ? place.name : null;
  if (pn !== player.place) { if (pn && player.place !== undefined) toast('📍 ' + pn); player.place = pn; }

  // Ramas: se recogen solas al pasar
  for (let i = sticks.length - 1; i >= 0; i--) {
    if (wood < 8 && dist(player, sticks[i]) < 26) {
      sticks.splice(i, 1); wood++; placeStick();
      if (wood === 8) toast('Ya llevas toda la leña que puedes cargar (8).');
    }
  }
  // Bayas vuelven a crecer
  for (const b of bushes) if (b.berries < 3 && (b.regrow += dt) > 45) { b.berries++; b.regrow = 0; }

  // Banderas
  if (cat.hint === 'ruta') { // Rover: al volver al campamento con la libreta llena, se revisa
    if (flags.some(f => !f.done) && flags.every(f => f.done || f.mark) && dist(player, CAMP) < CAMP_ZONE) {
      book = true; mapOpen = false; reveal = { t: 0, i: 0 };
    }
  } else for (const f of flags) {
    if (!f.done && dist(player, f) < 55) {
      f.done = true;
      const left = flags.filter(f => !f.done).length;
      toast(left ? '🚩 ¡Bandera ' + f.n + ' encontrada! Faltan ' + left + '.' : '🚩 ¡Todas las banderas! Regresa al campamento.', 4);
    }
  }
  if (flags.every(f => f.done) && dist(player, CAMP) < 120) { state = 'win'; return; }

  // Fogata
  if (fire.fuel > 0) {
    fire.fuel -= dt * (rain ? 1.1 : 0.55) * cat.fire;
    if (fire.fuel <= 0) { fire.fuel = 0; toast('🔥 ¡Se apagó la fogata! Trae leña para prenderla.', 4); }
  }

  // Energía (hambre + frío)
  const cold = isNight() && (fire.fuel <= 0 || dist(player, CAMP) > 320);
  let drain = 0.3 * cat.energy;
  if (running && player.moving) drain *= 1.8;
  if (cold) drain *= 1.6;
  if (rain) drain *= 1.15;
  energy -= dt * drain;
  if (cold && Math.random() < dt / 20) toast('Tienes frío... acércate a la fogata.');
  if (energy <= 25 && energy + dt * drain > 25) toast('Tienes mucha hambre. Come algo con [' + keyHint('comer') + '].', 4);
  if (energy <= 0) { energy = 0; state = 'lose'; }

  // Gotas de lluvia
  if (rain) for (let i = 0; i < 6; i++) drops.push({ x: Math.random() * W, y: -10, v: 700 + Math.random() * 300, l: 1 });
  for (const d of drops) { d.y += d.v * dt; d.x -= d.v * dt * 0.15; }
  drops = drops.filter(d => d.y < H + 20);
}

// ---------- Dibujo en primera persona ----------
// No es 3D de verdad: el suelo es un degradado y todo (árboles, rocas...) son dibujos 2D de frente
// que se hacen más chicos con la distancia. Lo lejano se ve más oscuro y borroso.
const FOV = 1.6;          // ángulo de visión (radianes, ~92°); más grande = menos zoom
const EYE = 55;           // altura de los ojos
const FAR = 1500;         // más allá de esto ya no se dibuja nada (se pierde en la niebla)
const FOG_STEPS = [320, 680, 1050]; // distancias donde cada cosa pasa al siguiente nivel de oscuro/borroso
let HOR = 0, FOC = 1;     // altura del horizonte en pantalla y "zoom" de la cámara

// --- Dibujos 2D (se pintan una vez, en 4 niveles de lejanía) ---
const PAD = 8;
function makeSprite(w, h, paint) {
  const base = document.createElement('canvas');
  base.width = w + PAD * 2; base.height = h + PAD * 2;
  const b = base.getContext('2d');
  b.translate(PAD, PAD); paint(b, w, h);
  const levels = [];
  const dark = [0, 0.22, 0.42, 0.6], blur = [0, 0.5, 1.4, 2.6];
  for (let L = 0; L < 4; L++) {
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    const g = c.getContext('2d');
    if (blur[L]) g.filter = `blur(${blur[L]}px)`;
    g.drawImage(base, 0, 0);
    g.filter = 'none';
    if (dark[L]) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(14,26,24,${dark[L]})`; g.fillRect(0, 0, c.width, c.height); }
    levels.push(c);
  }
  return { levels, w, h };
}
const blob = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

function paintOak(g, w, h, hue, light) {
  g.fillStyle = '#5a3d24'; g.fillRect(w / 2 - w * 0.07, h * 0.45, w * 0.14, h * 0.55);
  g.fillStyle = '#47301c'; g.fillRect(w / 2, h * 0.45, w * 0.07, h * 0.55);
  const cx = w / 2, cy = h * 0.34, r = w * 0.3;
  for (const [dx, dy, k] of [[-0.55, 0.25, 0.8], [0.55, 0.25, 0.8], [0, -0.35, 0.95], [-0.35, -0.1, 0.85], [0.4, -0.05, 0.85], [0, 0.3, 0.9]])
    blob(g, cx + dx * r * 1.2, cy + dy * r * 1.2, r * k, `hsl(${hue},40%,${light}%)`);
  for (const [dx, dy, k] of [[-0.3, -0.4, 0.5], [0.2, -0.55, 0.4], [-0.6, 0, 0.35]])
    blob(g, cx + dx * r, cy + dy * r, r * k, `hsl(${hue - 5},45%,${light + 8}%)`);
}
function paintPine(g, w, h, light) {
  g.fillStyle = '#4a3220'; g.fillRect(w / 2 - w * 0.06, h * 0.8, w * 0.12, h * 0.2);
  for (let i = 0; i < 4; i++) {
    const top = h * (0.02 + i * 0.19), bot = h * (0.36 + i * 0.16), half = w * (0.22 + i * 0.09);
    g.fillStyle = `hsl(145,35%,${light + i * 2}%)`;
    g.beginPath(); g.moveTo(w / 2, top); g.lineTo(w / 2 + half, bot); g.lineTo(w / 2 - half, bot); g.fill();
    g.fillStyle = `hsl(145,35%,${light + 7 + i * 2}%)`;
    g.beginPath(); g.moveTo(w / 2, top); g.lineTo(w / 2 - half, bot); g.lineTo(w / 2 - half * 0.3, bot); g.fill();
  }
}
function paintRock(g, w, h, seed) {
  g.fillStyle = '#6f716b'; g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + i / 8 * Math.PI, rr = 0.85 + ((seed * 31 * (i + 1)) % 1) * 0.15;
    g.lineTo(w / 2 + Math.cos(a) * w / 2 * rr, h + Math.sin(a) * h * rr);
  }
  g.fill();
  g.fillStyle = '#9a9c95'; g.beginPath(); g.ellipse(w * 0.4, h * 0.45, w * 0.22, h * 0.22, 0, 0, 7); g.fill();
}
function paintBush(g, w, h, berries) {
  for (const [dx, dy, r] of [[0.25, 0.65, 0.28], [0.75, 0.65, 0.28], [0.5, 0.45, 0.35], [0.5, 0.75, 0.3]])
    blob(g, w * dx, h * dy, w * r, '#2f6b2a');
  blob(g, w * 0.4, h * 0.38, w * 0.18, '#3f8a35');
  for (let i = 0; i < berries * 4; i++) blob(g, w * (0.18 + ((i * 0.37) % 0.64)), h * (0.3 + ((i * 0.53) % 0.55)), w * 0.045, '#c4243a');
}
function paintTent(g, w, h, col) {
  g.fillStyle = col; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h); g.lineTo(w / 2, h); g.fill();
  g.fillStyle = '#2b2018'; g.beginPath(); g.moveTo(w / 2, h * 0.35); g.lineTo(w * 0.64, h); g.lineTo(w * 0.36, h); g.fill();
}
function paintFlag(g, w, h, done, n) {
  g.fillStyle = '#6b4a2b'; g.fillRect(w * 0.15, 0, w * 0.08, h);
  g.fillStyle = done ? '#3fae4a' : '#e0402c';
  g.beginPath(); g.moveTo(w * 0.23, h * 0.03); g.lineTo(w, h * 0.17); g.lineTo(w * 0.23, h * 0.33); g.fill();
  g.fillStyle = '#fff'; g.font = `bold ${Math.round(h * 0.16)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(n, w * 0.5, h * 0.18);
}
function paintStick(g, w, h) {
  g.strokeStyle = '#6b4a2b'; g.lineWidth = h * 0.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(2, h * 0.7); g.lineTo(w - 2, h * 0.4); g.moveTo(w * 0.6, h * 0.5); g.lineTo(w * 0.75, 0); g.stroke();
}
function paintTuft(g, w, h, kind) {
  if (kind === 2) { // flor
    g.strokeStyle = '#3f6b2c'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.3); g.stroke();
    blob(g, w / 2, h * 0.3, w * 0.25, ['#e8e3d0', '#e7c94a', '#c77dd6'][Math.floor(Math.random() * 3)]);
    return;
  }
  g.strokeStyle = kind ? '#6a9a4a' : '#46703a'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  for (let i = -2; i <= 2; i++) { g.moveTo(w / 2 + i * w * 0.08, h); g.lineTo(w / 2 + i * w * 0.2, h * (0.1 + Math.abs(i) * 0.15)); }
  g.stroke();
}

const SPR = {};
function buildSprites() {
  SPR.oak = [0, 1, 2].map(i => makeSprite(150, 230, (g, w, h) => paintOak(g, w, h, 95 + i * 12, 26 + i * 5)));
  SPR.pine = [0, 1, 2].map(i => makeSprite(110, 260, (g, w, h) => paintPine(g, w, h, 17 + i * 4)));
  SPR.giant = makeSprite(300, 460, (g, w, h) => paintOak(g, w, h, 100, 24));
  SPR.rock = [0.13, 0.57].map(s => makeSprite(110, 70, (g, w, h) => paintRock(g, w, h, s)));
  SPR.bush = [0, 1, 2, 3].map(n => makeSprite(80, 56, (g, w, h) => paintBush(g, w, h, n)));
  SPR.tent = ['#d9813b', '#3b7bd9', '#c9b13a'].map(c => makeSprite(120, 80, (g, w, h) => paintTent(g, w, h, c)));
  SPR.flag = [false, true].map(d => [1, 2, 3, 4, 5].map(n => makeSprite(60, 140, (g, w, h) => paintFlag(g, w, h, d, n))));
  SPR.stick = makeSprite(40, 12, paintStick);
  SPR.tuft = [0, 1, 2].map(k => makeSprite(24, 22, (g, w, h) => paintTuft(g, w, h, k)));
}
buildSprites();

// Bosque lejano en el horizonte (dos capas que giran contigo, la de atrás más oscura y borrosa)
const ridge = [0, 1].map(layer => {
  const c = document.createElement('canvas'); c.width = 2400; c.height = 160;
  const g = c.getContext('2d'), r = mulberry32(77 + layer);
  if (layer === 1) g.filter = 'blur(2px)';
  g.fillStyle = layer ? '#24382f' : '#1d3026';
  for (let x = -40; x < c.width + 40; x += 18 + r() * 22) {
    const h = (layer ? 50 : 80) + r() * (layer ? 40 : 70), w = 26 + r() * 24;
    g.beginPath(); g.moveTo(x, c.height - h); g.lineTo(x + w / 2, c.height); g.lineTo(x - w / 2, c.height); g.fill();
    if (r() < 0.5) { g.beginPath(); g.arc(x, c.height - h * 0.6, w * 0.6, 0, 7); g.fill(); }
  }
  g.fillRect(0, c.height - 20, c.width, 20);
  return c;
});
const stars = Array.from({ length: 140 }, (_, i) => { const r = mulberry32(900 + i); return { a: r() * Math.PI * 2, y: r() * 0.9, s: r() < 0.15 ? 2 : 1 }; });

// --- Cámara ---
function project(x, y) {
  const dx = x - player.x, dy = y - player.y, cs = Math.cos(player.ang), sn = Math.sin(player.ang);
  return { z: dx * cs + dy * sn, xr: -dx * sn + dy * cs };
}
const fogLevel = z => z < FOG_STEPS[0] ? 0 : z < FOG_STEPS[1] ? 1 : z < FOG_STEPS[2] ? 2 : 3;

// Colores del cielo según la hora (de noche: azul, no negro)
function skyColors() {
  const h = hour(), n = darkness() / 0.86;
  const dayTop = [110, 170, 225], dayBot = [200, 225, 235];
  const nightTop = [28, 45, 105], nightBot = [70, 95, 160];
  const duskBot = [235, 150, 95];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  let top = mix(dayTop, nightTop, n), bot = mix(dayBot, nightBot, n);
  const dusk = (h >= 17 && h < 20) || (h >= 4.5 && h < 7) ? 1 - Math.min(1, Math.abs(h < 12 ? h - 5.8 : h - 18.6) / 1.4) : 0;
  if (dusk > 0) bot = mix(bot, duskBot, dusk * 0.8);
  if (rain) { top = mix(top, [120, 125, 135], 0.5); bot = mix(bot, [150, 155, 160], 0.5); }
  return { top: `rgb(${top})`, bot: `rgb(${bot})`, n };
}

// Mancha en el suelo (lagos, claros, campamento): círculo del mundo proyectado en perspectiva
function groundCircle(cx, cy, r, color) {
  if (Math.hypot(cx - player.x, cy - player.y) - r > FAR) return;
  const NEAR = 4, pts = [];
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; pts.push(project(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
  const clipped = [];
  for (let i = 0; i < pts.length; i++) { // recortar lo que queda detrás de la cámara
    const p = pts[i], q = pts[(i + 1) % pts.length];
    if (p.z >= NEAR) clipped.push(p);
    if ((p.z >= NEAR) !== (q.z >= NEAR)) { const t = (NEAR - p.z) / (q.z - p.z); clipped.push({ z: NEAR, xr: p.xr + (q.xr - p.xr) * t }); }
  }
  if (clipped.length < 3) return;
  ctx.fillStyle = color; ctx.beginPath();
  for (const p of clipped) ctx.lineTo(W / 2 + p.xr / p.z * FOC, HOR + EYE / p.z * FOC);
  ctx.fill();
}

function drawWorld() {
  // Mirar arriba/abajo: el horizonte sube o baja en la pantalla
  HOR = Math.round(H * 0.47 + (player.pitch || 0) * H * 0.9);
  FOC = (W / 2) / Math.tan(FOV / 2);
  const sky = skyColors();

  // Cielo
  let g = ctx.createLinearGradient(0, 0, 0, HOR);
  g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
  ctx.fillStyle = g; if (HOR > 0) ctx.fillRect(0, 0, W, HOR + 2);
  if (sky.n > 0.3) {
    ctx.fillStyle = `rgba(255,255,240,${(sky.n - 0.3) * (rain ? 0.3 : 1)})`;
    for (const s of stars) {
      let a = s.a - player.ang; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > FOV / 2) continue;
      ctx.fillRect(W / 2 + a / (FOV / 2) * W / 2, HOR - H * 0.47 + s.y * H * 0.4, s.s, s.s);
    }
  }
  // Bosque lejano: la capa de atrás primero
  const full = W * (Math.PI * 2 / FOV); // ancho en pantalla de una vuelta completa
  [ridge[1], ridge[0]].forEach((c, i) => {
    const sh = H * (i ? 0.17 : 0.13), sw = c.width * (sh / c.height);
    const off = (((player.ang / (Math.PI * 2)) * full * (i ? 1 : 0.85)) % sw + sw) % sw;
    for (let x = -off; x < W; x += sw) ctx.drawImage(c, x, HOR - sh + 3, sw, sh);
  });

  // Suelo: oscuro a lo lejos, claro cerca
  g = ctx.createLinearGradient(0, HOR, 0, H);
  g.addColorStop(0, '#1f3326'); g.addColorStop(0.18, '#34532f'); g.addColorStop(1, '#5d8c40');
  ctx.fillStyle = g; if (HOR < H) ctx.fillRect(0, HOR, W, H - HOR);

  // Manchas del suelo
  for (const l of landmarks) {
    if (l.kind === 'pinar') groundCircle(l.x, l.y, l.r, 'rgba(25,50,30,0.35)');
    if (l.kind === 'claro') groundCircle(l.x, l.y, l.r, 'rgba(150,190,100,0.35)');
  }
  groundCircle(CAMP.x, CAMP.y, 230, 'rgba(140,120,80,0.75)');
  for (const l of lakes) { groundCircle(l.x, l.y, l.r + 14, 'rgba(140,128,90,0.9)'); groundCircle(l.x, l.y, l.r, '#3a7aa6'); }

  // Juntar todo lo que se ve y dibujarlo de lo más lejano a lo más cercano
  const list = [];
  const add = (o, spr, w, h, extra) => {
    const p = project(o.x, o.y);
    if (p.z < 10 || p.z > FAR) return;
    const sx = W / 2 + p.xr / p.z * FOC, sc = FOC / p.z;
    if (sx + w * sc < -50 || sx - w * sc > W + 50) return;
    list.push({ z: p.z, sx, sc, spr, w, h, extra });
  };
  for (const t of trees) {
    if (t.canopy > 100) add(t, SPR.giant, 330, 520);
    else if (t.pine) add(t, SPR.pine[Math.floor(t.shade * 2.99)], t.canopy * 1.9, t.canopy * 4.6);
    else add(t, SPR.oak[Math.floor(t.shade * 2.99)], t.canopy * 2.3, t.canopy * 3.6);
  }
  for (const k of rocks) add(k, SPR.rock[k.seed < 0.5 ? 0 : 1], k.r * 2.6, k.r * 1.7);
  for (const b of bushes) add(b, SPR.bush[b.berries], 62, 44);
  for (const t of tents) add(t, SPR.tent[tents.indexOf(t)], 96, 66);
  for (const f of flags) if (f.done || cat.hint !== 'ruta') add(f, SPR.flag[f.done ? 1 : 0][f.n - 1], 46, 120); // en Rover son invisibles hasta revelarlas
  for (const s of sticks) add(s, SPR.stick, 30, 9);
  for (const d of decos) {
    const dd = Math.abs(d.x - player.x) + Math.abs(d.y - player.y);
    if (dd < 700) add(d, SPR.tuft[d.k === 2 ? 2 : d.k % 2], 16, 14);
  }
  add(CAMP, 'fire', 60, 40);
  list.sort((a, b) => b.z - a.z);

  for (const it of list) {
    const w = it.w * it.sc, h = it.h * it.sc, bottom = HOR + EYE * it.sc;
    // se desvanece al final de la vista, y lo que está pegado a ti se vuelve transparente para no tapar todo
    ctx.globalAlpha = it.z > FAR - 300 ? (FAR - it.z) / 300 : it.z < 90 ? Math.max(0.3, (it.z - 15) / 75) : 1;
    if (it.spr === 'fire') drawCampfire(it.sx, bottom, it.sc, fogLevel(it.z));
    else {
      const img = it.spr.levels[fogLevel(it.z)], kx = w / it.spr.w, ky = h / it.spr.h;
      ctx.drawImage(img, it.sx - w / 2 - PAD * kx, bottom - h - PAD * ky, w + PAD * 2 * kx, h + PAD * 2 * ky);
    }
  }
  ctx.globalAlpha = 1;

  // Noche: todo se pone azul (sin oscurecer); la fogata brilla naranja
  if (sky.n > 0) {
    ctx.fillStyle = `rgba(35,65,170,${0.32 * sky.n})`;
    ctx.fillRect(0, 0, W, H);
  }
  const fp = project(CAMP.x, CAMP.y);
  if (fire.fuel > 0 && fp.z > 10 && fp.z < FAR) {
    const sc = FOC / fp.z, x = W / 2 + fp.xr / fp.z * FOC, y = HOR + EYE * sc - 20 * sc;
    const r = Math.min(W, (160 + fire.fuel) * sc * (1 + Math.sin(performance.now() / 90) * 0.04));
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r);
    gl.addColorStop(0, `rgba(255,160,60,${0.25 + 0.35 * sky.n})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (rain) { ctx.fillStyle = 'rgba(90,100,115,0.18)'; ctx.fillRect(0, 0, W, H); drawRain(); }
}

// Fogata de frente: piedras, leños y llamas que se mueven
function drawCampfire(x, bottom, sc, L) {
  ctx.save(); ctx.translate(x, bottom); ctx.scale(sc, sc);
  const stone = [['#7d7f7a', '#6a6c67'], ['#686a66', '#585a56'], ['#545753', '#474a46'], ['#444843', '#393d39']][L];
  for (let i = -3; i <= 3; i++) { ctx.fillStyle = stone[i & 1]; ctx.beginPath(); ctx.ellipse(i * 9, -4, 7, 6, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = ['#5a3a20', '#4d331e', '#402c1c', '#352619'][L]; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(14, -16); ctx.moveTo(18, -6); ctx.lineTo(-14, -16); ctx.stroke();
  if (fire.fuel > 0) {
    const t = performance.now() / 110, s = 0.55 + fire.fuel / 160;
    for (const [col, hgt, wd] of [['#d9401e', 46, 20], ['#f28a1d', 34, 14], ['#ffd34d', 20, 8]]) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(-wd, -10);
      ctx.quadraticCurveTo(-wd * 0.6 + Math.sin(t) * 3, -10 - hgt * s * 0.6, Math.sin(t * 1.7) * 5, -10 - hgt * s * (1 + Math.sin(t * 2.3) * 0.1));
      ctx.quadraticCurveTo(wd * 0.6 + Math.cos(t) * 3, -10 - hgt * s * 0.6, wd, -10);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStick(s) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
  ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(3, 0); ctx.lineTo(8, -6); ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function bar(x, y, w, label, v, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(x, y, w, 20, 6); ctx.fill();
  ctx.fillStyle = col; roundRect(x + 2, y + 2, Math.max(0, (w - 4) * v / 100), 16, 5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 8, y + 14);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(12, 12, 236, 122, 12); ctx.fill();
  const h = hour(), hh = Math.floor(h), mm = Math.floor((h % 1) * 60 / 10) * 10;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Día ${day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${isNight() ? '🌙' : '☀'}${rain ? ' 🌧' : ''}`, 24, 36);
  bar(24, 46, 212, 'Energía', energy, energy < 25 ? '#d9432f' : '#e0a23a');
  bar(24, 72, 212, 'Fogata', fire.fuel, fire.fuel < 25 ? '#d9432f' : '#e8692a');
  ctx.save(); ctx.translate(-2, -4); drawStick({ x: 36, y: 118, a: -0.3 }); ctx.restore();
  ctx.fillStyle = '#c4243a';
  for (const [dx, dy] of [[0, 0], [7, -3], [5, 5]]) { ctx.beginPath(); ctx.arc(140 + dx, 112 + dy, 3.5, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  ctx.fillText(`Leña: ${wood}/8`, 52, 119);
  ctx.fillText(`Bayas: ${food}/10`, 156, 119);
  // insignia de la categoría
  ctx.font = 'bold 13px sans-serif';
  const badge = `${cat.name} · ${cat.diff}`, bw = ctx.measureText(badge).width + 34;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(12, 140, bw, 24, 12); ctx.fill();
  ctx.fillStyle = cat.color; ctx.beginPath(); ctx.arc(26, 152, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(badge, 38, 157);

  // Brújula: arriba es hacia donde miras, así que las letras giran contigo; la aguja roja apunta hacia donde miras
  const cx = W - 84, cy = 84, R = 62, tg = target();
  const view = a => a - player.ang - Math.PI / 2; // dirección del mundo -> ángulo en la brújula
  ctx.fillStyle = '#d8cfb4'; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4efe0'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8e7a4a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [['N', -Math.PI / 2], ['S', Math.PI / 2], ['E', 0], ['O', Math.PI]].forEach(([l, wa]) => { const a = view(wa); ctx.fillStyle = l === 'N' ? '#c0392b' : '#333'; ctx.fillText(l, cx + Math.cos(a) * (R - 13), cy + Math.sin(a) * (R - 13)); });
  for (let i = 0; i < 16; i++) { const a = view(i / 16 * 6.283); ctx.strokeStyle = '#8e7a4a'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); ctx.lineTo(cx + Math.cos(a) * (R - (i % 4 ? 7 : 1)), cy + Math.sin(a) * (R - (i % 4 ? 7 : 1))); ctx.stroke(); }
  ctx.fillStyle = '#8e7a4a'; ctx.beginPath(); ctx.moveTo(cx, cy - R - 9); ctx.lineTo(cx - 6, cy - R - 1); ctx.lineTo(cx + 6, cy - R - 1); ctx.fill(); // marca de "al frente"
  const a = view(player.ang); // la aguja apunta hacia donde miras (siempre arriba); las letras giran debajo
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(R - 20, 0); ctx.lineTo(0, -6); ctx.lineTo(0, 6); ctx.fill();
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.moveTo(-(R - 26), 0); ctx.lineTo(0, -6); ctx.lineTo(0, 6); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px sans-serif';
  const pill = (text, y) => {
    const w = ctx.measureText(text).width + 20;
    // en celular van a la izquierda de la brújula (o abajo a la izquierda si está en vertical)
    const x = !isTouch ? Math.min(cx - w / 2, W - 12 - w) : H > W ? 12 : cx - R - 16 - w;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(x, y - 17, w, 24, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, x + w / 2, y);
  };
  if (isTouch) { // las banderas debajo de la brújula y las pistas a un lado, así no chocan con los botones
    ctx.fillStyle = '#fff';
    ctx.fillText(`Banderas: ${flags.filter(f => f.done).length}/${NUM_FLAGS}`, cx, cy + R + 24);
  }
  let py = !isTouch ? cy + R + 29 : H > W ? 196 : cy - R + 6;
  if (cat.hint === 'grados' || cat.hint === 'ruta') { pill('Rumbo: ' + bearingOfAngle(player.ang) + '°', py); py += 28; } // categorías que usan grados
  if (cat.hint === 'ruta') { pill('Pasos desde la fogata: ' + stepsFromCamp(), py); py += 28; }
  pill('Ve a: ' + tg.name, py); py += 28;
  if (tg.hint) { pill(tg.hint, py); py += 28; }
  ctx.fillStyle = '#fff';
  if (!isTouch) ctx.fillText(`Banderas: ${flags.filter(f => f.done).length}/${NUM_FLAGS}`, cx, py - 1);

  // Aviso de interacción
  const n = nearInteract();
  if (n) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(n.label).width + 20, x = W / 2, y = H * 0.68;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(x - w / 2, y - 18, w, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(n.label, x, y);
  }
  // Mensajes
  ctx.font = 'bold 17px sans-serif';
  toasts.forEach((t, i) => {
    const y = isTouch ? (H > W ? H * 0.42 : 100) + i * 36 :H - 40 - (toasts.length - 1 - i) * 36; // en celular arriba, para no tapar los botones
    ctx.globalAlpha = Math.min(1, t.t * 2);
    const w = ctx.measureText(t.text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(W / 2 - w / 2, y - 22, w, 32, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(t.text, W / 2, y);
    ctx.globalAlpha = 1;
  });
  if (isTouch) { // en celular: botones en vez de minimapa y lista de teclas
    if (state === 'play' && !mapOpen && !book) drawTouchControls();
    return;
  }
  ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'left';
  ctx.fillText(`${bindKey('adelante')}/${bindKey('atras')}: caminar · ${bindKey('izquierda')}/${bindKey('derecha')}: girar · mouse: mirar · ${bindKey('usar')}: usar · ${bindKey('comer')}: comer · ${bindKey('mapa')}: mapa${cat.hint === 'ruta' ? ` · ${bindKey('marcar')}: marcar · ${bindKey('libreta')}: libreta` : ''} · Esc: menú`, 14, H - 12);
  if (!mouseLocked() && !mapOpen && !book && state === 'play') {
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Haz clic para mirar con el mouse', W / 2, 30);
  }
  drawMinimap();
}

// Minimapa (abajo a la derecha). Como un mapa de papel: no marca dónde estás ni las banderas.
// Con M o con un clic se hace grande.
const miniRect = () => ({ x: W - MAP - 18, y: H - MAP - 18 });
function drawMinimap() {
  const { x: x0, y: y0 } = miniRect();
  ctx.fillStyle = '#d8cfb4'; roundRect(x0 - 6, y0 - 6, MAP + 12, MAP + 12, 10); ctx.fill();
  ctx.drawImage(miniCv, x0, y0);
  windRose(x0 + 20, y0 + 20, 15, false);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(x0 + MAP / 2 - 52, y0 + MAP - 22, 104, 18, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText('[M] agrandar', x0 + MAP / 2, y0 + MAP - 9);
}

// Rosa de los vientos (el norte del mapa siempre está arriba). Con letras solo si es grande.
function windRose(cx, cy, r, letters) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(244,239,224,0.85)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8e7a4a'; ctx.lineWidth = Math.max(1, r / 30); ctx.stroke();
  // puntas: primero las 4 diagonales cortas, luego las 4 principales encima
  const point = (ang, len, w, light, dark) => {
    ctx.save(); ctx.rotate(ang);
    ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(-w, 0); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + i * Math.PI / 2, r * 0.62, r * 0.14, '#cdbf98', '#8e7a4a');
  for (let i = 0; i < 4; i++) point(i * Math.PI / 2, r, r * 0.2, i === 0 ? '#e0584a' : '#efe6cc', i === 0 ? '#a52a1e' : '#5a4a2a');
  ctx.fillStyle = '#5a4a2a'; ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, r * 0.07), 0, 7); ctx.fill();
  if (letters) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${Math.round(r * 0.36)}px sans-serif`;
    const d = r + r * 0.28;
    [['N', 0, -d], ['S', 0, d], ['E', d, 0], ['O', -d, 0]].forEach(([l, x, y]) => {
      ctx.fillStyle = l === 'N' ? '#c0392b' : '#333'; ctx.fillText(l, x, y);
    });
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

// Mapa grande con los nombres de los lugares (el juego se pausa mientras lo ves)
let mapOpen = false;
function drawBigMap() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  const size = Math.min(W, H) - 110, x0 = (W - size) / 2, y0 = (H - size) / 2;
  ctx.fillStyle = '#d8cfb4'; roundRect(x0 - 10, y0 - 10, size + 20, size + 20, 14); ctx.fill();
  drawMapAt(x0, y0, size, true);
  windRose(x0 + 62, y0 + 62, 42, true);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('Mapa del bosque', W / 2, y0 - 20);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(isTouch ? 'Toca para cerrar' : 'M o clic para cerrar', W / 2, y0 + size + 32);
}

function drawRain() {
  ctx.strokeStyle = 'rgba(180,200,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 4, d.y - 18); }
  ctx.stroke();
}

function screen(title, lines) {
  ctx.fillStyle = 'rgba(10,20,10,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 46px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 70);
  ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 10 + i * 32));
}

// Camisa de uniforme vista de frente (para las tarjetas de categoría)
function drawUniform(x, y, k, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.beginPath(); // cuerpo y mangas
  ctx.moveTo(-22, -30); ctx.lineTo(-44, -18); ctx.lineTo(-36, 2); ctx.lineTo(-26, -4); ctx.lineTo(-26, 34);
  ctx.lineTo(26, 34); ctx.lineTo(26, -4); ctx.lineTo(36, 2); ctx.lineTo(44, -18); ctx.lineTo(22, -30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-2, -26, 4, 60); // botones / abertura
  ctx.fillRect(-20, -8, 12, 9); ctx.fillRect(8, -8, 12, 9); // bolsillos
  ctx.fillStyle = '#f2ead6'; // pañoleta
  ctx.beginPath(); ctx.moveTo(-22, -30); ctx.lineTo(22, -30); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8e6f40'; ctx.beginPath(); ctx.arc(0, -16, 4, 0, 7); ctx.fill(); // anillo
  ctx.restore();
}

// Pantalla de inicio: elegir la categoría (dificultad)
function drawTitle() {
  ctx.fillStyle = 'rgba(10,20,10,0.72)'; ctx.fillRect(0, 0, W, H);
  const s = Math.min(1, W / 920, H / 620);
  menuHits = [];
  const hit = (x, y, w, h, fn) => menuHits.push({ x: W / 2 + x * s, y: H / 2 + y * s, w: w * s, h: h * s, fn });
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 46px sans-serif'; ctx.fillText('Campamento Scout', 0, -235);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('Explora el bosque, encuentra las 5 banderas y mantén viva la fogata.', 0, -198);
  ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('Elige tu categoría', 0, -150);
  CATEGORIES.forEach((c, i) => {
    const x = -430 + i * 220, y = -125, w = 200, h = 270, sel = i === settings.cat;
    ctx.fillStyle = sel ? 'rgba(255,240,200,0.18)' : 'rgba(0,0,0,0.35)'; roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = sel ? c.color : 'rgba(255,255,255,0.15)'; ctx.lineWidth = sel ? 4 : 2; ctx.stroke();
    drawUniform(x + w / 2, y + 62, 1.1, c.color);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(c.name, x + w / 2, y + 132);
    ctx.fillStyle = c.color; ctx.font = 'bold 15px sans-serif'; ctx.fillText(c.diff, x + w / 2, y + 156);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '13px sans-serif';
    c.desc.forEach((l, j) => ctx.fillText(l, x + w / 2, y + 188 + j * 19));
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px sans-serif'; ctx.fillText(i + 1, x + 14, y + 20);
    hit(x, y, w, h, () => { if (sel) startGame(); else pickCategory(i); });
  });
  ctx.fillStyle = cat.color; roundRect(-110, 172, 220, 46, 12); ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('Empezar', 0, 202);
  hit(-110, 172, 220, 46, startGame);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px sans-serif';
  ctx.fillText(isTouch ? 'Toca una categoría para elegirla' : '← → o 1-4 para elegir · ENTER para empezar', 0, 245);
  ctx.restore();
}

// Menú de Esc: continuar, sensibilidad y controles (se maneja con el mouse)
function drawMenu() {
  ctx.fillStyle = 'rgba(8,16,12,0.78)'; ctx.fillRect(0, 0, W, H);
  const s = Math.min(1, H / 660, W / 700);
  menuHits = [];
  const hit = (x, y, w, h, fn, slider) => menuHits.push({ x: W / 2 + x * s, y: H / 2 + y * s, w: w * s, h: h * s, fn, slider });
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s);
  ctx.fillStyle = '#2a3a2c'; roundRect(-330, -310, 660, 620, 18); ctx.fill();
  ctx.strokeStyle = '#8e7a4a'; ctx.lineWidth = 3; ctx.stroke();

  const button = (x, y, w, h, text, fn, active, color) => {
    ctx.fillStyle = color || (active ? '#e0a23a' : '#4a5f45'); roundRect(x, y, w, h, 9); ctx.fill();
    ctx.fillStyle = active ? '#222' : '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 6);
    hit(x, y, w, h, fn);
  };
  const header = (text, y) => { ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(text, -300, y); };
  const slider = (label, y, key) => {
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, -300, y + 5);
    const bx = -60, bw = 300;
    ctx.fillStyle = '#1a241b'; roundRect(bx, y - 5, bw, 10, 5); ctx.fill();
    const v = settings[key], px = bx + (v - 1) / 9 * bw;
    ctx.fillStyle = '#e0a23a'; roundRect(bx, y - 5, px - bx, 10, 5); ctx.fill();
    ctx.beginPath(); ctx.arc(px, y, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(v, bx + bw + 22, y + 5);
    hit(bx - 12, y - 16, bw + 24, 32, mx => {
      settings[key] = clamp(Math.round(1 + ((mx - (W / 2 + bx * s)) / (bw * s)) * 9), 1, 10);
      saveSettings();
    }, true);
  };

  ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Menú', 0, -265);
  button(-230, -245, 220, 40, 'Continuar', () => { closeMenu(); lockMouse(); });
  button(10, -245, 220, 40, 'Salir al menú', () => { confirmExit = true; waitingBind = null; }, false, '#c0392b');

  header('Sensibilidad', -170);
  slider('Mouse', -138, 'sens');
  slider('Girar con teclado', -100, 'giro');
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Invertir arriba/abajo', -300, -57);
  button(-60, -78, 90, 30, settings.invert ? 'Sí' : 'No', () => { settings.invert = !settings.invert; saveSettings(); }, settings.invert);

  header('Controles', -10);
  ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right';
  ctx.fillText('Haz clic en una tecla y luego pulsa la nueva', 300, -10);
  Object.keys(DEFAULT_BINDS).forEach((a, i) => {
    const col = i < 6 ? -300 : 10, y = 8 + (i % 6) * 34;
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(BIND_NAMES[a], col, y + 20);
    const waiting = waitingBind === a;
    button(col + 180, y, 100, 30, waiting ? '...' : bindKey(a), () => { waitingBind = a; }, waiting);
  });
  button(-120, 222, 240, 36, 'Restablecer controles', () => { settings.binds = { ...DEFAULT_BINDS }; saveSettings(); });

  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(waitingBind ? 'Pulsa la tecla nueva (Esc para cancelar)' : 'Esc: volver al juego', 0, 280);

  if (confirmExit) { // ventanita para confirmar: tapa el resto del menú y solo deja estos dos botones
    menuHits = [];
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-W / s, -H / s, 2 * W / s, 2 * H / s);
    ctx.fillStyle = '#2a3a2c'; roundRect(-220, -95, 440, 190, 16); ctx.fill();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('¿Salir al menú?', 0, -45);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '15px sans-serif';
    ctx.fillText('Se perderá lo que llevas de esta partida.', 0, -12);
    button(-190, 25, 180, 44, 'Sí, salir', exitToTitle, false, '#c0392b');
    button(10, 25, 180, 44, 'Cancelar', () => { confirmExit = false; });
  }
  ctx.restore();
}

function draw() {
  if (state === 'title') {
    if (!player) { genWorld(20261101); player = { x: CAMP.x, y: CAMP.y + 90, ang: -1.57, pitch: 0, step: 0 }; fire = { fuel: 70 }; time = 0.1; rain = false; drops = []; }
    const t = performance.now() / 9000; // en el título la cámara da vueltas alrededor de la fogata, mirándola
    player.x = CAMP.x + Math.cos(t) * 190; player.y = CAMP.y + Math.sin(t) * 190; player.ang = t + Math.PI; player.pitch = 0;
    drawWorld();
    drawTitle();
    return;
  }
  drawWorld();
  drawHUD();
  if (mapOpen && state === 'play') drawBigMap();
  if (book && state === 'play') drawBook();
  const mins = Math.floor(playTime / 60), secs = Math.floor(playTime % 60);
  if (state === 'menu') drawMenu();
  if (state === 'win') screen('¡Insignia de Explorador!', [`Encontraste las ${NUM_FLAGS} banderas y volviste al campamento.`, `${cat.name} (${cat.diff}) · Días: ${day} · Tiempo: ${mins}:${String(secs).padStart(2, '0')}`, '', isTouch ? 'Toca la pantalla para volver' : 'ENTER: jugar otra vez · Esc: elegir otra categoría']);
  if (state === 'lose') screen('Te quedaste sin energía', ['Come bayas con [' + keyHint('comer') + '] y quédate cerca de la fogata en la noche.', '', isTouch ? 'Toca la pantalla para volver' : 'ENTER: intentarlo otra vez · Esc: elegir otra categoría']);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
