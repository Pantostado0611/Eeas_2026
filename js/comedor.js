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
let comidas_hechas = new Set(); // 'día-i': esa comida ya te la dieron
let snack_hora = -99;   // hora (contando los días) del último snack
let comiendo = null;    // { t, dur }: sentado comiendo (el juego no te deja moverte)
let comida_avisada = '', comedor_aviso_t = 0;
let adentro = false;    // estás dentro del comedor (se dibuja el salón en vez del bosque)

function comedor_reiniciar() {
  charola = 0; servido = null; comidas_hechas = new Set(); snack_hora = -99; comiendo = null;
  comida_avisada = ''; comedor_aviso_t = 0; adentro = false;
}

// ---------- Horarios ----------
const horas_abs = () => day * 24 + hora();
// Comida que se está sirviendo ahorita (índice) o -1
function comida_actual() { const h = hora(); return COMIDAS.findIndex(c => h >= c.ini && h < c.fin); }
const clave_comida = i => day + '-' + i;
const hora_txt = h => Math.floor(h) + ':' + dos(Math.round((h % 1) * 60));
// "La comida es a las 13:30." (la que sigue)
function siguiente_comida_texto() {
  const h = hora();
  const c = COMIDAS.find(c => c.ini > h) || COMIDAS[0];
  return 'Vuelve a la hora ' + (c.name === 'Comida' ? 'de la comida' : c.name === 'Cena' ? 'de la cena' : 'del desayuno') + ' (' + hora_txt(c.ini) + ').';
}

// ---------- Forma del edificio ----------
// Mide 600 x 380 y la puerta mira al norte (hacia el campamento). Adentro, la pared de la cocina está en x1 - 100.
function comedor_crear() {
  const cx = camp.x, cy = camp.y + 560, W2 = 300, D2 = 190;
  const c = comedor = {
    x: cx, y: cy, x0: cx - W2, x1: cx + W2, y0: cy - D2, y1: cy + D2,
    alto: 120, techo: 175, puerta: 50, puerta_alto: 100, porche: 120, xk: cx + 200,
    radio: Math.hypot(W2, D2 + 120), fuera: [], dentro_paredes: [], dentro_cosas: [],
    ventanillas: [], mesas: [], muros: [], mecedoras: [], lamparas: [],
  };
  const { x0, x1, y0, y1, alto, techo, xk } = c;
  // Ventanillas en la pared de la cocina (de la puerta hacia el fondo)
  [['devolucion', 'Devolución', -150], ['charolas', 'Charolas', -70], ['comida', 'Comida', 10], ['agua', 'Agua y raciones', 90]]
    .forEach(([tipo, name, v], i) => c.ventanillas.push({ tipo, name, y: cy + v, x: xk - 60, idx: i }));
  // Mesas largas con bancas (2 filas de 2)
  for (const mv of [-40, 100]) for (const mu of [-150, 40]) c.mesas.push({ x: cx + mu, y: cy + mv, hw: 65, hd: 20 });
  // Mecedoras frente a la chimenea y lámparas colgando
  c.mecedoras = [{ x: x0 + 45, y: cy - 55 }, { x: x0 + 45, y: cy + 55 }];
  for (const mu of [-190, -40, 110]) for (const mv of [-90, 80]) c.lamparas.push({ x: cx + mu, y: cy + mv });

  // Muros para chocar (rectángulos [x0, y0, x1, y1]); la puerta es un hueco en la pared norte
  const g = 6;
  c.muros.push([x0, y0 - g, cx - c.puerta, y0 + g], [cx + c.puerta, y0 - g, x1, y0 + g], // norte (con la puerta)
    [x0, y1 - g, x1, y1 + g], [x0 - g, y0, x0 + g, y1], [x1 - g, y0, x1 + g, y1],      // sur, oeste, este
    [xk - 30, y0, xk + g, y1],                                                         // pared de la cocina (con su repisa)
    [x0, cy - 70, x0 + 30, cy + 70]);                                                  // chimenea
  for (const m of c.mesas) c.muros.push([m.x - m.hw, m.y - m.hd - 22, m.x + m.hw, m.y + m.hd + 22]); // mesa y bancas
  comedor_caras_crear();
}
const comedor_zona = () => comedor ? [{ x: comedor.x, y: comedor.y + comedor.porche / 2, r: comedor.radio + 20 }] : [];
// Postes del porche (se chocan como los árboles)
function comedor_postes() {
  const c = comedor, res = [];
  for (let k = 0; k < 6; k++) res.push({ x: c.x0 + 20 + k * (c.x1 - c.x0 - 40) / 5, y: c.y1 + c.porche, r: 8 });
  return res;
}
// ¿(x, y) está dentro del salón?
const en_comedor = (x, y) => comedor && x > comedor.x0 + 4 && x < comedor.x1 - 4 && y > comedor.y0 + 4 && y < comedor.y1 - 4;
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
  const N = p.length / 3; let cx = 0, cy = 0, ch = 0;
  for (let i = 0; i < N; i++) { cx += p[i * 3]; cy += p[i * 3 + 1]; ch += p[i * 3 + 2]; }
  const o = { p, col: typeof col === 'string' ? hex_rgb(col) : col, n, cx: cx / N, cy: cy / N, ch: ch / N, sesgo, hijos: [] };
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

// Colores que cambian con la hora (vidrios de día y de noche)
const vidrio_fuera = () => es_noche() ? hex_rgb('#f3d58a') : hex_rgb('#2d4a5e');   // de noche se ve la luz de adentro
const vidrio_dentro = () => es_noche() ? hex_rgb('#1f2b55') : hex_rgb('#a9cfe6');  // de adentro se ve el cielo
const puerta_dentro = () => es_noche() ? hex_rgb('#24345e') : hex_rgb('#cfe6c0');  // por la puerta se ve afuera

function comedor_caras_crear() {
  const c = comedor, { x0, x1, y0, y1, alto, techo, xk } = c, cx = c.x, cy = c.y, P = c.puerta, PA = c.puerta_alto;
  // ----- Por fuera -----
  const F = c.fuera, lad = '#a8714a', lad_s = '#b8805a', lad_l = '#9c6a46', lam = '#8e9499', lam2 = '#7d8388';
  const nIzq = pared_y(F, y0, x0, cx - P, 0, alto, lad, -1), nDer = pared_y(F, y0, cx + P, x1, 0, alto, lad, -1);
  pared_y(F, y0, cx - P, cx + P, PA, alto, lad, -1);
  pared_y(nIzq.hijos, y0 - 1, cx - P, cx + P, 0, PA, '#d8c9a8', -1); // la puerta abierta: se ve la luz de adentro
  pared_y(nIzq.hijos, y0 - 1, x0 + 40, x0 + 160, 45, 95, vidrio_fuera, -1);
  pared_y(nDer.hijos, y0 - 1, x1 - 160, x1 - 40, 45, 95, vidrio_fuera, -1);
  const sur = pared_y(F, y1, x0, x1, 0, alto, lad_s, 1);
  for (let k = 0; k < 4; k++) pared_y(sur.hijos, y1 + 1, x0 + 40 + k * 140, x0 + 140 + k * 140, 40, 98, vidrio_fuera, 1);
  // paredes de los lados con el triángulo del techo (dos aguas)
  const oeste = cara(F, [x0, y0, 0, x0, y1, 0, x0, y1, alto, x0, cy, techo, x0, y0, alto], lad_l, [-1, 0, 0]);
  const este = cara(F, [x1, y0, 0, x1, y1, 0, x1, y1, alto, x1, cy, techo, x1, y0, alto], lad_l, [1, 0, 0]);
  pared_x(oeste.hijos, x0 - 1, cy - 120, cy - 40, 45, 95, vidrio_fuera, -1); pared_x(este.hijos, x1 + 1, cy + 40, cy + 120, 45, 95, vidrio_fuera, 1);
  // techo de lámina (sale un poquito de las paredes) con su tira de vidrio arriba
  const e = 18;
  const tn = cara(F, [x0 - e, y0 - e, alto - 6, x1 + e, y0 - e, alto - 6, x1 + e, cy, techo, x0 - e, cy, techo], lam, [0, -(techo - alto + 6), cy - y0 + e]);
  cara(F, [x0 - e, y1 + e, alto - 6, x1 + e, y1 + e, alto - 6, x1 + e, cy, techo, x0 - e, cy, techo], lam2, [0, techo - alto + 6, cy - y0 + e]);
  cara(tn.hijos, [x0 + 120, cy - 30, techo - 9, x1 - 120, cy - 30, techo - 9, x1 - 120, cy - 4, techo - 1, x0 + 120, cy - 4, techo - 1], vidrio_fuera, null);
  // porche: techo de madera y mesas de picnic rojas
  const py = y1 + c.porche, ph = alto - 14;
  cara(F, [x0, y1, ph, x1, y1, ph, x1, py, ph - 6, x0, py, ph - 6], () => ojo > ph ? hex_rgb('#8e9499') : hex_rgb('#c79a5e'), null);
  for (let k = 0; k < 3; k++) {
    const mx = x0 + 110 + k * 190, my = y1 + 62;
    caja3(F, mx - 45, my - 14, mx + 45, my + 14, 26, 31, '#9a2a2a', '#7a2020');
    caja3(F, mx - 45, my - 32, mx + 45, my - 24, 15, 18, '#9a2a2a', '#7a2020');
    caja3(F, mx - 45, my + 24, mx + 45, my + 32, 15, 18, '#9a2a2a', '#7a2020');
  }

  // ----- Por dentro: paredes y techo (con lo pintado encima) -----
  const D = c.dentro_paredes, crema = '#e6dfcf', crema2 = '#ddd5c3', madera = '#b98a5a', lambrin = '#9a6a3e', techo_c = '#ece8de', verde = '#4c5a3c';
  const ni = pared_y(D, y0, x0, cx - P, 0, alto, crema, 1), nd = pared_y(D, y0, cx + P, xk, 0, alto, crema, 1);
  pared_y(D, y0, cx - P, cx + P, PA, alto, crema, 1);
  // por la puerta se ve afuera: cielo arriba y pasto abajo
  pared_y(D, y0, cx - P, cx + P, EYE, PA, puerta_dentro, 1); pared_y(D, y0, cx - P, cx + P, 0, EYE, () => es_noche() ? hex_rgb('#1c3320') : hex_rgb('#6f9a52'), 1);
  pared_y(ni.hijos, y0 + 1, x0, cx - P, 0, 42, lambrin, 1); pared_y(nd.hijos, y0 + 1, cx + P, xk, 0, 42, lambrin, 1);
  pared_y(ni.hijos, y0 + 1.5, x0 + 40, x0 + 160, 50, 100, vidrio_dentro, 1); pared_y(nd.hijos, y0 + 1.5, cx + 90, cx + 180, 50, 100, vidrio_dentro, 1);
  const ds = pared_y(D, y1, x0, xk, 0, alto, crema2, -1);
  pared_y(ds.hijos, y1 - 1, x0, xk, 0, 42, lambrin, -1);
  for (let k = 0; k < 3; k++) pared_y(ds.hijos, y1 - 1.5, x0 + 40 + k * 140, x0 + 140 + k * 140, 46, 104, vidrio_dentro, -1);
  pared_y(ds.hijos, y1 - 1.5, xk - 80, xk - 20, 0, 100, vidrio_dentro, -1); // puertas de vidrio al porche
  const dw = cara(D, [x0, y0, 0, x0, y1, 0, x0, y1, alto, x0, cy, techo, x0, y0, alto], crema2, [1, 0, 0]);
  pared_x(dw.hijos, x0 + 1, y0, y1, 0, 42, lambrin, 1);
  pared_x(dw.hijos, x0 + 1.5, cy - 150, cy - 90, 50, 100, vidrio_dentro, 1); pared_x(dw.hijos, x0 + 1.5, cy + 90, cy + 150, 50, 100, vidrio_dentro, 1);
  // pared de la cocina (de madera) con las ventanillas: hueco iluminado, letrero de color y el cocinero
  const dk = cara(D, [xk, y0, 0, xk, y1, 0, xk, y1, alto, xk, cy, techo, xk, y0, alto], madera, [-1, 0, 0]);
  const colores = ['#8a5a30', '#3b7bd9', '#3fae4a', '#d9813b'];
  for (const v of c.ventanillas) {
    pared_x(dk.hijos, xk - 1, v.y - 28, v.y + 28, 44, 96, '#f5ebc8', -1);
    pared_x(dk.hijos, xk - 1.5, v.y - 30, v.y + 30, 100, 112, colores[v.idx], -1);
    if (v.tipo !== 'devolucion') {
      pintado_x(dk.hijos, xk - 2, v.y, 0, [-14, 44, 14, 44, 14, 74, -14, 74], '#ffffff', -1);        // filipina blanca
      pintado_x(dk.hijos, xk - 2, v.y, 84, [-8, -4, -6, 6, 0, 9, 6, 6, 8, -4, 4, -9, -4, -9], '#d9a77a', -1); // cara
      pintado_x(dk.hijos, xk - 2.5, v.y, 0, [-9, 90, 9, 90, 8, 100, -8, 100], '#ffffff', -1);        // gorro
    } else for (let k = 0; k < 4; k++) pintado_x(dk.hijos, xk - 2, v.y, 46 + k * 4, [-16, 0, 16, 0, 16, 3, -16, 3], '#8e9499', -1); // charolas apiladas
  }
  // techo inclinado con vigas verdes de lado a lado
  const tN = cara(D, [x0, y0, alto, xk, y0, alto, xk, cy, techo, x0, cy, techo], techo_c, [0, techo - alto, -(cy - y0)]);
  const tS = cara(D, [x0, y1, alto, xk, y1, alto, xk, cy, techo, x0, cy, techo], oscuro(techo_c, 0.95), [0, -(techo - alto), -(cy - y0)]);
  for (let u = x0 + 60; u < xk; u += 110) {
    cara(tN.hijos, [u - 6, y0, alto - 1.5, u + 6, y0, alto - 1.5, u + 6, cy, techo - 1.5, u - 6, cy, techo - 1.5], verde, null);
    cara(tS.hijos, [u - 6, y1, alto - 1.5, u + 6, y1, alto - 1.5, u + 6, cy, techo - 1.5, u - 6, cy, techo - 1.5], verde, null);
  }

  // ----- Por dentro: cosas del salón -----
  const K = c.dentro_cosas, ladrillo = '#b07a52';
  // chimenea con la flor de lis (pared oeste)
  const ch = caja3(K, x0, cy - 70, x0 + 28, cy + 70, 0, 165, ladrillo, ladrillo);
  pared_x(ch.e.hijos, x0 + 28.5, cy - 26, cy + 26, 0, 40, '#2a1f16', 1);       // hueco del fuego
  pared_x(ch.e.hijos, x0 + 29, cy - 30, cy + 30, 40, 46, '#8c867a', 1);        // repisa
  flor_de_lis_x(ch.e.hijos, x0 + 29, cy, 108, 1, '#2a1f16', 1, 0);
  // repisa de las ventanillas
  caja3(K, xk - 30, y0 + 4, xk, y1 - 4, 38, 43, '#c8ccd0', '#8e9499');
  // mesas y bancas
  for (const m of c.mesas) {
    caja3(K, m.x - m.hw, m.y - m.hd, m.x + m.hw, m.y + m.hd, 32, 38, '#c49464', '#8a5a30');
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
  for (const r of c.muros) empujar_rect(r, PR);
  // con charola no se sale: regla del comedor
  if (estaba && charola > 0 && player.y < c.y0 + PR + 4) {
    player.y = c.y0 + PR + 4;
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
  charola = 4; comiendo = null;
  toast('¡Qué rico! +energía. Ahora deja tu charola en Devolución.', 4);
}

// ---------- Usar cosas del comedor ----------
// ¿Hay una ventanilla o mesa cerca? (para el aviso de [E])
function comedor_cerca() {
  if (!adentro) return null;
  const u = tecla_entre_corchetes('usar') + ' ';
  for (const v of comedor.ventanillas) {
    if (pdist(player.x, player.y, v.x, v.y) > 55) continue;
    const textos = { charolas: 'Tomar una charola', comida: 'Pedir comida', agua: 'Pedir agua y raciones', devolucion: 'Dejar tu charola' };
    return { kind: 'ventanilla', obj: v, label: u + textos[v.tipo] + ' (' + v.name + ')' };
  }
  if (charola === 2 || charola === 3)
    for (const m of comedor.mesas) {
      const dx = Math.max(0, Math.abs(player.x - m.x) - m.hw), dy = Math.max(0, Math.abs(player.y - m.y) - m.hd - 22);
      if (Math.hypot(dx, dy) < 40) return { kind: 'mesa', obj: m, label: u + 'Sentarte a comer' };
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
      comidas_hechas.add(clave_comida(i)); servido = { tipo: 'comida', i, raciones: false }; charola = 2;
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
function cara_dibujar(it) {
  const pintar = c => poligono3(c.p, con_niebla(typeof c.col === 'function' ? c.col() : c.col, it.z));
  pintar(it.c);
  for (const h of it.c.hijos) pintar(h);
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
  suelo_poligono([c.x - 34, camp.y + 215, c.x + 34, camp.y + 215, c.x + 34, c.y0, c.x - 34, c.y0], '#b98f62');
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
  for (const l of c.lamparas) dib(l.x, l.y, sprs.lampara, 22, 60, 112);
  dib(c.x0 + 40, c.y + 92, sprs.estandarte, 46, 130);
  for (const v of c.ventanillas) dib(c.xk - 6, v.y, sprs.letreros[v.idx], 64, 15, 98);
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
    const w = Math.min(W * 0.5, 420), x = W / 2 - w / 2, y = H - w * 0.22;
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
