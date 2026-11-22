// Comedor (inspirado en el de Camp Perry): edificio de ladrillo al sur del campamento, con techo de lámina
// y un porche de madera atrás. Se entra caminando por la puerta. Adentro: ventanillas (Charolas, Comida,
// Agua y raciones, Devolución), mesas largas, chimenea con flor de lis, mecedoras y lámparas.
// Hay horarios de comida (ver el pasaporte). Fuera de horario solo te dan algo chico.
// Regla scout: antes de salir dejas tu charola en Devolución.

const COMIDAS = [
  { name: 'Desayuno', ini: 7.5, fin: 9.5, menu: 'huevos con frijoles, pan y chocolate' },
  { name: 'Comida', ini: 13.5, fin: 15.5, menu: 'arroz, pollo con verduras y agua de jamaica' },
  { name: 'Cena', ini: 19.5, fin: 21.5, menu: 'molletes, fruta y leche' },
];
const ENERGIA_COMIDA = 60, ENERGIA_SNACK = 15, ENERGIA_AGUA = 5, ENERGIA_RACION = 25;
const RACIONES_MAX = 3;  // raciones que caben en la mochila
const SNACK_CADA = 3;    // horas del juego entre un snack y otro

// Estado (se reinicia en comedor_reiniciar)
let charola = 0;        // 0 sin charola, 1 vacía, 2 con comida, 3 con comida y agua, 4 sucia (ya comiste)
let servido = null;     // lo que te sirvieron: { tipo: 'comida' | 'snack', i, raciones }
let comidas_hechas = new Set(); // 'día-i': esa comida ya te la sirvieron
let comidas_comidas = new Set(); // 'día-i': y ya te la comiste
let snack_hora = -99;   // hora (contando los días) del último snack
let comiendo = null;    // { t, dur }: sentado comiendo (el juego no te deja moverte)
let comida_avisada = '', comedor_aviso_t = -1e9;
let adentro = false;    // estás dentro del comedor (se dibuja el salón en vez del bosque)

function comedor_reiniciar() {
  charola = 0; servido = null; comidas_hechas = new Set(); comidas_comidas = new Set(); snack_hora = -99; comiendo = null;
  comida_avisada = ''; comedor_aviso_t = -1e9; adentro = false;
}

// ---------- Horarios ----------
const horas_abs = () => (day - 1) * 24 + time * 24; // horas desde que empezó la partida (siempre avanza)
// Comida que se está sirviendo ahorita (índice) o -1
function comida_actual() { const h = hora(); return COMIDAS.findIndex(c => h >= c.ini && h < c.fin); }
const clave_comida = i => day + '-' + i;
const dia_visible = () => day + (hora() < 6 ? 1 : 0); // el día del calendario (después de medianoche ya es el siguiente)
const hora_txt = h => Math.floor(h) + ':' + dos(Math.round((h % 1) * 60));
// "La comida es a las 13:30." (la que sigue)
function siguiente_comida_texto() {
  const h = hora();
  const c = COMIDAS.find(c => c.ini > h) || COMIDAS[0];
  return 'Vuelve a la hora ' + (c.name === 'Comida' ? 'de la comida' : c.name === 'Cena' ? 'de la cena' : 'del desayuno') + ' (' + hora_txt(c.ini) + ').';
}

// ---------- Forma del edificio ----------
// Mide 900 x 540 y la puerta mira al norte (hacia el campamento); el porche mira al Río de las Ranas,
// junto al Muelle del Pescador. Adentro, la pared de la cocina está en x1 - 100.
function comedor_crear() {
  const cx = camp.x - 275, cy = camp.y + 1240, W2 = 450, D2 = 270;
  const c = comedor = {
    x: cx, y: cy, x0: cx - W2, x1: cx + W2, y0: cy - D2, y1: cy + D2,
    alto: 140, techo: 210, puerta: 50, puerta_alto: 100, porche: 130, xk: cx + 350, puerta_sur: [cx - 50, cx + 50],
    radio: Math.hypot(W2, D2 + 130), fuera: [], dentro_paredes: [], dentro_cosas: [],
    ventanillas: [], mesas: [], muros: [], mecedoras: [], lamparas: [],
  };
  const { x0, x1, y0, y1, alto, techo, xk } = c;
  // Ventanillas en la pared de la cocina (de la puerta hacia el fondo)
  [['devolucion', 'Devolución', -190], ['charolas', 'Charolas', -90], ['comida', 'Comida', 10], ['agua', 'Agua y raciones', 110]]
    .forEach(([tipo, name, v], i) => c.ventanillas.push({ tipo, name, y: cy + v, x: xk - 60, idx: i }));
  // Mesas largas con bancas (3 filas de 3; pasillo en medio desde la puerta y otro frente a las ventanillas)
  for (const mv of [-150, 0, 150]) for (const mu of [-290, -130, 110]) c.mesas.push({ x: cx + mu, y: cy + mv, hw: 65, hd: 20 });
  // Mecedoras frente a la chimenea y lámparas colgando
  c.mecedoras = [{ x: x0 + 48, y: cy - 75 }, { x: x0 + 48, y: cy + 75 }];
  for (const mu of [-290, -130, 110]) for (const mv of [-75, 75]) c.lamparas.push({ x: cx + mu, y: cy + mv });

  // Muros para chocar (rectángulos [x0, y0, x1, y1]); la puerta es un hueco en la pared norte
  const g = 6;
  const [sa, sb] = c.puerta_sur;
  c.muros.push([x0, y0 - g, cx - c.puerta, y0 + g], [cx + c.puerta, y0 - g, x1, y0 + g], // norte (con la puerta)
    [x0, y1 - g, sa, y1 + g], [sb, y1 - g, x1, y1 + g],                                // sur (con la puerta al porche)
    [x0 - g, y0, x0 + g, y1], [x1 - g, y0, x1 + g, y1],                                // oeste, este
    [xk - 30, y0, xk + g, y1],                                                         // pared de la cocina (con su repisa)
    [x0, cy - 70, x0 + 30, cy + 70]);                                                  // chimenea
  for (const m of c.mesas) c.muros.push([m.x - m.hw, m.y - m.hd - 22, m.x + m.hw, m.y + m.hd + 22]); // mesa y bancas
  for (const mu of PORCHE_MESAS) { const mx = cx + mu, my = y1 + 66; c.muros.push([mx - 45, my - 32, mx + 45, my + 32]); } // mesas del porche
  comedor_caras_crear();
}
// Camino de tierra de la fogata a la puerta del comedor: [x0, y0, x1, y1]
const comedor_camino_ext = () => [camp.x, camp.y + 215, comedor.x, comedor.y0];
// Círculos a lo largo del camino (para que no salgan árboles, piedras ni lagos encima)
function comedor_camino() {
  const [ax, ay, bx, by] = comedor_camino_ext(), n = Math.ceil(pdist(ax, ay, bx, by) / 80), res = [];
  for (let i = 0; i <= n; i++) res.push({ x: ax + (bx - ax) * i / n, y: ay + (by - ay) * i / n, r: 50 });
  return res;
}
const PORCHE_MESAS = [-360, -200, 160, 340]; // mesas rojas del porche (x desde el centro): libre frente a la puerta
const comedor_zona = () => comedor ? [{ x: comedor.x, y: comedor.y + comedor.porche / 2, r: comedor.radio + 20 }] : [];
// Postes del porche (se chocan como los árboles)
function comedor_postes() {
  const c = comedor, res = [];
  for (let k = 0; k < 8; k++) res.push({ x: c.x0 + 20 + k * (c.x1 - c.x0 - 40) / 7, y: c.y1 + c.porche, r: 8 }); // dos quedan a los lados de la puerta
  return res;
}
// ¿(x, y) está dentro del salón?
const en_comedor = (x, y) => comedor && x > comedor.x0 && x < comedor.x1 && y > comedor.y0 && y < comedor.y1;
// ¿El edificio tapa la línea de (x1, y1) a (x2, y2)? (para que el brillo de la fogata no se vea a través de él)
function comedor_tapa(x1, y1, x2, y2) {
  if (!comedor) return false;
  let t0 = 0, t1 = 1;
  for (const [p, q, a, b] of [[x1, x2 - x1, comedor.x0, comedor.x1], [y1, y2 - y1, comedor.y0, comedor.y1]]) {
    if (Math.abs(q) < 1e-9) { if (p < a || p > b) return false; continue; }
    let ta = (a - p) / q, tb = (b - p) / q;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

// ---------- Caras 3D (paredes, techo, mesas...) ----------
// p: puntos [x, y, h, ...] (convexo); col: [r,g,b] o función que lo da; n: hacia dónde mira (null = de los dos lados)
function cara(lista, p, col, n, sesgo = 0) {
  const N = p.length / 3; let cx = 0, cy = 0, ch = 0, xa = Infinity, ya = Infinity, xb = -Infinity, yb = -Infinity;
  for (let i = 0; i < N; i++) {
    const x = p[i * 3], y = p[i * 3 + 1]; cx += x; cy += y; ch += p[i * 3 + 2];
    xa = Math.min(xa, x); xb = Math.max(xb, x); ya = Math.min(ya, y); yb = Math.max(yb, y);
  }
  const o = { p, col: typeof col === 'string' ? hex_rgb(col) : col, n, cx: cx / N, cy: cy / N, ch: ch / N, sesgo, hijos: [], bb: [xa, ya, xb, yb] };
  lista.push(o);
  return o;
}
// Lo pintado encima de una cara (ventanas, letreros...) va en sus "hijos": se dibujan justo después de ella, en orden
// Pared derecha en y (mira hacia ny), de xa a xb y de altura ha a hb
const pared_y = (l, y, xa, xb, ha, hb, col, ny, s = 0) => cara(l, [xa, y, ha, xb, y, ha, xb, y, hb, xa, y, hb], col, [0, ny, 0], s);
const pared_x = (l, x, ya, yb, ha, hb, col, nx, s = 0) => cara(l, [x, ya, ha, x, yb, ha, x, yb, hb, x, ya, hb], col, [nx, 0, 0], s);
const oscuro = (hex, k) => mezclar_rgb([0, 0, 0], hex_rgb(hex), k);
// Caja (mesa, banca, chimenea...): caras de arriba y de los lados
function caja3(l, xa, ya, xb, yb, ha, hb, arriba, lado) {
  return {
    top: cara(l, [xa, ya, hb, xb, ya, hb, xb, yb, hb, xa, yb, hb], arriba, [0, 0, 1]),
    n: pared_y(l, ya, xa, xb, ha, hb, oscuro(lado, 0.85), -1), s: pared_y(l, yb, xa, xb, ha, hb, lado, 1),
    w: pared_x(l, xa, ya, yb, ha, hb, oscuro(lado, 0.75), -1), e: pared_x(l, xb, ya, yb, ha, hb, oscuro(lado, 0.92), 1),
  };
}
// Polígono pintado sobre una pared en x (puntos [y, h, ...] relativos a (yc, hc))
function pintado_x(l, x, yc, hc, pts, col, nx, s) {
  const p = [];
  for (let i = 0; i < pts.length; i += 2) p.push(x, yc + pts[i], hc + pts[i + 1]);
  cara(l, p, col, [nx, 0, 0], s);
}
// Flor de lis pintada en una pared en x
function flor_de_lis_x(l, x, yc, hc, k, col, nx, s) {
  const f = pts => pts.map(v => v * k);
  pintado_x(l, x, yc, hc, f([0, 34, -9, 12, 0, -6, 9, 12]), col, nx, s);                 // pétalo de en medio
  pintado_x(l, x, yc, hc, f([-6, 4, -14, 18, -26, 20, -30, 6, -20, -6, -8, -4]), col, nx, s); // pétalo izquierdo
  pintado_x(l, x, yc, hc, f([6, 4, 8, -4, 20, -6, 30, 6, 26, 20, 14, 18]), col, nx, s);      // pétalo derecho
  pintado_x(l, x, yc, hc, f([-17, -6, 17, -6, 17, -12, -17, -12]), col, nx, s);         // banda
  pintado_x(l, x, yc, hc, f([-4, -12, 4, -12, 3, -26, -3, -26]), col, nx, s);           // pie
}

// Ventanas iluminadas que se vieron en este cuadro (de noche): se pintan otra vez encima del azul de la noche
let comedor_brillos = [];
function comedor_brillos_dibujar(n) {
  if (!comedor_brillos.length) return;
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,185,80,${0.55 * n})`; ctx.beginPath();
  for (const q of comedor_brillos) {
    if (q.length < 6) continue;
    ctx.moveTo(q[0], q[1]);
    for (let i = 2; i < q.length; i += 2) ctx.lineTo(q[i], q[i + 1]);
    ctx.closePath();
  }
  ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  comedor_brillos = [];
}

// Colores que cambian con la hora (vidrios de día y de noche)
const vidrio_fuera = () => es_noche() ? hex_rgb('#ffdc8a') : hex_rgb('#2d4a5e');   // de noche se ve la luz de adentro
const vidrio_dentro = () => es_noche() ? hex_rgb('#1f2b55') : hex_rgb('#a9cfe6');  // de adentro se ve el cielo
const puerta_dentro = () => es_noche() ? hex_rgb('#24345e') : hex_rgb('#cfe6c0');  // por la puerta se ve afuera

// ---------- Texturas (se dibujan como "hijos" de su cara) ----------
// Rectángulo sobre una pared: eje 'y' = pared en y = pos (u va en x); eje 'x' = pared en x = pos (u va en y)
const rect3 = (eje, pos, ua, ub, ha, hb) => eje === 'y' ? [ua, pos, ha, ub, pos, ha, ub, pos, hb, ua, pos, hb] : [pos, ua, ha, pos, ub, ha, pos, ub, hb, pos, ua, hb];
// Muchos pedazos del mismo color en un solo dibujo (juntas, tablas, plafones...)
function multi(l, polys, col) {
  if (!polys.length) return null;
  const o = cara(l, polys[0], col, null);
  o.multi = polys;
  return o;
}
// Hileras de ladrillo: juntas claras y algunos ladrillos más oscuros
function ladrillos(l, eje, pos, ua, ub, ha, hb, base) {
  const CH = 8, BW = 21, juntas = [], oscuros = [];
  let k = 0;
  for (let h = ha; h < hb - 0.1; h += CH, k++) {
    const h2 = Math.min(hb, h + CH);
    juntas.push(rect3(eje, pos, ua, ub, h2 - 1.1, h2));
    let j = 0;
    for (let u = ua + (k % 2 ? BW / 2 : 0); u < ub; u += BW, j++) {
      if (u > ua + 0.5) juntas.push(rect3(eje, pos, u - 0.6, u + 0.6, h, h2 - 1.1));
      if ((k * 7 + j * 13) % 6 === 0) oscuros.push(rect3(eje, pos, Math.max(ua, u + 0.6), Math.min(ub, u + BW - 0.6), h, h2 - 1.1));
    }
  }
  const o = multi(l, oscuros, oscuro(base, 0.86)), j = multi(l, juntas, '#d9cbb3');
  if (o) o.detalle = 1; if (j) j.detalle = 1; // de lejos no se dibujan (se ve igual y es más rápido)
}
// Líneas horizontales dentro del triángulo del techo (pared en x): de alto a techo, centrado en yc con medio ancho D2
function lineas_triangulo(l, x, yc, D2, alto, techo, paso, col) {
  const polys = [];
  for (let h = alto + paso; h < techo - 2; h += paso) { const m = (techo - h) / (techo - alto) * D2; polys.push(rect3('x', x, yc - m, yc + m, h - 1, h)); }
  multi(l, polys, col);
}
// Ventana con marco, vidrio y su cruz
function ventana(l, eje, pos, ua, ub, ha, hb, vidrio, marco) {
  cara(l, rect3(eje, pos, ua - 3, ub + 3, ha - 3, hb + 3), marco, null);
  const v = cara(l, rect3(eje, pos, ua, ub, ha, hb), vidrio, null);
  if (vidrio === vidrio_fuera) v.brilla = true;
  const um = (ua + ub) / 2, hm = ha + (hb - ha) * 0.55;
  multi(l, [rect3(eje, pos, um - 1.2, um + 1.2, ha, hb), rect3(eje, pos, ua, ub, hm - 1.2, hm + 1.2)], marco);
}
// Punto sobre la pendiente del techo: fracción t de (ya, alto) a (cy, techo)
const en_techo = (x, ya, cy, alto, techo, t, baja) => [x, ya + (cy - ya) * t, alto + (techo - alto) * t - baja];

function comedor_caras_crear() {
  const c = comedor, { x0, x1, y0, y1, alto, techo, xk } = c, cx = c.x, cy = c.y, P = c.puerta, PA = c.puerta_alto, D2 = cy - y0;
  const VA = 32, VB = 80; // altura de las ventanas: de 32 a 80 (como de 0.9 a 2.3 m)
  // ventanas (entre las columnas de adentro); las de la cocina solo se ven por fuera
  const v_norte = [[cx - 432, cx - 328], [cx - 292, cx - 188], [cx - 150, cx - 80], [cx + 108, cx + 202], [cx + 238, cx + 332]];
  const v_sur = [[cx - 432, cx - 328], [cx - 292, cx - 188], [cx - 150, cx - 80], [cx + 108, cx + 202], [cx + 238, cx + 332]];
  const [pa, pb] = c.puerta_sur;                          // puerta al porche
  const v_cocina = [cx + 372, cx + 430];
  const v_oeste = [[cy - 215, cy - 120], [cy + 120, cy + 215]];
  const columnas = [cx - 310, cx - 170, cx + 90, cx + 220]; // columnas verdes (y vigas del techo)

  // ----- Por fuera -----
  const F = c.fuera, lad = '#a8714a', lad_s = '#b8805a', lad_l = '#9c6a46', lam = '#8e9499', lam2 = '#7d8388', marco = '#4a3a2a';
  const nIzq = pared_y(F, y0, x0, cx - P, 0, alto, lad, -1), nDer = pared_y(F, y0, cx + P, x1, 0, alto, lad, -1);
  const nArr = pared_y(F, y0, cx - P, cx + P, PA, alto, lad, -1);
  ladrillos(nIzq.hijos, 'y', y0, x0, cx - P, 0, alto, lad); ladrillos(nDer.hijos, 'y', y0, cx + P, x1, 0, alto, lad);
  ladrillos(nArr.hijos, 'y', y0, cx - P, cx + P, PA, alto, lad);
  cara(nIzq.hijos, rect3('y', y0, cx - P - 4, cx + P + 4, 0, PA + 4), marco, null);
  cara(nDer.hijos, rect3('y', y0, cx + P, cx + P + 4, 0, PA + 4), marco, null); // el lado derecho del marco va sobre la otra pared
  cara(nIzq.hijos, rect3('y', y0, cx - P, cx + P, 0, PA), '#d8c9a8', null); // la puerta abierta: se ve la luz de adentro
  for (const [a, b] of v_norte) ventana(a < cx ? nIzq.hijos : nDer.hijos, 'y', y0, a, b, VA, VB, vidrio_fuera, marco);
  ventana(nDer.hijos, 'y', y0, v_cocina[0], v_cocina[1], VA, VB, vidrio_fuera, marco);
  const sIzq = pared_y(F, y1, x0, pa, 0, alto, lad_s, 1), sDer = pared_y(F, y1, pb, x1, 0, alto, lad_s, 1);
  const sArr = pared_y(F, y1, pa, pb, PA, alto, lad_s, 1);
  ladrillos(sIzq.hijos, 'y', y1, x0, pa, 0, alto, lad_s); ladrillos(sDer.hijos, 'y', y1, pb, x1, 0, alto, lad_s);
  ladrillos(sArr.hijos, 'y', y1, pa, pb, PA, alto, lad_s);
  cara(sIzq.hijos, rect3('y', y1, pa - 4, pb + 4, 0, PA + 4), marco, null);
  cara(sDer.hijos, rect3('y', y1, pb, pb + 4, 0, PA + 4), marco, null);
  cara(sIzq.hijos, rect3('y', y1, pa, pb, 0, PA), '#d8c9a8', null); // la puerta abierta: se ve la luz de adentro
  for (const [a, b] of v_sur) ventana(a < pa ? sIzq.hijos : sDer.hijos, 'y', y1, a, b, VA, VB, vidrio_fuera, marco);
  ventana(sDer.hijos, 'y', y1, v_cocina[0], v_cocina[1], VA, VB, vidrio_fuera, marco);
  // paredes de los lados con el triángulo del techo (dos aguas): ladrillo abajo y tablas arriba
  const oeste = cara(F, [x0, y0, 0, x0, y1, 0, x0, y1, alto, x0, cy, techo, x0, y0, alto], lad_l, [-1, 0, 0]);
  const este = cara(F, [x1, y0, 0, x1, y1, 0, x1, y1, alto, x1, cy, techo, x1, y0, alto], lad_l, [1, 0, 0]);
  for (const [w, x] of [[oeste, x0], [este, x1]]) {
    ladrillos(w.hijos, 'x', x, y0, y1, 0, alto, lad_l);
    cara(w.hijos, [x, y0, alto, x, y1, alto, x, cy, techo], '#8a7a62', null);
    lineas_triangulo(w.hijos, x, cy, D2, alto, techo, 8, '#6f6250');
  }
  for (const [a, b] of v_oeste) ventana(oeste.hijos, 'x', x0, a, b, VA, VB, vidrio_fuera, marco);
  ventana(este.hijos, 'x', x1, cy + 60, cy + 170, VA, VB, vidrio_fuera, marco);
  // techo de lámina (sale un poquito de las paredes) con sus canales y la tira de vidrio de arriba
  const e = 18;
  const tn = cara(F, [x0 - e, y0 - e, alto - 6, x1 + e, y0 - e, alto - 6, x1 + e, cy, techo, x0 - e, cy, techo], lam, [0, -(techo - alto + 6), cy - y0 + e]);
  const ts = cara(F, [x0 - e, y1 + e, alto - 6, x1 + e, y1 + e, alto - 6, x1 + e, cy, techo, x0 - e, cy, techo], lam2, [0, techo - alto + 6, cy - y0 + e]);
  for (const [t, ya, col] of [[tn, y0 - e, '#767c81'], [ts, y1 + e, '#686e73']]) {
    const r = [];
    for (let x = x0 - e + 14; x < x1 + e; x += 22) r.push([x - 1.5, ya, alto - 6, x + 1.5, ya, alto - 6, x + 1.5, cy, techo, x - 1.5, cy, techo]);
    multi(t.hijos, r, col);
  }
  cara(tn.hijos, [x0 + 120, cy - 30, techo - 9, x1 - 120, cy - 30, techo - 9, x1 - 120, cy - 4, techo - 1, x0 + 120, cy - 4, techo - 1], vidrio_fuera, null);
  // porche: techo de madera (con sus tablas por abajo) y mesas de picnic rojas
  const py = y1 + c.porche, ph = alto - 14;
  const pt = cara(F, [x0, y1, ph, x1, y1, ph, x1, py, ph - 6, x0, py, ph - 6], () => ojo > ph ? hex_rgb('#8e9499') : hex_rgb('#c79a5e'), null);
  const tablas = [];
  for (let x = x0 + 16; x < x1; x += 16) tablas.push([x - 0.8, y1, ph, x + 0.8, y1, ph, x + 0.8, py, ph - 6, x - 0.8, py, ph - 6]);
  multi(pt.hijos, tablas, () => ojo > ph ? hex_rgb('#7d8388') : hex_rgb('#a57a48'));
  for (const mu of PORCHE_MESAS) {
    const mx = cx + mu, my = y1 + 66;
    caja3(F, mx - 45, my - 14, mx + 45, my + 14, 26, 31, '#9a2a2a', '#7a2020');
    caja3(F, mx - 45, my - 32, mx + 45, my - 24, 15, 18, '#9a2a2a', '#7a2020');
    caja3(F, mx - 45, my + 24, mx + 45, my + 32, 15, 18, '#9a2a2a', '#7a2020');
  }

  // ----- Por dentro: paredes, piso y techo (con lo pintado encima) -----
  const D = c.dentro_paredes, crema = '#e6dfcf', crema2 = '#ddd5c3', madera = '#b98a5a', lambrin = '#9a6a3e', verde = '#4c5a3c', marco_d = '#3f4a33';
  const LB = 28; // alto del lambrín
  // lambrín con sus tablas en una pared (de ua a ub)
  const lambrin_en = (l, eje, pos, ua, ub) => {
    cara(l, rect3(eje, pos, ua, ub, 0, LB), lambrin, null);
    const r = [rect3(eje, pos, ua, ub, LB - 2, LB)];
    for (let u = ua + 14; u < ub; u += 14) r.push(rect3(eje, pos, u - 0.6, u + 0.6, 0, LB - 2));
    multi(l, r, '#7a5230');
  };
  const columnas_en = (l, eje, pos, us) => multi(l, us.map(u => rect3(eje, pos, u - 5, u + 5, 0, alto)), verde);
  const ni = pared_y(D, y0, x0, cx - P, 0, alto, crema, 1), nd = pared_y(D, y0, cx + P, xk, 0, alto, crema, 1);
  pared_y(D, y0, cx - P, cx + P, PA, alto, crema, 1);
  // por la puerta se ve afuera: cielo arriba y pasto abajo
  pared_y(D, y0, cx - P, cx + P, EYE, PA, puerta_dentro, 1); pared_y(D, y0, cx - P, cx + P, 0, EYE, () => es_noche() ? hex_rgb('#1c3320') : hex_rgb('#6f9a52'), 1);
  lambrin_en(ni.hijos, 'y', y0, x0, cx - P); lambrin_en(nd.hijos, 'y', y0, cx + P, xk);
  for (const [a, b] of v_norte) ventana(a < cx ? ni.hijos : nd.hijos, 'y', y0, a, b, VA, VB, vidrio_dentro, marco_d);
  columnas_en(ni.hijos, 'y', y0, columnas.filter(u => u < cx - P)); columnas_en(nd.hijos, 'y', y0, columnas.filter(u => u > cx + P));
  const si = pared_y(D, y1, x0, pa, 0, alto, crema2, -1), sd = pared_y(D, y1, pb, xk, 0, alto, crema2, -1);
  pared_y(D, y1, pa, pb, PA, alto, crema2, -1);
  // por la puerta del porche se ve afuera: cielo arriba y el piso del porche abajo
  pared_y(D, y1, pa, pb, EYE, PA, puerta_dentro, -1); pared_y(D, y1, pa, pb, 0, EYE, () => es_noche() ? hex_rgb('#2a2f3a') : hex_rgb('#c9c2b2'), -1);
  lambrin_en(si.hijos, 'y', y1, x0, pa); lambrin_en(sd.hijos, 'y', y1, pb, xk);
  for (const [a, b] of v_sur) ventana(a < pa ? si.hijos : sd.hijos, 'y', y1, a, b, VA, VB, vidrio_dentro, marco_d);
  columnas_en(si.hijos, 'y', y1, columnas.filter(u => u < pa)); columnas_en(sd.hijos, 'y', y1, columnas.filter(u => u > pb));
  const dw = cara(D, [x0, y0, 0, x0, y1, 0, x0, y1, alto, x0, cy, techo, x0, y0, alto], crema2, [1, 0, 0]);
  lambrin_en(dw.hijos, 'x', x0, y0, y1);
  for (const [a, b] of v_oeste) ventana(dw.hijos, 'x', x0, a, b, VA, VB, vidrio_dentro, marco_d);
  columnas_en(dw.hijos, 'x', x0, [cy - 235, cy - 95, cy + 95, cy + 235]);
  // piso de concreto pulido con sus juntas
  const piso = cara(D, [x0, y0, 0, xk, y0, 0, xk, y1, 0, x0, y1, 0], '#cfc9bd', [0, 0, 1]);
  const juntas = [];
  for (let x = x0 + 100; x < xk; x += 100) juntas.push([x - 0.8, y0, 0, x + 0.8, y0, 0, x + 0.8, y1, 0, x - 0.8, y1, 0]);
  for (let y = y0 + 95; y < y1; y += 95) juntas.push([x0, y - 0.8, 0, xk, y - 0.8, 0, xk, y + 0.8, 0, x0, y + 0.8, 0]);
  multi(piso.hijos, juntas, '#b9b2a4');
  // pared de la cocina (de madera, con tablas) con las ventanillas: hueco iluminado, letrero de color y el cocinero
  const dk = cara(D, [xk, y0, 0, xk, y1, 0, xk, y1, alto, xk, cy, techo, xk, y0, alto], madera, [-1, 0, 0]);
  const tk = [];
  for (let h = 10; h < alto; h += 10) tk.push(rect3('x', xk, y0, y1, h - 0.7, h + 0.7));
  multi(dk.hijos, tk, '#9a6f45');
  lineas_triangulo(dk.hijos, xk, cy, D2, alto, techo, 10, '#9a6f45');
  const colores = ['#8a5a30', '#3b7bd9', '#3fae4a', '#d9813b'];
  for (const v of c.ventanillas) {
    pared_x(dk.hijos, xk - 1, v.y - 32, v.y + 32, 40, 100, '#5a3d24', -1);                   // marco
    pared_x(dk.hijos, xk - 1, v.y - 28, v.y + 28, 44, 96, '#f5ebc8', -1);                    // hueco (cocina iluminada)
    pared_x(dk.hijos, xk - 1.5, v.y - 30, v.y + 30, 102, 114, colores[v.idx], -1);           // letrero de color
    if (v.tipo !== 'devolucion') {
      pintado_x(dk.hijos, xk - 2, v.y, 0, [-14, 44, 14, 44, 14, 72, 7, 76, -7, 76, -14, 72], '#f4f4f4', -1); // filipina blanca
      pintado_x(dk.hijos, xk - 2.2, v.y, 0, [-9, 44, 9, 44, 9, 66, -9, 66], '#d8dde2', -1);          // mandil
      pintado_x(dk.hijos, xk - 2.2, v.y, 0, [-20, 52, -14, 50, -14, 70, -20, 66], '#e8e8e8', -1);    // brazos
      pintado_x(dk.hijos, xk - 2.2, v.y, 0, [14, 50, 20, 52, 20, 66, 14, 70], '#e8e8e8', -1);
      pintado_x(dk.hijos, xk - 2.2, v.y, 0, [-22, 50, -17, 50, -17, 55, -22, 55], '#d9a77a', -1);    // manos
      pintado_x(dk.hijos, xk - 2.2, v.y, 0, [17, 50, 22, 50, 22, 55, 17, 55], '#d9a77a', -1);
      pintado_x(dk.hijos, xk - 2, v.y, 84, [-8, -4, -6, 6, 0, 9, 6, 6, 8, -4, 4, -9, -4, -9], '#d9a77a', -1); // cara
      pintado_x(dk.hijos, xk - 2.3, v.y, 84, [-4.5, 1, -2.5, 1, -2.5, 3.5, -4.5, 3.5], '#2a1f16', -1); // ojos
      pintado_x(dk.hijos, xk - 2.3, v.y, 84, [2.5, 1, 4.5, 1, 4.5, 3.5, 2.5, 3.5], '#2a1f16', -1);
      pintado_x(dk.hijos, xk - 2.3, v.y, 84, [-3.5, -4, 3.5, -4, 2, -6, -2, -6], '#a0463a', -1);     // sonrisa
      pintado_x(dk.hijos, xk - 2.5, v.y, 0, [-8, 91, 8, 91, 8, 96, -8, 96], '#ffffff', -1);          // gorro
      pintado_x(dk.hijos, xk - 2.5, v.y, 0, [-11, 96, 11, 96, 12, 103, 6, 107, -6, 107, -12, 103], '#ffffff', -1);
    } else for (let k = 0; k < 4; k++) pintado_x(dk.hijos, xk - 2, v.y, 46 + k * 4, [-16, 0, 16, 0, 16, 3, -16, 3], '#8e9499', -1); // charolas apiladas
  }
  // techo inclinado de madera con plafones blancos y vigas verdes de lado a lado
  const techo_m = '#b38a5a';
  const tN = cara(D, [x0, y0, alto, xk, y0, alto, xk, cy, techo, x0, cy, techo], techo_m, [0, techo - alto, -(cy - y0)]);
  const tS = cara(D, [x0, y1, alto, xk, y1, alto, xk, cy, techo, x0, cy, techo], oscuro(techo_m, 0.94), [0, -(techo - alto), -(cy - y0)]);
  const bordes = [x0, ...columnas, xk];
  for (const [t, ya] of [[tN, y0], [tS, y1]]) {
    const plafones = [];
    for (let i = 0; i < bordes.length - 1; i++) {
      const a = bordes[i] + 12, b = bordes[i + 1] - 12;
      for (const [t0, t1] of [[0.08, 0.46], [0.54, 0.92]]) {
        const p0 = en_techo(a, ya, cy, alto, techo, t0, 1), p1 = en_techo(b, ya, cy, alto, techo, t0, 1);
        const p2 = en_techo(b, ya, cy, alto, techo, t1, 1), p3 = en_techo(a, ya, cy, alto, techo, t1, 1);
        plafones.push([...p0, ...p1, ...p2, ...p3]);
      }
    }
    multi(t.hijos, plafones, '#f2efe6');
    multi(t.hijos, columnas.map(u => [u - 6, ya, alto - 1.5, u + 6, ya, alto - 1.5, u + 6, cy, techo - 1.5, u - 6, cy, techo - 1.5]), verde);
  }

  // ----- Por dentro: cosas del salón -----
  const K = c.dentro_cosas, ladrillo = '#b07a52';
  // chimenea de ladrillo con la flor de lis (pared oeste)
  const ch = caja3(K, x0, cy - 70, x0 + 28, cy + 70, 0, 190, ladrillo, ladrillo);
  ladrillos(ch.e.hijos, 'x', x0 + 28, cy - 70, cy + 70, 0, 190, ladrillo);
  pared_x(ch.e.hijos, x0 + 28.5, cy - 26, cy + 26, 0, 40, '#2a1f16', 1);       // hueco del fuego
  pared_x(ch.e.hijos, x0 + 29, cy - 30, cy + 30, 40, 46, '#8c867a', 1);        // repisa
  flor_de_lis_x(ch.e.hijos, x0 + 29, cy, 108, 1, '#2a1f16', 1, 0);
  // repisa de las ventanillas (de acero)
  caja3(K, xk - 30, y0 + 4, xk, y1 - 4, 38, 43, '#c8ccd0', '#8e9499');
  // mesas (con sus tablas) y bancas
  for (const m of c.mesas) {
    const mt = caja3(K, m.x - m.hw, m.y - m.hd, m.x + m.hw, m.y + m.hd, 32, 38, '#c49464', '#8a5a30');
    multi(mt.top.hijos, [-7, 7].map(d => [m.x - m.hw, m.y + d - 0.6, 38, m.x + m.hw, m.y + d - 0.6, 38, m.x + m.hw, m.y + d + 0.6, 38, m.x - m.hw, m.y + d + 0.6, 38]), '#a5784c');
    for (const s of [-1, 1]) caja3(K, m.x - m.hw + 4, m.y + s * (m.hd + 15) - 7, m.x + m.hw - 4, m.y + s * (m.hd + 15) + 7, 18, 22, '#a8774a', '#6b4a2b');
    for (const s of [-1, 1]) caja3(K, m.x + s * (m.hw - 10) - 3, m.y - m.hd + 3, m.x + s * (m.hw - 10) + 3, m.y + m.hd - 3, 0, 32, '#6b4a2b', '#5a3d24'); // patas
  }
}

// ---------- Chocar con el edificio ----------
// Empuja al jugador (círculo de radio PR) fuera de un rectángulo
function empujar_rect(r, PR) {
  const qx = clamp(player.x, r[0], r[2]), qy = clamp(player.y, r[1], r[3]);
  const dx = player.x - qx, dy = player.y - qy, d = Math.hypot(dx, dy);
  if (d >= PR) return;
  if (d > 0.001) { player.x = qx + dx / d * PR; player.y = qy + dy / d * PR; return; }
  // el centro quedó adentro del rectángulo: sale por el lado más cercano
  const op = [[player.x - r[0] + PR, -1, 0], [r[2] - player.x + PR, 1, 0], [player.y - r[1] + PR, 0, -1], [r[3] - player.y + PR, 0, 1]];
  op.sort((a, b) => a[0] - b[0]);
  player.x += op[0][1] * op[0][0]; player.y += op[0][2] * op[0][0];
}
function comedor_chocar(PR) {
  if (!comedor || pdist(player.x, player.y, comedor.x, comedor.y) > comedor.radio + 60) return;
  const c = comedor, estaba = adentro;
  c.muros.forEach((r, i) => empujar_rect(r, i < 7 ? PR + 10 : PR)); // los primeros 7 son paredes
  // con charola no se sale: regla del comedor
  const sale_n = player.y < c.y0 + PR + 4, sale_s = player.y > c.y1 - PR - 4;
  if (estaba && charola > 0 && (sale_n || sale_s)) {
    player.y = sale_n ? c.y0 + PR + 4 : c.y1 - PR - 4;
    if (ahora() - comedor_aviso_t > 2500) {
      comedor_aviso_t = ahora();
      toast(charola === 2 || charola === 3 ? '¡Todavía no comes! Siéntate en una mesa con ' + tecla_entre_corchetes('usar') + '.'
        : 'Antes de salir deja tu charola en Devolución. ¡Deja el lugar mejor de como lo encontraste!', 4);
    }
  }
  for (const m of c.mecedoras) { const d = dist(player, m), mm = 14 + PR; if (d < mm && d > 0.001) { player.x = m.x + (player.x - m.x) / d * mm; player.y = m.y + (player.y - m.y) / d * mm; } }
  adentro = en_comedor(player.x, player.y);
}

// ---------- Cada cuadro ----------
function comedor_actualizar(dt) {
  if (!comedor) return;
  adentro = en_comedor(player.x, player.y);
  // aviso cuando empieza una comida
  const i = comida_actual();
  if (i >= 0 && fire.lit && comida_avisada !== clave_comida(i)) {
    comida_avisada = clave_comida(i);
    if (!comidas_hechas.has(clave_comida(i))) toast('¡Suena la campana! Ya está ' + (i === 1 ? 'la comida' : i === 2 ? 'la cena' : 'el desayuno') + ' en el comedor (hasta las ' + hora_txt(COMIDAS[i].fin) + ').', 6);
  }
}
// Sentado comiendo: no te mueves hasta que acabas
function comer_actualizar(dt) {
  comiendo.t += dt;
  if (comiendo.t < comiendo.dur) return;
  const ganado = (servido && servido.tipo === 'comida' ? ENERGIA_COMIDA : ENERGIA_SNACK) + (charola === 3 ? ENERGIA_AGUA : 0);
  energy = Math.min(100, energy + ganado);
  if (servido && servido.tipo === 'comida') comidas_comidas.add(servido.clave);
  charola = 4; comiendo = null;
  toast('¡Qué rico! +energía. Ahora deja tu charola en Devolución.', 4);
}

// ---------- Usar cosas del comedor ----------
// ¿Hay una ventanilla o mesa cerca? (para el aviso de [E])
function comedor_cerca() {
  if (!adentro) return null;
  const u = tecla_entre_corchetes('usar') + ' ';
  // la ventanilla más cercana (a menos de 55) y, si traes comida, la mesa más cercana (a menos de 40): gana la más cerca
  let vent = null, dv = 55, mesa = null, dm = 60;
  for (const v of comedor.ventanillas) { const d = pdist(player.x, player.y, v.x, v.y); if (d < dv) { dv = d; vent = v; } }
  if (charola === 2 || charola === 3)
    for (const m of comedor.mesas) {
      const dx = Math.max(0, Math.abs(player.x - m.x) - m.hw), dy = Math.max(0, Math.abs(player.y - m.y) - m.hd - 22), d = Math.hypot(dx, dy);
      if (d < dm) { dm = d; mesa = m; }
    }
  if (mesa && (!vent || dm + 15 < dv)) return { kind: 'mesa', obj: mesa, label: u + 'Sentarte a comer' };
  if (vent) {
    const textos = { charolas: 'Tomar una charola', comida: 'Pedir comida', agua: 'Pedir agua y raciones', devolucion: 'Dejar tu charola' };
    return { kind: 'ventanilla', obj: vent, label: u + textos[vent.tipo] + ' (' + vent.name + ')' };
  }
  return null;
}
function comedor_usar(n) {
  if (n.kind === 'mesa') { comiendo = { t: 0, dur: servido && servido.tipo === 'comida' ? 4 : 2.5 }; soltar_raton(); return; }
  const tipo = n.obj.tipo;
  if (tipo === 'charolas') {
    if (charola) toast('Ya tienes tu charola.');
    else { charola = 1; toast('Tomaste una charola. Ahora pasa a la ventanilla de Comida.', 4); }
  } else if (tipo === 'comida') {
    if (!charola) { toast('Primero toma una charola en la ventanilla de Charolas.', 4); return; }
    if (charola === 4) { toast('Primero deja tu charola sucia en Devolución.'); return; }
    if (charola >= 2) { toast('Ya tienes tu comida. Siéntate en una mesa.'); return; }
    const i = comida_actual();
    if (i >= 0 && !comidas_hechas.has(clave_comida(i))) {
      comidas_hechas.add(clave_comida(i)); servido = { tipo: 'comida', i, raciones: false, clave: clave_comida(i) }; charola = 2;
      toast('Cocinero: ¡Buen provecho! Hoy hay ' + COMIDAS[i].menu + '.', 5);
    } else if (horas_abs() - snack_hora >= SNACK_CADA) {
      snack_hora = horas_abs(); servido = { tipo: 'snack' }; charola = 2;
      toast('Cocinero: ' + (i >= 0 ? 'Ya te serví. ' : 'Ahorita no es hora de comer. ') + 'Te doy una fruta y un pan. ' + siguiente_comida_texto(), 6);
    } else toast('Cocinero: Ya te di algo hace rato. ' + siguiente_comida_texto(), 5);
  } else if (tipo === 'agua') {
    if (charola < 2) { toast('Primero pasa por tu comida.'); return; }
    if (charola === 4) { toast('Ya comiste. Deja tu charola en Devolución.'); return; }
    if (charola === 3) { toast('Ya tienes tu agua.'); return; }
    charola = 3;
    if (servido.tipo === 'comida' && !servido.raciones) {
      servido.raciones = true;
      const n2 = Math.min(2, RACIONES_MAX - food);
      food += n2;
      toast(n2 > 0 ? 'Te dieron agua y ' + n2 + (n2 === 1 ? ' ración' : ' raciones') + ' para el camino.' : 'Te dieron agua. (Ya traes todas las raciones que caben.)', 4);
    } else toast('Te dieron un vaso de agua.');
  } else if (tipo === 'devolucion') {
    if (!charola) toast('No traes charola.');
    else if (charola === 2 || charola === 3) toast('¡Todavía no comes! Siéntate en una mesa.');
    else { charola = 0; servido = null; toast('Dejaste tu charola. ¡Gracias por dejar todo limpio!', 4); }
  }
}

// ---------- Dibujo ----------
// Lista de caras a dibujar desde donde estás (quita las que miran para el otro lado o están detrás)
function caras_visibles(lista, out) {
  const ex = player.x, ey = player.y;
  for (const c of lista) {
    if (c.n && c.n[0] * (ex - c.cx) + c.n[1] * (ey - c.cy) + c.n[2] * (ojo - c.ch) <= 0) continue;
    let zmax = -Infinity;
    for (let i = 0; i < c.p.length; i += 3) zmax = Math.max(zmax, (c.p[i] - ex) * cam_cs + (c.p[i + 1] - ey) * cam_sn);
    if (zmax < NEAR) continue;
    const z = (c.cx - ex) * cam_cs + (c.cy - ey) * cam_sn;
    out.push({ d: Math.hypot(c.cx - ex, c.cy - ey, c.ch - ojo) + c.sesgo, z, c });
  }
}
// Proyecta un polígono con altura y lo recorta frente a la cámara (como poligono3, pero devuelve los puntos)
function proyectar_poli(p3) {
  const N = p3.length / 3, zs = [], xs = [], hs = [], pts = [];
  for (let i = 0; i < N; i++) {
    const dx = p3[i * 3] - player.x, dy = p3[i * 3 + 1] - player.y;
    zs.push(dx * cam_cs + dy * cam_sn); xs.push(-dx * cam_sn + dy * cam_cs); hs.push(p3[i * 3 + 2]);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, pz = zs[i], qz = zs[j];
    if (pz >= NEAR) pts.push(W / 2 + xs[i] / pz * FOC, HOR + (ojo - hs[i]) / pz * FOC);
    if ((pz >= NEAR) !== (qz >= NEAR)) {
      const t = (NEAR - pz) / (qz - pz);
      pts.push(W / 2 + lerp(xs[i], xs[j], t) / NEAR * FOC, HOR + (ojo - lerp(hs[i], hs[j], t)) / NEAR * FOC);
    }
  }
  return pts;
}
function cara_dibujar(it) {
  const pintar = c => {
    const col = con_niebla(typeof c.col === 'function' ? c.col() : c.col, it.z);
    if (!c.multi) {
      poligono3(c.p, col);
      if (c.brilla && es_noche()) comedor_brillos.push(proyectar_poli(c.p)); // de noche se iluminan
      return;
    }
    ctx.fillStyle = col; ctx.beginPath();
    for (const p of c.multi) {
      const q = proyectar_poli(p);
      if (q.length < 6) continue;
      ctx.moveTo(q[0], q[1]);
      for (let i = 2; i < q.length; i += 2) ctx.lineTo(q[i], q[i + 1]);
      ctx.closePath();
    }
    ctx.fill('nonzero');
  };
  pintar(it.c);
  // el detalle (ladrillos) solo si el pedazo de pared más cercano está a menos de 380
  const bb = it.c.bb, cerca = !bb || pdist(player.x, player.y, clamp(player.x, bb[0], bb[2]), clamp(player.y, bb[1], bb[3])) < 380;
  for (const h of it.c.hijos) if (!h.detalle || cerca) pintar(h);
}
// Por fuera: entra a la lista de lo que se ve como una sola cosa (como el cerro)
function comedor_agregar() {
  if (!comedor || adentro) return;
  const c = comedor;
  const qx = clamp(player.x, c.x0, c.x1), qy = clamp(player.y, c.y0, c.y1 + c.porche);
  const d = pdist(player.x, player.y, qx, qy);
  if (d > FAR + 200) return;
  const dx = c.x - player.x, dy = c.y - player.y, z = dx * cam_cs + dy * cam_sn;
  if (z + c.radio < 0) return;
  vis.push({ k: Math.max(5, d), z: Math.max(5, d), sx: 0, sc: 1, spr: 'comedor', w: 0, h: 0, alt: 0 });
}
function comedor_exterior_dibujar() {
  const caras = [], c = comedor;
  caras_visibles(c.fuera, caras);
  // postes del porche: tablitas que siempre te miran
  const rx_ = -cam_sn * 4, ry_ = cam_cs * 4, ph = c.alto - 14;
  for (const p of comedor_postes())
    caras_visibles([{ p: [p.x - rx_, p.y - ry_, 0, p.x + rx_, p.y + ry_, 0, p.x + rx_, p.y + ry_, ph, p.x - rx_, p.y - ry_, ph], col: hex_rgb('#6b4a2b'), n: null, cx: p.x, cy: p.y, ch: ph / 2, sesgo: -2, hijos: [] }], caras);
  caras.sort((a, b) => b.d - a.d);
  for (const it of caras) cara_dibujar(it);
}
// En el suelo: camino de ladrillo hasta la puerta y el piso del porche
function comedor_suelo_dibujar() {
  if (!comedor || pdist(player.x, player.y, comedor.x, comedor.y) > FAR + comedor.radio) return;
  const c = comedor;
  const [ax, ay, bx, by] = comedor_camino_ext(), l = pdist(ax, ay, bx, by), nx = -(by - ay) / l * 34, ny = (bx - ax) / l * 34;
  suelo_poligono([ax - nx, ay - ny, ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny], '#b98f62');
  suelo_poligono([c.x0, c.y1, c.x1, c.y1, c.x1, c.y1 + c.porche + 6, c.x0, c.y1 + c.porche + 6], '#c9c2b2');
}
// Letrero de la entrada (dibujo parado)
function comedor_visibles() {
  if (!comedor || adentro) return;
  agregar_visible(comedor.x + 110, comedor.y0 - 70, sprs.letrero_comedor, 90, 70);
}

// Por dentro: se dibuja el salón en vez del bosque
function comedor_interior_dibujar() {
  const c = comedor;
  rect(0, 0, W, Math.max(0, HOR), '#ece8de');
  rect(0, HOR, W, H - HOR, '#cfc9bd');
  // paredes y techo (estás dentro de un cuarto: no se tapan entre ellas)
  const paredes = [];
  caras_visibles(c.dentro_paredes, paredes);
  paredes.sort((a, b) => b.d - a.d);
  for (const it of paredes) cara_dibujar(it);
  // cosas del salón: caras y dibujos parados, de lejos a cerca
  const cosas = [];
  caras_visibles(c.dentro_cosas, cosas);
  const dib = (x, y, spr, w, h, alt = 0) => {
    const dx = x - player.x, dy = y - player.y, z = dx * cam_cs + dy * cam_sn;
    if (z < 10) return;
    const sc = FOC / z, sx = W / 2 + (-dx * cam_sn + dy * cam_cs) * sc;
    cosas.push({ d: Math.hypot(dx, dy), spr: { spr, w, h, alt, z, sc, sx } });
  };
  for (const m of c.mecedoras) dib(m.x, m.y, sprs.mecedora, 44, 58);
  for (const l of c.lamparas) dib(l.x, l.y, sprs.lampara, 22, 60, 132);
  dib(c.x0 + 40, c.y + 130, sprs.estandarte, 46, 130);
  for (const v of c.ventanillas) { dib(c.xk - 6, v.y, sprs.letreros[v.idx], 64, 15, 98); dib(c.xk - 22, v.y, sprs.letreros[v.idx], 44, 10, 43); }
  cosas.sort((a, b) => b.d - a.d);
  for (const it of cosas) {
    if (it.c) { cara_dibujar(it); continue; }
    const s = it.spr, w = s.w * s.sc, h = s.h * s.sc, bottom = HOR + (ojo - s.alt) * s.sc, kx = w / s.spr.w, ky = h / s.spr.h;
    ctx.globalAlpha = s.z < 40 ? Math.max(0.3, (s.z - 10) / 30) : 1;
    ctx.drawImage(s.spr.levels[0], s.sx - w / 2 - PAD * kx, bottom - h - PAD * ky, w + PAD * 2 * kx, h + PAD * 2 * ky);
    ctx.globalAlpha = 1;
  }
}

// La charola en tus manos y lo de comer (encima de todo, como el chaleco)
function comedor_vista_dibujar() {
  if (charola > 0 && !comiendo) {
    const w = tactil ? Math.min(W * 0.32, 300) : Math.min(W * 0.5, 420), mx = tactil ? W * 0.42 : W / 2, x = mx - w / 2, y = H - w * 0.22;
    poligono([x, H + 10, x + w, H + 10, x + w * 0.92, y, x + w * 0.08, y], '#8e9499');
    poligono([x + w * 0.05, H + 10, x + w * 0.95, H + 10, x + w * 0.88, y + 8, x + w * 0.12, y + 8], '#a9aeb3');
    if (charola === 2 || charola === 3) {
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(W / 2 - w * 0.12, y + w * 0.12, w * 0.2, w * 0.07, 0, 0, 7); ctx.fill();
      const snack = servido && servido.tipo === 'snack';
      blob(W / 2 - w * 0.17, y + w * 0.11, w * 0.05, snack ? '#e8c23a' : '#d9a85a');
      blob(W / 2 - w * 0.07, y + w * 0.11, w * 0.045, snack ? '#c0392b' : '#7a9a3a');
    }
    if (charola === 3) { rect_redondo(W / 2 + w * 0.15, y - w * 0.04, w * 0.08, w * 0.14, 4, '#cfe8f5', 0.9); }
    if (charola === 4) { ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.ellipse(W / 2 - w * 0.1, y + w * 0.12, w * 0.18, w * 0.06, 0, 0, 7); ctx.fill(); }
  }
  if (comiendo) {
    rect(0, 0, W, H, '#000', 0.35);
    const bw = 260, bx = W / 2 - bw / 2;
    pastilla(W / 2, H / 2 - 30, servido && servido.tipo === 'comida' ? '¡Buen provecho!' : 'Comiendo algo chico...', 20, 1);
    barra(bx, H / 2, bw, 'Comiendo', comiendo.t / comiendo.dur * 100, '#3fae4a');
  }
}

// ---------- Dibujos (se pintan una vez) ----------
function pintar_mecedora(g, w, h) {
  const m = '#8a5a30', o = '#6b4a2b';
  g.strokeStyle = o; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.02, h * 0.9); g.quadraticCurveTo(w * 0.5, h * 1.02, w * 0.98, h * 0.9); g.stroke(); // patín
  caja(g, w * 0.15, h * 0.55, w * 0.85, h * 0.66, m);                                     // asiento
  for (let i = 0; i < 4; i++) caja(g, w * (0.2 + i * 0.17), h * 0.05, w * (0.27 + i * 0.17), h * 0.56, m); // respaldo
  caja(g, w * 0.15, h * 0.02, w * 0.85, h * 0.1, o);
  caja(g, w * 0.12, h * 0.62, w * 0.2, h * 0.92, o); caja(g, w * 0.8, h * 0.62, w * 0.88, h * 0.92, o); // patas
  caja(g, w * 0.02, h * 0.4, w * 0.18, h * 0.46, o); caja(g, w * 0.82, h * 0.4, w * 0.98, h * 0.46, o); // brazos
}
function pintar_lampara(g, w, h) {
  caja(g, w * 0.47, 0, w * 0.53, h * 0.6, '#3a3a3a');
  caja_redonda(g, w * 0.15, h * 0.55, w * 0.85, h * 0.95, 3, '#5a5e62');
  elipse(g, w * 0.2, h * 0.88, w * 0.8, h * 1.0, '#fff6d0');
}
function pintar_estandarte(g, w, h) {
  caja(g, w * 0.08, 0, w * 0.14, h, '#6b4a2b');
  caja(g, w * 0.14, h * 0.04, w * 0.98, h * 0.5, '#2f6b2a');
  // flor de lis blanca
  const cx = w * 0.56, cy = h * 0.27, k = w * 0.012;
  g.fillStyle = '#fff';
  for (const pts of [[0, -34, -9, -12, 0, 6, 9, -12], [-6, -4, -14, -18, -26, -20, -30, -6, -20, 6, -8, 4], [6, -4, 8, 4, 20, 6, 30, -6, 26, -20, 14, -18], [-17, 6, 17, 6, 17, 12, -17, 12]]) {
    g.beginPath(); g.moveTo(cx + pts[0] * k, cy + pts[1] * k);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(cx + pts[i] * k, cy + pts[i + 1] * k);
    g.fill();
  }
}
function pintar_letrero(g, w, h, txt, col, px) {
  caja_redonda(g, 0, 0, w, h, h * 0.25, col);
  g.font = fuente(px, true); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, w / 2, h / 2 + 1);
}
function pintar_letrero_comedor(g, w, h) {
  caja(g, w * 0.1, h * 0.3, w * 0.16, h, '#5a3d24'); caja(g, w * 0.84, h * 0.3, w * 0.9, h, '#5a3d24');
  caja_redonda(g, 0, 0, w, h * 0.5, 6, '#6b4a2b'); caja_redonda(g, w * 0.04, h * 0.05, w * 0.96, h * 0.45, 4, '#8a5a30');
  g.font = fuente(h * 0.2, true); g.fillStyle = '#ffe9b0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Comedor', w / 2, h * 0.25);
}
function comedor_sprites() {
  sprs.mecedora = sprite_pintado(44, 58, pintar_mecedora);
  sprs.lampara = sprite_pintado(22, 60, pintar_lampara);
  sprs.estandarte = sprite_pintado(46, 130, pintar_estandarte);
  sprs.letrero_comedor = sprite_pintado(90, 70, pintar_letrero_comedor);
  sprs.letreros = [['Devolución', '#8a5a30'], ['Charolas', '#3b7bd9'], ['Comida', '#3fae4a'], ['Agua y raciones', '#d9813b']]
    .map(([t, col]) => sprite_pintado(128, 30, (g, w, h) => pintar_letrero(g, w, h, t, col, t.length > 10 ? 14 : 17)));
}
