// Dibujos 2D del bosque. Se pintan una sola vez al arrancar, con código (sin imágenes),
// en 4 niveles de lejanía: lo lejano se ve más oscuro y un poco borroso (niebla).

const NIEBLA = [0, 0.22, 0.42, 0.6];
// Pinta con pintar(g, w, h) y devuelve { levels: [4 canvas], w, h }.
function sprite_pintado(w, h, pintar) {
  const base = document.createElement('canvas');
  base.width = w + PAD * 2; base.height = h + PAD * 2;
  const b = base.getContext('2d');
  b.translate(PAD, PAD); pintar(b, w, h);
  const levels = [], blur = [0, 0.5, 1.4, 2.6];
  for (let L = 0; L < 4; L++) {
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    const g = c.getContext('2d');
    if (blur[L]) g.filter = `blur(${blur[L]}px)`;
    g.drawImage(base, 0, 0);
    g.filter = 'none';
    if (NIEBLA[L]) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(14,26,24,${NIEBLA[L]})`; g.fillRect(0, 0, c.width, c.height); }
    levels.push(c);
  }
  return { levels, w, h };
}
const tri = (g, x1, y1, x2, y2, x3, y3, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.fill(); };
const elipse = (g, x1, y1, x2, y2, col) => { g.fillStyle = col; g.beginPath(); g.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, 7); g.fill(); };
const caja = (g, x1, y1, x2, y2, col) => { g.fillStyle = col; g.fillRect(x1, y1, x2 - x1, y2 - y1); };
const caja_redonda = (g, x1, y1, x2, y2, r, col) => { g.fillStyle = col; camino_redondo(g, x1, y1, x2 - x1, y2 - y1, r); g.fill(); };

// ---------- Pinturas ----------
function pintar_roble(g, w, h, hue, light) {
  caja(g, w / 2 - w * 0.07, h * 0.45, w / 2 + w * 0.07, h, '#5a3d24');
  caja(g, w / 2, h * 0.45, w / 2 + w * 0.07, h, '#47301c');
  const cx = w / 2, cy = h * 0.34, r = w * 0.3;
  for (const [dx, dy, k] of [[-0.55, 0.25, 0.8], [0.55, 0.25, 0.8], [0, -0.35, 0.95], [-0.35, -0.1, 0.85], [0.4, -0.05, 0.85], [0, 0.3, 0.9]])
    blob(cx + dx * r * 1.2, cy + dy * r * 1.2, r * k, `hsl(${hue},40%,${light}%)`, g);
  for (const [dx, dy, k] of [[-0.3, -0.4, 0.5], [0.2, -0.55, 0.4], [-0.6, 0, 0.35]])
    blob(cx + dx * r, cy + dy * r, r * k, `hsl(${hue - 5},45%,${light + 8}%)`, g);
}
function pintar_pino(g, w, h, light) {
  caja(g, w / 2 - w * 0.06, h * 0.8, w / 2 + w * 0.06, h, '#4a3220');
  for (let i = 0; i < 4; i++) {
    const top = h * (0.02 + i * 0.19), bot = h * (0.36 + i * 0.16), half = w * (0.22 + i * 0.09);
    tri(g, w / 2, top, w / 2 + half, bot, w / 2 - half, bot, `hsl(145,35%,${light + i * 2}%)`);
    tri(g, w / 2, top, w / 2 - half, bot, w / 2 - half * 0.3, bot, `hsl(145,35%,${light + 7 + i * 2}%)`);
  }
}
function pintar_roca(g, w, h, seed) {
  g.fillStyle = '#6f716b'; g.beginPath(); g.moveTo(w / 2, h);
  for (let i = 0; i <= 8; i++) {
    const a = PI + i / 8 * PI, k = seed * 31 * (i + 1), r = 0.85 + (k - Math.floor(k)) * 0.15;
    g.lineTo(w / 2 + Math.cos(a) * w / 2 * r, h + Math.sin(a) * h * r);
  }
  g.fill();
  elipse(g, w * 0.4 - w * 0.22, h * 0.45 - h * 0.22, w * 0.4 + w * 0.22, h * 0.45 + h * 0.22, '#9a9c95');
}
function pintar_tienda(g, w, h, col) {
  tri(g, w / 2, 0, w, h, 0, h, col);
  tri(g, w / 2, 0, w, h, w / 2, h, 'rgba(0,0,0,0.2)');
  tri(g, w / 2, h * 0.35, w * 0.64, h, w * 0.36, h, '#2b2018');
}
function pintar_bandera(g, w, h, done, n) {
  caja(g, w * 0.15, 0, w * 0.23, h, '#6b4a2b');
  tri(g, w * 0.23, h * 0.03, w, h * 0.17, w * 0.23, h * 0.33, done ? '#3fae4a' : '#e0402c');
  g.font = fuente(h * 0.16, true); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(n, w * 0.5, h * 0.18);
}
function pintar_rama(g, w, h) {
  linea_redonda(2, h * 0.7, w - 2, h * 0.4, h * 0.6, '#6b4a2b', g);
  linea_redonda(w * 0.6, h * 0.5, w * 0.75, 0, h * 0.6, '#6b4a2b', g);
}
function pintar_mata(g, w, h, kind) {
  if (kind === 2) { // flor
    linea_redonda(w / 2, h, w / 2, h * 0.3, 2, '#3f6b2c', g);
    blob(w / 2, h * 0.3, w * 0.25, elegir(['#e8e3d0', '#e7c94a', '#c77dd6']), g);
    return;
  }
  for (let i = -2; i <= 2; i++) linea_redonda(w / 2 + i * w * 0.08, h, w / 2 + i * w * 0.2, h * (0.1 + Math.abs(i) * 0.15), 3, kind ? '#6a9a4a' : '#46703a', g);
}
// Perchero de madera con tres chalecos salvavidas
function pintar_chalecos(g, w, h) {
  caja(g, w * 0.05, h * 0.08, w * 0.12, h, '#6b4a2b');
  caja(g, w * 0.88, h * 0.08, w * 0.95, h, '#6b4a2b');
  caja(g, w * 0.03, h * 0.06, w * 0.97, h * 0.15, '#6b4a2b');
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.27 + i * 0.23), vw = w * 0.19;
    caja_redonda(g, cx - vw / 2, h * 0.17, cx + vw / 2, h * 0.66, 4, '#f07a1a');
    caja(g, cx - 1, h * 0.24, cx + 1, h * 0.66, '#2b2018');
    caja(g, cx - vw / 2, h * 0.44, cx + vw / 2, h * 0.49, '#e8e8e8');
  }
}
// Persona de la canoa de seguridad (con chaleco, gorra roja y remo)
function pintar_rescatista(g, w, h) {
  linea_redonda(w * 0.1, h * 0.95, w * 0.9, h * 0.22, 3, '#c9a36b', g);
  caja(g, w * 0.3, h * 0.62, w * 0.7, h, '#2e4a7a');
  caja_redonda(g, w * 0.2, h * 0.3, w * 0.8, h * 0.7, 4, '#f07a1a');
  caja(g, w * 0.2, h * 0.5, w * 0.8, h * 0.55, '#e8e8e8');
  blob(w * 0.5, h * 0.19, w * 0.17, '#d9a77a', g);
  caja(g, w * 0.3, h * 0.02, w * 0.7, h * 0.11, '#c0392b');
}
// Poste de madera con argolla (para la cuerda y el rapel)
function pintar_poste(g, w, h) {
  caja(g, w * 0.3, h * 0.08, w * 0.7, h, '#6b4a2b');
  caja(g, w * 0.5, h * 0.08, w * 0.7, h, '#4a321c');
  g.strokeStyle = '#c8ccd0'; g.lineWidth = 1.5; g.beginPath(); g.arc(w * 0.5, h * 0.14, w * 0.32, 0, 7); g.stroke();
  caja(g, w * 0.25, h * 0.3, w * 0.75, h * 0.38, '#e0b84a');
}
// Peña de la cascada (el agua que cae se dibuja encima, moviéndose)
function pintar_cascada(g, w, h) {
  const r1 = '#7f7a72', r2 = '#5f5a54', r3 = '#9a958c';
  blob(w * 0.2, h * 0.6, w * 0.22, r2, g); blob(w * 0.8, h * 0.6, w * 0.22, r2, g);
  blob(w * 0.28, h * 0.32, w * 0.2, r1, g); blob(w * 0.72, h * 0.32, w * 0.2, r1, g);
  caja(g, w * 0.06, h * 0.4, w * 0.94, h, r1);
  blob(w * 0.5, h * 0.16, w * 0.2, r3, g);
  caja(g, w * 0.4, h * 0.12, w * 0.6, h * 0.97, '#8fc3e0');
  caja(g, w * 0.46, h * 0.12, w * 0.54, h * 0.97, '#d8eef8');
  blob(w * 0.12, h * 0.88, w * 0.08, '#3f6b2c', g); blob(w * 0.9, h * 0.86, w * 0.07, '#3f6b2c', g);
}
// Coyote sentado aullando (de perfil, mirando a la derecha)
function pintar_coyote(g, w, h) {
  const c = '#8a6a48', o = '#6b5034', cl = '#c9b08a';
  tri(g, w * 0.08, h * 0.98, w * 0.3, h * 0.7, w * 0.36, h * 0.9, o);           // cola
  elipse(g, w * 0.22, h * 0.48, w * 0.62, h, c);                                // cuerpo
  tri(g, w * 0.42, h * 0.6, w * 0.62, h * 0.6, w * 0.62, h * 0.22, c);           // cuello
  elipse(g, w * 0.5, h * 0.12, w * 0.74, h * 0.32, c);                          // cabeza
  tri(g, w * 0.7, h * 0.12, w * 0.98, h * 0.0, w * 0.72, h * 0.26, c);           // hocico hacia arriba
  tri(g, w * 0.52, h * 0.16, w * 0.5, h * 0.0, w * 0.6, h * 0.12, o);            // oreja
  elipse(g, w * 0.5, h * 0.6, w * 0.62, h * 0.98, cl);                          // pecho
  caja(g, w * 0.5, h * 0.7, w * 0.56, h, o);                                    // pata
}

// Crea todos los dibujos del juego
const sprs = {};
let ridge = [], stars = [];
function sprites_crear() {
  sprs.oak = [0, 1, 2].map(i => sprite_pintado(150, 230, (g, w, h) => pintar_roble(g, w, h, 95 + i * 12, 26 + i * 5)));
  sprs.pine = [0, 1, 2].map(i => sprite_pintado(110, 260, (g, w, h) => pintar_pino(g, w, h, 17 + i * 4)));
  sprs.giant = sprite_pintado(300, 460, (g, w, h) => pintar_roble(g, w, h, 100, 24));
  sprs.rock = [0.13, 0.57].map(s => sprite_pintado(110, 70, (g, w, h) => pintar_roca(g, w, h, s)));
  sprs.tent = ['#d9813b', '#3b7bd9', '#c9b13a'].map(c => sprite_pintado(120, 80, (g, w, h) => pintar_tienda(g, w, h, c)));
  sprs.flag = [false, true].map(d => [1, 2, 3, 4, 5].map(n => sprite_pintado(60, 140, (g, w, h) => pintar_bandera(g, w, h, d, n))));
  sprs.stick = sprite_pintado(40, 12, pintar_rama);
  sprs.tuft = [0, 1, 2].map(k => sprite_pintado(24, 22, (g, w, h) => pintar_mata(g, w, h, k)));
  sprs.chalecos = sprite_pintado(90, 80, pintar_chalecos);
  sprs.rescatista = sprite_pintado(50, 80, pintar_rescatista);
  sprs.poste = sprite_pintado(16, 50, pintar_poste);
  sprs.coyote = sprite_pintado(50, 46, pintar_coyote);
  sprs.cascada = sprite_pintado(260, 230, pintar_cascada);
  comedor_sprites();

  // Bosque lejano en el horizonte: dos capas que giran contigo (la de atrás más oscura y borrosa)
  ridge = [0, 1].map(layer => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 160;
    const g = c.getContext('2d'), r = Mulberry32(77 + layer);
    if (layer === 1) g.filter = 'blur(2px)';
    g.fillStyle = layer ? '#24382f' : '#1d3026';
    for (let x = -40; x < c.width + 40; x += 18 + r() * 22) {
      const hh = (layer ? 50 : 80) + r() * (layer ? 40 : 70), ww = 26 + r() * 24;
      g.beginPath(); g.moveTo(x, c.height - hh); g.lineTo(x + ww / 2, c.height); g.lineTo(x - ww / 2, c.height); g.fill();
      if (r() < 0.5) { g.beginPath(); g.arc(x, c.height - hh * 0.6, ww * 0.6, 0, 7); g.fill(); }
    }
    g.fillRect(0, c.height - 20, c.width, 20);
    return c;
  });
  // Estrellas (cada una con su propia semilla)
  stars = Array.from({ length: 140 }, (_, i) => { const r = Mulberry32(900 + i); return { a: r() * PI * 2, y: r() * 0.9, s: r() < 0.15 ? 2 : 1 }; });
}
