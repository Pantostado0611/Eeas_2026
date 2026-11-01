// Campamento Scout — exploración + supervivencia ligera, vista cenital (desde arriba)

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

let rnd, trees, rocks, bushes, sticks, lakes, flags, tents, decos, solids;

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
  const blocked = [...keep, ...lakes];

  // Tiendas del campamento
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.9;
    tents.push({ x: CAMP.x + Math.cos(a) * 150, y: CAMP.y + Math.sin(a) * 150, r: 34, ang: a, color: ['#d9813b', '#3b7bd9', '#c9b13a'][i] });
  }

  // Árboles
  for (let tries = 0; trees.length < 950 && tries < 6000; tries++) {
    const t = { x: R(40, WORLD - 40), y: R(40, WORLD - 40), r: 14, canopy: R(38, 66), pine: rnd() < 0.45, shade: rnd() };
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

  solids = [...trees, ...rocks, ...lakes, ...tents, { x: CAMP.x, y: CAMP.y, r: 26 }];
}

function placeStick() {
  for (let tries = 0; tries < 50; tries++) {
    const s = { x: 60 + Math.random() * (WORLD - 120), y: 60 + Math.random() * (WORLD - 120), a: Math.random() * 6.28, r: 8 };
    if (player && Math.hypot(s.x - player.x, s.y - player.y) < 500) continue;
    if (free(s.x, s.y, 10, lakes, 0) && free(s.x, s.y, 10, rocks, 0) && free(s.x, s.y, 4, trees, 0)) { sticks.push(s); return; }
  }
}

// ---------- Estado ----------
const DAY_LEN = 240; // segundos por día completo
let state = 'title';
let player, fire, time, day, energy, wood, food, rain, rainTimer, nextRain, playTime;
let toasts = [], drops = [];

function startGame() {
  player = null;
  genWorld(20261101);
  player = { x: CAMP.x, y: CAMP.y + 90, ang: -Math.PI / 2, step: 0, moving: false };
  fire = { fuel: 70 };
  time = 0.05; day = 1;
  energy = 100; wood = 0; food = 0;
  rain = false; rainTimer = 0; nextRain = 70 + Math.random() * 60;
  toasts = []; playTime = 0; drops = [];
  state = 'play';
  toast('Encuentra las 5 banderas con la brújula. ¡No dejes que se apague la fogata!', 6);
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
  const f = flags.find(f => !f.done);
  return f ? { x: f.x, y: f.y, name: 'Bandera ' + f.n } : { x: CAMP.x, y: CAMP.y, name: 'Campamento' };
}

// ---------- Entrada ----------
const keys = {};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys[k] = true;
  if (k === 'enter' && state !== 'play') startGame();
  if (state === 'play') {
    if (k === 'e') interact();
    if (k === 'f') eat();
    if (k === 'p') state = 'pause';
  } else if (state === 'pause' && k === 'p') state = 'play';
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') state = 'pause'; });

function nearInteract() {
  if (dist(player, CAMP) < 80) return { kind: 'fire', label: wood > 0 ? '[E] Echar leña' : 'Necesitas leña' };
  for (const b of bushes) if (b.berries > 0 && dist(player, b) < b.r + 30) return { kind: 'bush', obj: b, label: '[E] Recoger bayas' };
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
  if (state !== 'play') return;
  playTime += dt;

  // Tiempo y días
  time += dt / DAY_LEN;
  if (time >= 1) { time -= 1; day++; toast('☀ Amanece el día ' + day); }

  // Clima
  if (rain) {
    rainTimer -= dt;
    if (rainTimer <= 0) { rain = false; nextRain = 90 + Math.random() * 120; toast('Dejó de llover.'); }
  } else {
    nextRain -= dt;
    if (nextRain <= 0) { rain = true; rainTimer = 30 + Math.random() * 35; toast('🌧 Empezó a llover: el fuego se gasta más rápido.', 4); }
  }

  // Movimiento
  let mx = 0, my = 0;
  if (keys['a'] || keys['arrowleft']) mx--;
  if (keys['d'] || keys['arrowright']) mx++;
  if (keys['w'] || keys['arrowup']) my--;
  if (keys['s'] || keys['arrowdown']) my++;
  const running = keys['shift'];
  player.moving = mx || my;
  if (player.moving) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;
    const sp = (running ? 260 : 160) * (energy < 15 ? 0.6 : 1);
    player.x += mx * sp * dt; player.y += my * sp * dt;
    let da = Math.atan2(my, mx) - player.ang;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    player.ang += da * Math.min(1, dt * 14);
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
  for (const f of flags) {
    if (!f.done && dist(player, f) < 55) {
      f.done = true;
      const left = flags.filter(f => !f.done).length;
      toast(left ? '🚩 ¡Bandera ' + f.n + ' encontrada! Faltan ' + left + '.' : '🚩 ¡Todas las banderas! Regresa al campamento.', 4);
    }
  }
  if (flags.every(f => f.done) && dist(player, CAMP) < 120) { state = 'win'; return; }

  // Fogata
  if (fire.fuel > 0) {
    fire.fuel -= dt * (rain ? 1.1 : 0.55);
    if (fire.fuel <= 0) { fire.fuel = 0; toast('🔥 ¡Se apagó la fogata! Trae leña para prenderla.', 4); }
  }

  // Energía (hambre + frío)
  const cold = isNight() && (fire.fuel <= 0 || dist(player, CAMP) > 320);
  let drain = 0.3;
  if (running && player.moving) drain *= 1.8;
  if (cold) drain *= 1.6;
  if (rain) drain *= 1.15;
  energy -= dt * drain;
  if (cold && Math.random() < dt / 20) toast('Tienes frío... acércate a la fogata.');
  if (energy <= 25 && energy + dt * drain > 25) toast('Tienes mucha hambre. Come algo con [F].', 4);
  if (energy <= 0) { energy = 0; state = 'lose'; }

  // Gotas de lluvia
  if (rain) for (let i = 0; i < 6; i++) drops.push({ x: Math.random() * W, y: -10, v: 700 + Math.random() * 300, l: 1 });
  for (const d of drops) { d.y += d.v * dt; d.x -= d.v * dt * 0.15; }
  drops = drops.filter(d => d.y < H + 20);
}

// ---------- Dibujo ----------
let cam = { x: 0, y: 0 };
const onScreen = (x, y, r) => x + r > cam.x && x - r < cam.x + W && y + r > cam.y && y - r < cam.y + H;

function drawGround() {
  ctx.fillStyle = '#4f7a3a';
  ctx.fillRect(0, 0, W, H);
  // Borde del mundo
  ctx.fillStyle = '#2a3f20';
  if (cam.x < 0) ctx.fillRect(0, 0, -cam.x, H);
  if (cam.y < 0) ctx.fillRect(0, 0, W, -cam.y);
  if (cam.x + W > WORLD) ctx.fillRect(WORLD - cam.x, 0, W, H);
  if (cam.y + H > WORLD) ctx.fillRect(0, WORLD - cam.y, W, H);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Claro del campamento
  ctx.fillStyle = '#8a7a52';
  ctx.beginPath(); ctx.ellipse(CAMP.x, CAMP.y, 230, 210, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9c8a5e';
  ctx.beginPath(); ctx.ellipse(CAMP.x, CAMP.y, 150, 135, 0, 0, 7); ctx.fill();
  for (const d of decos) {
    if (!onScreen(d.x, d.y, 10)) continue;
    if (Math.hypot(d.x - CAMP.x, d.y - CAMP.y) < 220) continue;
    if (d.k === 0 || d.k === 1) { // pasto
      ctx.strokeStyle = d.k ? '#5f8c45' : '#41682f'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(d.x + i * 3, d.y); ctx.lineTo(d.x + i * 5, d.y - 7); }
      ctx.stroke();
    } else if (d.k === 2) { // flor
      ctx.fillStyle = ['#e8e3d0', '#e7c94a', '#c77dd6'][Math.floor(d.a) % 3];
      ctx.beginPath(); ctx.arc(d.x, d.y, 2.5, 0, 7); ctx.fill();
    } else { // hoja seca
      ctx.fillStyle = '#7a6a3a';
      ctx.beginPath(); ctx.ellipse(d.x, d.y, 4, 2, d.a, 0, 7); ctx.fill();
    }
  }
  // Lagos
  for (const l of lakes) {
    if (!onScreen(l.x, l.y, l.r + 20)) continue;
    ctx.fillStyle = '#8f8259';
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r + 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f6f9a';
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f86b3';
    ctx.beginPath(); ctx.arc(l.x - l.r * 0.15, l.y - l.r * 0.15, l.r * 0.7, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    const w = performance.now() / 900;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(l.x + Math.cos(i * 2.1) * l.r * 0.4, l.y + Math.sin(i * 2.1) * l.r * 0.4, 10 + (w + i) % 1 * 16, 0.3, 2.6); ctx.stroke();
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

function drawRock(k) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(k.x + 4, k.y + 5, k.r, k.r * 0.85, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7d7f7a';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.283, rr = k.r * (0.85 + ((k.seed * 97 * (i + 1)) % 1) * 0.25);
    ctx.lineTo(k.x + Math.cos(a) * rr, k.y + Math.sin(a) * rr);
  }
  ctx.fill();
  ctx.fillStyle = '#a3a59e';
  ctx.beginPath(); ctx.arc(k.x - k.r * 0.25, k.y - k.r * 0.25, k.r * 0.45, 0, 7); ctx.fill();
}

function drawBush(b) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(b.x + 4, b.y + 5, b.r, 0, 7); ctx.fill();
  ctx.fillStyle = '#2f6b2a';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(b.x + Math.cos(i * 1.26) * 10, b.y + Math.sin(i * 1.26) * 10, 13, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#3f8a35';
  ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#c4243a';
  for (let i = 0; i < b.berries * 3; i++) {
    const a = i * 2.4; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * (6 + i % 3 * 5), b.y + Math.sin(a) * (6 + i % 3 * 5), 3, 0, 7); ctx.fill();
  }
}

function drawTent(t) {
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-28, -34, 62, 74);
  ctx.fillStyle = t.color; ctx.fillRect(-30, -38, 60, 72);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, -38, 30, 72); // lado en sombra
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 34); ctx.stroke(); // cumbrera
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(-10, 34); ctx.lineTo(10, 34); ctx.lineTo(0, 22); ctx.fill(); // entrada
  ctx.restore();
}

function drawFire() {
  const { x, y } = CAMP;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
  for (let i = 0; i < 10; i++) { // piedras
    const a = i / 10 * 6.283;
    ctx.fillStyle = i % 2 ? '#8a8c86' : '#6f716b';
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 24, y + Math.sin(a) * 24, 6, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#2b2118'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill();
  ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15); ctx.lineTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.stroke(); }
  if (fire.fuel > 0) {
    const t = performance.now() / 120, s = 0.5 + fire.fuel / 200;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 70 * s);
    g.addColorStop(0, 'rgba(255,170,60,0.45)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 70 * s, 0, 7); ctx.fill();
    const layers = [['#d9401e', 14], ['#f28a1d', 10], ['#ffd34d', 6]];
    for (const [c, r] of layers) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x + Math.sin(t + r) * 2, y + Math.cos(t * 1.3 + r) * 2, r * s * (1 + Math.sin(t * 2 + r) * 0.12), 0, 7); ctx.fill();
    }
  }
}

function drawFlag(f) {
  ctx.fillStyle = f.done ? 'rgba(120,200,110,0.35)' : 'rgba(255,240,180,0.25)';
  ctx.beginPath(); ctx.arc(f.x, f.y, 40, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(f.x + 3, f.y + 4, 6, 0, 7); ctx.fill();
  const wave = Math.sin(performance.now() / 200 + f.n) * 4;
  ctx.fillStyle = f.done ? '#3fae4a' : '#e0402c';
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + 34, f.y - 8 + wave); ctx.lineTo(f.x + 4, f.y - 20); ctx.fill();
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(f.n, f.x + 16, f.y - 6 + wave / 2);
}

// El scout visto desde arriba: sombrero de ala ancha, hombros, mochila y pañoleta
function drawPlayer() {
  const p = player;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(4, 6, 20, 18, 0, 0, 7); ctx.fill();
  ctx.rotate(p.ang); // 0 = mirando a la derecha
  const sw = p.moving ? Math.sin(p.step) * 6 : 0;
  // brazos/manos
  ctx.fillStyle = '#e0b48a';
  ctx.beginPath(); ctx.arc(sw, -17, 4.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-sw, 17, 4.5, 0, 7); ctx.fill();
  // mochila
  ctx.fillStyle = '#3d5a2a'; roundRect(-19, -10, 11, 20, 4); ctx.fill();
  ctx.fillStyle = '#2c4220'; ctx.fillRect(-19, -2, 11, 3);
  // hombros (camisa)
  ctx.fillStyle = '#b89a5c'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 16, 0, 0, 7); ctx.fill();
  // pañoleta (triángulo hacia la espalda)
  ctx.fillStyle = '#c4243a'; ctx.beginPath(); ctx.moveTo(-1, -7); ctx.lineTo(-1, 7); ctx.lineTo(-11, 0); ctx.fill();
  // sombrero
  ctx.fillStyle = '#c8a26a'; ctx.beginPath(); ctx.arc(1, 0, 13, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8e6f40'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.arc(1, 0, 8, 0, 7); ctx.fill(); // cinta
  ctx.fillStyle = '#b48f58'; ctx.beginPath(); ctx.arc(1, 0, 6.5, 0, 7); ctx.fill(); // copa
  ctx.strokeStyle = '#8e6f40'; ctx.lineWidth = 1.2; // pliegues de la copa
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(6, 0); ctx.moveTo(1, -5); ctx.lineTo(1, 5); ctx.stroke();
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawTreeTop(t) {
  const under = Math.hypot(player.x - t.x, player.y - t.y) < t.canopy;
  ctx.globalAlpha = under ? 0.4 : 1;
  const c = t.canopy, sh = t.shade;
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(t.x + 10, t.y + 12, c, 0, 7); ctx.fill();
  if (t.pine) {
    const layers = [[1, `hsl(140,35%,${18 + sh * 5}%)`], [0.72, `hsl(140,35%,${24 + sh * 5}%)`], [0.45, `hsl(138,35%,${31 + sh * 5}%)`]];
    for (const [k, col] of layers) {
      ctx.fillStyle = col; ctx.beginPath();
      const n = 9, r = c * k;
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.283 + sh * 3; const rr = i % 2 ? r * 0.72 : r; ctx.lineTo(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr); }
      ctx.fill();
    }
  } else {
    ctx.fillStyle = `hsl(${95 + sh * 20},40%,${24 + sh * 6}%)`;
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + sh * 5; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * c * 0.45, t.y + Math.sin(a) * c * 0.45, c * 0.58, 0, 7); ctx.fill(); }
    ctx.fillStyle = `hsl(${95 + sh * 20},42%,${32 + sh * 6}%)`;
    ctx.beginPath(); ctx.arc(t.x - c * 0.18, t.y - c * 0.18, c * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = `hsl(${90 + sh * 20},45%,${40 + sh * 6}%)`;
    ctx.beginPath(); ctx.arc(t.x - c * 0.3, t.y - c * 0.3, c * 0.25, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const darkCv = document.createElement('canvas');
const dctx = darkCv.getContext('2d');
function drawNight() {
  const d = darkness() + (rain ? 0.12 : 0);
  if (d <= 0.01) return;
  if (darkCv.width !== W || darkCv.height !== H) { darkCv.width = W; darkCv.height = H; }
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, W, H);
  dctx.fillStyle = `rgba(8,12,35,${Math.min(0.92, d)})`;
  dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    const g = dctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill();
  };
  hole(player.x - cam.x, player.y - cam.y, 150);
  if (fire.fuel > 0) hole(CAMP.x - cam.x, CAMP.y - cam.y, 120 + fire.fuel * 2.2 + Math.sin(performance.now() / 90) * 6);
  ctx.drawImage(darkCv, 0, 0);
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

  // Brújula (el norte siempre arriba; la aguja roja apunta al objetivo)
  const cx = W - 84, cy = 84, R = 62, tg = target();
  ctx.fillStyle = '#d8cfb4'; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4efe0'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8e7a4a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['O', -1, 0]].forEach(([l, dx, dy]) => { ctx.fillStyle = l === 'N' ? '#c0392b' : '#333'; ctx.fillText(l, cx + dx * (R - 13), cy + dy * (R - 13)); });
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; ctx.strokeStyle = '#8e7a4a'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); ctx.lineTo(cx + Math.cos(a) * (R - (i % 4 ? 7 : 1)), cy + Math.sin(a) * (R - (i % 4 ? 7 : 1))); ctx.stroke(); }
  const a = Math.atan2(tg.y - player.y, tg.x - player.x);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(R - 20, 0); ctx.lineTo(0, -6); ctx.lineTo(0, 6); ctx.fill();
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.moveTo(-(R - 26), 0); ctx.lineTo(0, -6); ctx.lineTo(0, 6); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(cx - 74, cy + R + 12, 148, 24, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${tg.name} · ${Math.round(dist(player, tg) / 10)} m`, cx, cy + R + 29);
  ctx.fillText(`Banderas: ${flags.filter(f => f.done).length}/${NUM_FLAGS}`, cx, cy + R + 52);

  // Aviso de interacción
  const n = nearInteract();
  if (n) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(n.label).width + 20, x = player.x - cam.x, y = player.y - cam.y - 46;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(x - w / 2, y - 18, w, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(n.label, x, y);
  }
  // Mensajes
  ctx.font = 'bold 17px sans-serif';
  toasts.forEach((t, i) => {
    const y = H - 40 - (toasts.length - 1 - i) * 36;
    ctx.globalAlpha = Math.min(1, t.t * 2);
    const w = ctx.measureText(t.text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(W / 2 - w / 2, y - 22, w, 32, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(t.text, W / 2, y);
    ctx.globalAlpha = 1;
  });
  ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'left';
  ctx.fillText('WASD/flechas: caminar · Shift: correr · E: usar · F: comer · P: pausa', 14, H - 12);
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

function drawWorld() {
  cam.x = player.x - W / 2; cam.y = player.y - H / 2;
  drawGround();
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  for (const s of sticks) if (onScreen(s.x, s.y, 14)) drawStick(s);
  for (const k of rocks) if (onScreen(k.x, k.y, k.r + 8)) drawRock(k);
  for (const b of bushes) if (onScreen(b.x, b.y, 30)) drawBush(b);
  for (const f of flags) if (onScreen(f.x, f.y, 50)) drawFlag(f);
  for (const t of tents) if (onScreen(t.x, t.y, 50)) drawTent(t);
  drawFire();
  for (const t of trees) if (onScreen(t.x, t.y, 20)) { ctx.fillStyle = '#4a3220'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill(); }
  drawPlayer();
  for (const t of trees) if (onScreen(t.x, t.y, t.canopy + 14)) drawTreeTop(t);
  ctx.restore();
  drawNight();
  if (rain) drawRain();
}

function draw() {
  if (state === 'title') {
    if (!player) { genWorld(20261101); player = { x: CAMP.x, y: CAMP.y + 90, ang: -1.57, step: 0 }; fire = { fuel: 70 }; time = 0.1; rain = false; drops = []; }
    player.x = CAMP.x + Math.cos(performance.now() / 9000) * 300; player.y = CAMP.y + Math.sin(performance.now() / 9000) * 300;
    drawWorld();
    screen('Campamento Scout', ['Explora el bosque, encuentra las 5 banderas', 'y mantén viva la fogata del campamento.', '', 'Pulsa ENTER para empezar']);
    return;
  }
  drawWorld();
  drawHUD();
  const mins = Math.floor(playTime / 60), secs = Math.floor(playTime % 60);
  if (state === 'pause') screen('Pausa', ['Pulsa P para seguir']);
  if (state === 'win') screen('¡Insignia de Explorador!', [`Encontraste las ${NUM_FLAGS} banderas y volviste al campamento.`, `Días: ${day} · Tiempo: ${mins}:${String(secs).padStart(2, '0')}`, '', 'Pulsa ENTER para jugar otra vez']);
  if (state === 'lose') screen('Te quedaste sin energía', ['Come bayas con [F] y quédate cerca de la fogata en la noche.', '', 'Pulsa ENTER para intentarlo otra vez']);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
