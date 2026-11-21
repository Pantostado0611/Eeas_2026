// Utilidades generales: constantes del juego, números al azar con semilla, colores, figuras y texto.
// (Versión web de scr_util del proyecto de GameMaker.)

const cv = document.getElementById('juego');
const ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize);
resize();

// ---------- Constantes ----------
const WORLD = 8000;        // tamaño del mundo
const DISENO = 4000;       // el bosque se diseñó en 4000 x 4000: las posiciones fijas se multiplican por ESC
const ESC = WORLD / DISENO;
const NUM_FLAGS = 5;
const STEP = 20;           // unidades del mundo por cada paso (Rover)
const CAMP_ZONE = 230;     // radio de la zona de acampado
const TOL_STEPS = 5;       // margen permitido al marcar en la libreta (pasos)
const TOL_DEG = 15;        // margen permitido al marcar en la libreta (grados)
// Modalidades: cuánto dura un día completo (en segundos reales)
const MODOS = [
  { name: 'Express', dia: 600, desc: 'Días de 10 minutos' },
  { name: 'Relajada', dia: 1200, desc: 'Días de 20 minutos' },
];
const dia_len = () => MODOS[settings.modo].dia;
const FOV = 1.6;           // ángulo de visión (radianes, ~92°)
const EYE = 55;            // altura de los ojos
const FAR = 1500;          // más allá de esto ya no se dibuja nada (niebla)
const PAD = 8;             // margen alrededor de cada dibujo 2D
const PI = Math.PI;

// ---------- mulberry32 (azar con semilla: la misma semilla arma el mismo bosque) ----------
function Mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rnd = null; // azar con semilla del mundo
const rr = (a, b) => a + rnd() * (b - a);

// ---------- Matemáticas ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pdist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const random = n => Math.random() * n;
const irandom = n => Math.floor(Math.random() * (n + 1));
const elegir = a => a[Math.floor(Math.random() * a.length)];
const mezclar = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// diferencia entre dos ángulos en grados (con signo, de -180 a 180)
const angle_difference = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const radtodeg = r => r * 180 / PI;
const ahora = () => performance.now();

// Rumbo en grados como en una brújula: 0° norte, 90° este, 180° sur, 270° oeste
const bearing_of_angle = ang => Math.round(((ang * 180 / PI + 90) % 360 + 360) % 360) % 360;
const bearing = (a, b) => bearing_of_angle(Math.atan2(b.y - a.y, b.x - a.x));
const ang_diff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// ---------- Colores ----------
// Se guardan como [r, g, b] cuando hay que mezclarlos; si no, como texto CSS
function hex_rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const mezclar_rgb = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const css = (v, a = 1) => a >= 1 ? `rgb(${v[0]},${v[1]},${v[2]})` : `rgba(${v[0]},${v[1]},${v[2]},${a})`;
// Un color con transparencia: hex o [r,g,b]
function rgba(col, a) { return css(typeof col === 'string' ? hex_rgb(col) : col, a); }

// ---------- Figuras ----------
// Polígono relleno a partir de un arreglo plano [x0, y0, x1, y1, ...]
function poligono(pts, col, alpha = 1) {
  if (pts.length < 6) return;
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.fill(); ctx.globalAlpha = 1;
}
// Línea gruesa con puntas redondas
function linea_redonda(x1, y1, x2, y2, ancho, col, g = ctx) {
  g.strokeStyle = col; g.lineWidth = ancho; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
// Círculo relleno
function blob(x, y, r, col, g = ctx) { if (r <= 0) return; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
function circulo(x, y, r, col, alpha, contorno, grosor = 1) {
  ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, 7);
  if (contorno) { ctx.strokeStyle = col; ctx.lineWidth = grosor; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); }
  ctx.globalAlpha = 1;
}
function camino_redondo(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Rectángulo con esquinas redondas, relleno
function rect_redondo(x, y, w, h, r, col, alpha = 1) {
  if (w <= 0 || h <= 0) return;
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  camino_redondo(ctx, x, y, w, h, r); ctx.fill(); ctx.globalAlpha = 1;
}
function rect(x, y, w, h, col, alpha = 1) { ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
// Rectángulo redondo con borde de color
function panel_borde(x, y, w, h, r, relleno, borde, grosor) {
  rect_redondo(x - grosor / 2, y - grosor / 2, w + grosor, h + grosor, r + grosor / 2, borde, 1);
  rect_redondo(x + grosor / 2, y + grosor / 2, w - grosor, h - grosor, Math.max(0, r - grosor / 2), relleno, 1);
}
// Solo el borde de un rectángulo redondo
function borde_redondo(x, y, w, h, r, col, alpha, grosor) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = grosor;
  camino_redondo(ctx, x, y, w, h, r); ctx.stroke(); ctx.globalAlpha = 1;
}

// ---------- Texto ----------
// Open Sans y Droid Sans Mono (incluidas en la carpeta fuentes, licencia libre).
// _y es la línea base del texto. _tipo: false/0 normal, true/1 negrita, 2 monoespaciada.
function fuente(px, tipo) {
  px = Math.max(6, Math.round(px));
  return tipo === 2 ? `${px}px "Droid Sans Mono", monospace` : `${tipo ? 'bold ' : ''}${px}px "Open Sans", sans-serif`;
}
function texto(x, y, str, px, tipo, halign, col, alpha = 1, g = ctx) {
  g.font = fuente(px, tipo); g.textAlign = halign; g.textBaseline = 'alphabetic';
  g.fillStyle = col; g.globalAlpha = alpha;
  g.fillText(str, x, y);
  g.globalAlpha = 1;
}
function texto_ancho(str, px, tipo) { ctx.font = fuente(px, tipo); return ctx.measureText(str).width; }
// Texto con borde claro alrededor (para los nombres del mapa)
function texto_borde(x, y, str, px, col, borde) {
  ctx.font = fuente(px, true); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.strokeStyle = borde; ctx.lineWidth = Math.max(2, px / 4);
  ctx.globalAlpha = 0.9; ctx.strokeText(str, x, y); ctx.globalAlpha = 1;
  ctx.fillStyle = col; ctx.fillText(str, x, y);
}
const dos = n => String(n).padStart(2, '0');
