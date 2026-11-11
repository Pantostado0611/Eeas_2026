// Generación del mundo (bosque, lagos, ríos, cerro, cascada, bases y lugares con nombre).
// IMPORTANTE: el orden de las llamadas a rr()/rnd() no se debe cambiar: así la semilla 20261101
// arma siempre el mismo bosque (igual que en la versión de GameMaker).

const camp = { x: WORLD / 2, y: WORLD / 2 };
let trees = [], rocks = [], bushes = [], sticks = [], lakes = [], lake_water = [], rios = [], muelles = [];
let flags = [], tents = [], decos = [], solids = [], landmarks = [];
let montana = null, cascada = null, mundo_cat = -1, last_ref = null;

// ¿Hay lugar libre en (x, y) con radio r, sin chocar con nada de la lista (dejando "pad" de margen)?
function mundo_libre(x, y, r, lista, pad) {
  for (const o of lista) if (pdist(o.x, o.y, x, y) < o.r + r + pad) return false;
  return true;
}
const mundo_lugar = kind => landmarks.find(l => l.kind === kind);

// Forma del lago: varios círculos encimados ("lóbulos") dentro del círculo original del lago.
// Usa su propio azar, así no cambia el orden del azar del mundo.
function lago_forma(l, i, semilla, tipo) {
  const g = Mulberry32(semilla + 7919 * (i + 1));
  const R = l.r, rot = g() * PI * 2;
  const p = []; // [x, y, radio] sin girar, en relación al centro
  switch (tipo) {
    case 'ovalo': { // elipse: círculos que tocan la orilla por dentro, a lo largo del eje largo
      const a = R * 0.95, b = R * (0.45 + 0.15 * g()), f = a * a - b * b, cmax = f / a;
      for (let k = 0; k < 15; k++) { const c = -cmax + 2 * cmax * k / 14; p.push([c, 0, b * Math.sqrt(Math.max(0, 1 - c * c / f))]); }
      break;
    }
    case 'lagrima': // gordo de un lado y se va haciendo angosto, como gota
      for (let k = 0; k < 10; k++) { const u = k / 9; p.push([-R * 0.45 + u * R * 1.3, 0, R * (0.53 - 0.4 * u)]); }
      break;
    case 'brazos': // centro redondo con tres brazos que se meten en el bosque
      p.push([0, 0, R * 0.42]);
      for (let k = 0; k < 3; k++) {
        const ang = k / 3 * PI * 2 + (g() - 0.5) * 0.8;
        for (let j = 1; j <= 4; j++) { const d = R * (0.2 + j * 0.16); p.push([Math.cos(ang) * d, Math.sin(ang) * d, R * (0.27 - j * 0.03)]); }
      }
      break;
    case 'chueco': // redondo pero chueco, con bahías y puntas
      p.push([0, 0, R * 0.55]);
      for (let k = 0; k < 7; k++) {
        const ang = k / 7 * PI * 2 + g() * 0.5, d = R * (0.32 + 0.28 * g());
        p.push([Math.cos(ang) * d, Math.sin(ang) * d, R * (0.22 + 0.18 * g())]);
      }
      break;
    default: // "dos": dos lagunas unidas por un canal recto
      p.push([-R * 0.42, 0, R * 0.5], [R * 0.5, 0, R * 0.4]);
      for (let k = 1; k < 5; k++) p.push([-R * 0.42 + k / 5 * R * 0.92, 0, R * 0.18]);
  }
  const cs = Math.cos(rot), sn = Math.sin(rot);
  l.lobes = [];
  for (const q of p) {
    const px = q[0] * cs - q[1] * sn, py = q[0] * sn + q[1] * cs;
    const rl = Math.min(q[2], R - Math.hypot(px, py)); // que no se salga del círculo original
    if (rl >= 15) l.lobes.push({ x: l.x + px, y: l.y + py, r: rl });
  }
}
const lagos_agua = () => lakes.flatMap(l => l.lobes);

// ---------- Ríos ----------
// Cada río es una línea que se dibuja como muchos círculos de agua encimados (igual que los lagos).
// Van de borde a borde del mapa y dejan una esquina del bosque del otro lado: solo se cruzan en canoa.
// Los puntos van de donde nace a donde desemboca (así se sabe hacia dónde va la corriente).

// Curva suave (Catmull-Rom) que pasa por los puntos, con un punto cada ~paso unidades
function rio_suavizar(pts, paso) {
  const n = pts.length, res = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const m = Math.max(1, Math.ceil(pdist(p1[0], p1[1], p2[0], p2[1]) / paso));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      res.push([0, 1].map(c => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  res.push(pts[n - 1]);
  return res;
}
// Punto de la línea más cercano a (x, y) -> índice
function rio_mas_cercano(linea, x, y) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < linea.length; i++) { const d = pdist(linea[i][0], linea[i][1], x, y); if (d < bd) { bd = d; bi = i; } }
  return bi;
}
// Dirección de la corriente (unitaria) en el punto i de la línea
function rio_tangente(linea, i) {
  const n = linea.length, a = linea[Math.max(0, Math.min(i, n - 2))], b = linea[Math.max(1, Math.min(i + 1, n - 1))];
  const l = Math.max(0.001, pdist(a[0], a[1], b[0], b[1]));
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

// afluentes: otras líneas que desembocan en el río; cruce: dónde van los muelles;
// nombres: [muelle del lado del campamento, muelle del otro lado]; etq: en qué parte del río (0 a 1) va su nombre en el mapa
function rio_crear(indice, nombre, pts, ancho, afluentes, cruce, nombres, etq) {
  const rio = { name: nombre, linea: rio_suavizar(pts, 40), afl: [], circ: [], etq: null, seguridad: null, tiras: [] };
  const n = rio.linea.length;
  for (let i = 0; i < n; i++) rio.circ.push({ x: rio.linea[i][0], y: rio.linea[i][1], r: ancho + 14 * Math.sin(i * 0.37) });
  for (const af of afluentes) {
    const l = rio_suavizar(af, 40);
    rio.afl.push(l);
    for (let i = 0; i < l.length; i++) rio.circ.push({ x: l[i][0], y: l[i][1], r: ancho * 0.6 + 8 * Math.sin(i * 0.5) });
  }
  rio.etq = rio.linea[Math.floor((n - 1) * etq)];
  // Para dibujar: tiras de cuadriláteros (agua y orilla) a lo largo del río y de sus afluentes
  rio_tiras(rio, rio.linea, ancho, 14, 0.37, ancho);
  for (const l of rio.afl) rio_tiras(rio, l, ancho * 0.6, 8, 0.5, ancho);

  // Muelles: el del lado del campamento en el punto del río más cercano a cruce; el del otro lado
  // se recorre por el río según la sección (cat.muelle_desfase puntos; + = río abajo, - = río arriba)
  const bi = rio_mas_cercano(rio.linea, cruce[0], cruce[1]);
  const t0 = rio_tangente(rio.linea, bi), c0 = rio.linea[bi];
  const lado_camp = ((camp.x - c0[0]) * -t0[1] + (camp.y - c0[1]) * t0[0]) > 0 ? 1 : -1;
  const bj = clamp(bi + cat.muelle_desfase, 1, n - 2);
  const cerca = rio_muelle(rio, indice, bi, lado_camp, nombres[0]);
  const lejos = rio_muelle(rio, indice, bj, -lado_camp, nombres[1]);
  cerca.otro = lejos; lejos.otro = cerca;
  muelles.push(cerca, lejos);

  // La canoa de seguridad espera río abajo de los dos muelles
  const si = Math.min(n - 1, Math.max(bi, bj) + 9), st = rio_tangente(rio.linea, si);
  rio.seguridad = { x: rio.linea[si][0], y: rio.linea[si][1], ax: st[0], ay: st[1], i: si };
  return rio;
}

// Un muelle en el punto i del río, en la orilla sg (1 o -1)
function rio_muelle(rio, indice, i, sg, nombre) {
  const c = rio.linea[i], t = rio_tangente(rio.linea, i), w = rio.circ[i].r;
  const ox = -t[1] * sg, oy = t[0] * sg; // hacia la orilla de este muelle
  // los chalecos van a un lado del muelle: del lado donde no haya agua cerca
  let lat = 85;
  const rx = c[0] + ox * (w + 75) + t[0] * lat, ry = c[1] + oy * (w + 75) + t[1] * lat;
  if (!mundo_libre(rx, ry, 0, rio.circ, 50) || !mundo_libre(rx, ry, 0, lake_water, 50)) lat = -85;
  return {
    name: nombre, rio: indice, cx: c[0], cy: c[1], ox, oy, tx: t[0], ty: t[1], w,
    x: c[0] + ox * (w + 60), y: c[1] + oy * (w + 60),                                  // en tierra, al pie del muelle
    abordar: { x: c[0] + ox * (w + 28), y: c[1] + oy * (w + 28) },                     // donde te subes
    agua: { x: c[0] + ox * (w - 45), y: c[1] + oy * (w - 45) },                        // donde está la canoa
    rack: { x: c[0] + ox * (w + 75) + t[0] * lat, y: c[1] + oy * (w + 75) + t[1] * lat }, // chalecos
    otro: null,
  };
}

// Un cuadrilátero por tramo de la línea: { x, y, r (para saber si se ve), agua: [8], orilla: [8] }
function rio_tiras(rio, linea, base, amp, frec, ancho) {
  const n = linea.length, bordes = [];
  for (let i = 0; i < n; i++) {
    const a = linea[Math.max(0, i - 1)], b = linea[Math.min(n - 1, i + 1)];
    const l = Math.max(0.001, pdist(a[0], a[1], b[0], b[1])), nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
    const p = linea[i], r = base + amp * Math.sin(i * frec);
    bordes.push([p[0] + nx * r, p[1] + ny * r, p[0] - nx * r, p[1] - ny * r,
      p[0] + nx * (r + 14), p[1] + ny * (r + 14), p[0] - nx * (r + 14), p[1] - ny * (r + 14)]);
  }
  for (let i = 0; i < n - 1; i++) {
    const e = bordes[i], f = bordes[i + 1];
    rio.tiras.push({
      x: (linea[i][0] + linea[i + 1][0]) / 2, y: (linea[i][1] + linea[i + 1][1]) / 2,
      r: pdist(linea[i][0], linea[i][1], linea[i + 1][0], linea[i + 1][1]) / 2 + ancho + 30,
      agua: [e[0], e[1], f[0], f[1], f[2], f[3], e[2], e[3]],
      orilla: [e[4], e[5], f[4], f[5], f[6], f[7], e[6], e[7]],
    });
  }
}

function rios_crear() {
  rios = []; muelles = [];
  // Esquina de arriba a la derecha: nace al norte, pasa por el Lago Espejo y sale al este.
  // La Laguna Azul desemboca en él. Las Bases 1 y 2 quedan del otro lado.
  rios.push(rio_crear(0, 'Río Azul',
    [[1150, -150], [1200, 450], [1380, 880], [1800, 930], [2235, 620], [2500, 1100], [2900, 1380], [3350, 1420], [3700, 1560], [4150, 1700]],
    190, [[[3376, 717], [3365, 1050], [3350, 1420]]], [1895, 873], ['Muelle Sur', 'Muelle Norte'], 0.78));
  // Esquina de abajo a la izquierda: del oeste al sur. El Lago de las Ranas desemboca en él. La Base 4 queda del otro lado.
  rios.push(rio_crear(1, 'Río de las Ranas',
    [[-150, 2550], [400, 2680], [950, 2720], [1500, 2800], [2000, 3000], [2400, 3450], [2650, 4150]],
    180, [[[311, 3251], [330, 2950], [400, 2680]]], [1750, 2900], ['Muelle Oriente', 'Muelle Poniente'], 0.25));
  for (const r of rios) lake_water.push(...r.circ);
}

// ¿(x, y) está en el agua (lagos o ríos), con margen hacia adentro?
function agua_en(x, y, margen) {
  for (const o of lake_water) if (pdist(o.x, o.y, x, y) < o.r - margen) return true;
  return false;
}
// Hacia dónde jala la corriente en (x, y): [dx, dy] unitario (o [0, 0] lejos de los ríos)
function rio_corriente(x, y) {
  let best = [0, 0], bd = Infinity;
  for (const r of rios) for (const l of [r.linea, ...r.afl]) {
    const i = rio_mas_cercano(l, x, y), d = pdist(l[i][0], l[i][1], x, y);
    if (d < bd) { bd = d; best = rio_tangente(l, i); }
  }
  return bd < 250 ? best : [0, 0];
}
// De qué lado del río está (x, y): 1 o -1
function rio_lado(rio, x, y) {
  const i = rio_mas_cercano(rio.linea, x, y), p = rio.linea[i], t = rio_tangente(rio.linea, i);
  return (t[0] * (y - p[1]) - t[1] * (x - p[0])) >= 0 ? 1 : -1;
}
// ¿a y b están del mismo lado de todos los ríos?
const mismo_lado = (a, b) => rios.every(r => rio_lado(r, a.x, a.y) === rio_lado(r, b.x, b.y));
// Si hay un río entre a y b, el muelle del lado de a para cruzarlo (o null)
function muelle_para_cruzar(a, b) {
  for (let r = 0; r < rios.length; r++) {
    const la = rio_lado(rios[r], a.x, a.y);
    if (la === rio_lado(rios[r], b.x, b.y)) continue;
    for (const m of muelles) if (m.rio === r && rio_lado(rios[r], m.x, m.y) === la) return m;
  }
  return null;
}

// ---------- Montaña (Cerro del Coyote) y Cascada ----------
// El cerro es un pico en la esquina de abajo a la izquierda: laderas verdes con pinos y piedras abajo,
// roca arriba, y la cara norte más empinada (por ahí se baja en rapel). Se sube por un solo sendero
// en zigzag por la ladera noreste; en los pasos angostos hay que engancharse a una cuerda.
// En la cima (una placita chiquita) está la Base 4 y un coyote aullando.

// Qué tan lejos llega el pie del cerro en la dirección a (irregular, y más corto al norte: ahí es empinado)
function monte_R(a) {
  const r = 390 + 35 * Math.sin(3 * a + 1) + 22 * Math.sin(5 * a + 2);
  const dn = Math.abs(angle_difference(radtodeg(a), -90)) / 40; // cerca del norte
  return r * (1 - 0.32 * Math.max(0, 1 - dn));
}
// Altura del cerro en (x, y)
function monte_altura(x, y) {
  const m = montana, d = pdist(m.x, m.y, x, y);
  if (d <= m.rc) return m.H;
  const R = monte_R(Math.atan2(y - m.y, x - m.x));
  if (d >= R) return 0;
  return m.H * Math.pow(1 - (d - m.rc) / (R - m.rc), 1.15);
}
// Punto del cerro en dirección a, a la fracción u del camino de la cima (0) al pie (1)
function monte_polar(a, u) {
  const d = montana.rc + (monte_R(a) - montana.rc) * u;
  return [montana.x + Math.cos(a) * d, montana.y + Math.sin(a) * d];
}

function montana_crear() {
  const m = { name: 'Cerro del Coyote', x: 650, y: 3820, H: cat.monte_alto, rc: 55, Rb: 450,
    camino: [], cam_s: [], largo: 0, ancho: 70, ancho_angosto: 30, angostos: [], postes: [],
    rapel: null, v: [], col: [], nor: [], tiras: [], deco: [], K: 7, N: 40 };
  montana = m;
  // Sendero: de afuera del pie (noreste) hasta la orilla de la cima, en zigzag suave
  const cam = [[-0.78, 1.1], [-0.62, 0.86], [-0.86, 0.67], [-0.64, 0.48], [-0.85, 0.3], [-0.72, 0.13], [-0.75, -0.15]];
  for (let i = 0; i < cam.length; i++) {
    let p = monte_polar(cam[i][0], Math.max(0, cam[i][1]));
    if (cam[i][1] < 0) p = [m.x + Math.cos(cam[i][0]) * (m.rc * 0.6), m.y + Math.sin(cam[i][0]) * (m.rc * 0.6)]; // ya en la cima
    m.camino.push(p);
    m.cam_s.push(i === 0 ? 0 : m.cam_s[i - 1] + pdist(m.camino[i - 1][0], m.camino[i - 1][1], p[0], p[1]));
  }
  m.largo = m.cam_s[m.cam_s.length - 1];
  // Pasos angostos repartidos por el sendero, con un poste en cada punta
  const n = cat.monte_angostos;
  for (let k = 0; k < n; k++) {
    const c = (m.largo - 60) * (k + 1) / (n + 1) + 20;
    m.angostos.push([c - 25, c + 25]);
    m.postes.push(monte_en_camino(c - 35, 1, k), monte_en_camino(c + 35, 1, k));
  }
  // Rapel: de la orilla de la cima hacia el norte (la cara empinada)
  const ar = -PI / 2;
  m.rapel = { ang: ar, x: m.x + Math.cos(ar) * (m.rc - 15), y: m.y + Math.sin(ar) * (m.rc - 15) };

  // Malla del cerro: anillos de la cima (k = 0) al pie (k = K), N puntos por anillo
  const g = Mulberry32(4711);
  for (let k = 0; k <= m.K; k++) {
    const anillo = [], u = k / m.K;
    for (let j = 0; j < m.N; j++) { const p = monte_polar(j / m.N * PI * 2, u); anillo.push([p[0], p[1], m.H * Math.pow(1 - u, 1.15)]); }
    m.v.push(anillo);
  }
  // Color de cada cara (ya con su luz): verde abajo, roca arriba y en la cara empinada
  const verde = hex_rgb('#5e7d43'), verde2 = hex_rgb('#4f6e3a'), roca = hex_rgb('#8a8377'), roca2 = hex_rgb('#6f695f');
  for (let k = 0; k < m.K; k++) {
    const fila = [], filan = [];
    for (let j = 0; j < m.N; j++) {
      const n3 = monte_normal(k, j);
      filan.push(n3);
      const u = (k + 0.5) / m.K;
      const empinado = 1 - n3[2]; // 0 = plano, 1 = pared
      const t = clamp((1 - u) * 1.5 - 0.45 + empinado * 0.9 + (g() - 0.5) * 0.35, 0, 1);
      const base = mezclar_rgb(g() < 0.5 ? verde : verde2, g() < 0.5 ? roca : roca2, t);
      const luz = 0.55 + 0.5 * Math.max(0, n3[0] * -0.42 + n3[1] * -0.55 + n3[2] * 0.72);
      fila.push(mezclar_rgb([0, 0, 0], base, clamp(luz, 0, 1)));
    }
    m.col.push(fila); m.nor.push(filan);
  }
  // Tiras del sendero (siguen la ladera, un poquito arriba de ella)
  const paso = 22, tierra = hex_rgb('#b39a70'), rojizo = hex_rgb('#a0664c');
  for (let s = 0; s < m.largo - 0.5; s += paso) {
    const s1 = Math.min(m.largo, s + paso), pa = monte_en_camino(s, 0, -1), pb = monte_en_camino(s1, 0, -1);
    const w = monte_ancho_en((s + s1) / 2) / 2;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, l = Math.max(0.001, Math.hypot(dx, dy)), nx = -dy / l * w, ny = dx / l * w;
    const q = [pa.x + nx, pa.y + ny, 0, pb.x + nx, pb.y + ny, 0, pb.x - nx, pb.y - ny, 0, pa.x - nx, pa.y - ny, 0];
    for (let i = 0; i < 4; i++) q[i * 3 + 2] = monte_altura(q[i * 3], q[i * 3 + 1]) + 3;
    const cx = (pa.x + pb.x) / 2, cy = (pa.y + pb.y) / 2;
    m.tiras.push({ p: q, x: cx, y: cy, h: monte_altura(cx, cy), n: monte_normal_en(cx, cy),
      col: monte_angosto_en((s + s1) / 2) >= 0 ? rojizo : tierra });
  }
  // Pinos y piedras en las laderas (no en el sendero ni en la cara del rapel)
  for (let i = 0; i < 90 && m.deco.length < 34; i++) {
    const a = g() * PI * 2, u = 0.3 + g() * 0.65, p = monte_polar(a, u);
    const pino = g() < 0.7 && u > 0.4;
    if (monte_dist_camino(p[0], p[1]) < 75 || Math.abs(angle_difference(radtodeg(a), -90)) < 22) continue;
    m.deco.push({ x: p[0], y: p[1], h: monte_altura(p[0], p[1]), pino, t: Math.floor(g() * 2.99), s: 0.7 + g() * 0.5 });
  }
}

// Normal (hacia arriba) de la cara (k, j) de la malla
function monte_normal(k, j) {
  const m = montana, j1 = (j + 1) % m.N;
  const a = m.v[k][j], b = m.v[k][j1], c = m.v[k + 1][j];
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  let l = Math.max(0.0001, Math.hypot(n[0], n[1], n[2]));
  if (n[2] < 0) l = -l;
  return [n[0] / l, n[1] / l, n[2] / l];
}
// Normal de la ladera en (x, y) (con la altura de los lados)
function monte_normal_en(x, y) {
  const e = 6, hx = monte_altura(x + e, y) - monte_altura(x - e, y), hy = monte_altura(x, y + e) - monte_altura(x, y - e);
  const n = [-hx, -hy, 2 * e], l = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / l, n[1] / l, n[2] / l];
}
// Punto del sendero a s unidades del inicio; lado: 0 = en medio, 1 = en la orilla (para los postes)
function monte_en_camino(s, lado, k) {
  const m = montana, n = m.camino.length;
  s = clamp(s, 0, m.largo);
  let i = 0;
  while (i < n - 2 && m.cam_s[i + 1] < s) i++;
  const t = (s - m.cam_s[i]) / Math.max(0.001, m.cam_s[i + 1] - m.cam_s[i]);
  const a = m.camino[i], b = m.camino[i + 1];
  let x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
  if (lado !== 0) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.max(0.001, Math.hypot(dx, dy)), w = m.ancho / 2 - 8;
    x += -dy / l * w; y += dx / l * w;
  }
  return { x, y, h: monte_altura(x, y), k, s };
}
// Lo más cerca del sendero: { s, e (qué tan lejos del centro), x, y (punto en el centro), nx, ny (hacia afuera), antes (antes del inicio) }
function monte_proyectar(x, y) {
  const m = montana; let best = null, bd = Infinity;
  for (let i = 0; i < m.camino.length - 1; i++) {
    const a = m.camino[i], b = m.camino[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const tr = ((x - a[0]) * dx + (y - a[1]) * dy) / Math.max(0.001, l2), t = clamp(tr, 0, 1);
    const px = a[0] + dx * t, py = a[1] + dy * t, d = pdist(x, y, px, py);
    if (d < bd) {
      bd = d;
      const l = Math.sqrt(l2);
      best = { s: m.cam_s[i] + t * l, e: d, x: px, y: py, nx: d > 0.001 ? (x - px) / d : -dy / l, ny: d > 0.001 ? (y - py) / d : dx / l,
        antes: i === 0 && tr < 0 };
    }
  }
  return best;
}
const monte_dist_camino = (x, y) => monte_proyectar(x, y).e;
// ¿En qué paso angosto está el punto s del sendero? (-1 si en ninguno)
const monte_angosto_en = s => montana.angostos.findIndex(a => s >= a[0] && s <= a[1]);
const monte_ancho_en = s => monte_angosto_en(s) >= 0 ? montana.ancho_angosto : montana.ancho;
// Zona del cerro (para que no salgan árboles, pasto ni ramas encima)
const monte_zona = () => montana ? [{ x: montana.x, y: montana.y, r: montana.Rb + 20 }] : [];

// La cascada cae a una poza (agua) en una esquina del Río Azul. El lugar con nombre queda al pie, en tierra.
function cascada_crear() {
  cascada = { x: 3000, y: 250, r: 100 };
  lake_water.push({ x: cascada.x, y: cascada.y, r: cascada.r });
}

function mundo_generar(semilla) {
  rnd = Mulberry32(semilla);
  mundo_cat = settings.cat; // los muelles dependen de la sección
  trees = []; rocks = []; bushes = []; sticks = []; lakes = []; flags = []; tents = []; decos = [];

  // Banderas (bases) en anillo alrededor del campamento
  const off = rnd() * PI * 2;
  for (let i = 0; i < NUM_FLAGS; i++) {
    const a = off + i / NUM_FLAGS * PI * 2 + rr(-0.25, 0.25);
    const d = rr(1000, 1650);
    flags.push({ x: camp.x + Math.cos(a) * d, y: camp.y + Math.sin(a) * d, r: 30, n: i + 1, done: false,
      lm: null, route: null, ref: null, mark: null, result: null, unlocked: false, wait: false, used: [], cima: false });
  }
  const keep = [{ x: camp.x, y: camp.y, r: 260 }, ...flags.map(f => ({ x: f.x, y: f.y, r: 110 }))];

  // Lagos
  for (let tries = 0; lakes.length < 4 && tries < 200; tries++) {
    const lx = rr(300, WORLD - 300), ly = rr(300, WORLD - 300), lr = rr(130, 240);
    if (mundo_libre(lx, ly, lr, keep, 40) && mundo_libre(lx, ly, lr, lakes, 150)) lakes.push({ x: lx, y: ly, r: lr });
  }
  // Cada lago con una forma distinta, sacadas en desorden de esta lista (con su propio azar)
  const formas = ['ovalo', 'lagrima', 'brazos', 'chueco', 'dos'], gf = Mulberry32(semilla + 4242);
  for (let i = formas.length - 1; i > 0; i--) { const j = Math.floor(gf() * (i + 1)); [formas[i], formas[j]] = [formas[j], formas[i]]; }
  lakes.forEach((l, i) => lago_forma(l, i, semilla, formas[i % formas.length]));
  lake_water = lagos_agua();
  rios_crear(); // agrega el agua de los ríos a lake_water
  cascada_crear();
  montana_crear();
  // la Base 4 queda en la cima de la montaña
  flags[3].x = montana.x; flags[3].y = montana.y; flags[3].cima = true;
  keep[4].x = montana.x; keep[4].y = montana.y;

  // Lugares característicos: salen con su nombre en el mapa grande
  const lake_names = [['el', 'Lago Espejo'], ['la', 'Laguna Azul'], ['el', 'Lago de las Ranas'], ['el', 'Charco del Oso']];
  landmarks = lakes.map((l, i) => ({ art: lake_names[i][0], name: lake_names[i][1], kind: 'lago', x: l.x, y: l.y, r: l.r, zone: l.r + 90 }));
  landmarks.push({ art: 'el', name: 'Campamento', kind: 'camp', x: camp.x, y: camp.y, r: 230, zone: 230 });
  for (const m of muelles) landmarks.push({ art: 'el', name: m.name, kind: 'muelle', x: m.x, y: m.y, r: 50, zone: 110 });
  landmarks.push({ art: 'el', name: montana.name, kind: 'montana', x: montana.x, y: montana.y, r: montana.Rb, zone: montana.Rb + 60 });
  landmarks.push({ art: 'la', name: 'Cascada Escondida', kind: 'cascada', x: cascada.x, y: cascada.y + 170, r: 60, zone: 220 });
  const spots = [['el', 'Claro de las Flores', 'claro', 170], ['la', 'Roca del Águila', 'roca', 90],
    ['el', 'Árbol Gigante', 'arbol', 110], ['el', 'Pinar Oscuro', 'pinar', 380]];
  for (const [art, name, kind, r] of spots) {
    for (let tries = 0; tries < 400; tries++) {
      const px = rr(350, WORLD - 350), py = rr(350, WORLD - 350);
      let ok = kind === 'pinar'
        ? mundo_libre(px, py, r * 0.4, landmarks, 100)
        : (mundo_libre(px, py, r, keep, 40) && mundo_libre(px, py, r, landmarks, 120));
      if (ok) ok = mundo_libre(px, py, kind === 'pinar' ? r * 0.4 : r, lake_water, 40); // que no caiga en un río
      if (ok) { landmarks.push({ art, name, kind, x: px, y: py, r, zone: r + 40 }); break; }
    }
  }
  const blocked = [...keep, ...lake_water, ...landmarks.filter(l => l.kind === 'claro' || l.kind === 'roca' || l.kind === 'arbol')];
  blocked.push({ x: montana.x, y: montana.y, r: montana.Rb + 120 }, { x: cascada.x, y: cascada.y, r: 150 }); // ni en la montaña ni en la cascada
  for (const m of muelles) blocked.push({ x: m.x, y: m.y, r: 60 }, { x: m.rack.x, y: m.rack.y, r: 45 }); // nada de árboles en los muelles
  const roca = mundo_lugar('roca'), arbol = mundo_lugar('arbol'), pinar = mundo_lugar('pinar'), claro = mundo_lugar('claro');
  if (roca) for (const [dx, dy, r] of [[0, 0, 55], [-55, 32, 38], [50, 38, 34], [12, -58, 30]]) rocks.push({ x: roca.x + dx, y: roca.y + dy, r, seed: rnd() });
  if (arbol) trees.push({ x: arbol.x, y: arbol.y, r: 30, canopy: 135, pine: false, shade: 0.3 });

  // Pista de cada bandera según el lugar conocido más cercano
  for (const f of flags) {
    let best = null, bd = Infinity;
    for (const l of landmarks) {
      if (l.kind === 'camp') continue;
      let dd = pdist(f.x, f.y, l.x, l.y) - l.r;
      if (!mismo_lado(f, l)) dd += 100000; // mejor un lugar del mismo lado del río
      if (dd < bd) { bd = dd; best = l; }
    }
    f.lm = best;
  }
  last_ref = null;

  // Tiendas del campamento
  ['#d9813b', '#3b7bd9', '#c9b13a'].forEach((color, i) => {
    const a = -PI / 2 + (i - 1) * 0.9;
    tents.push({ x: camp.x + Math.cos(a) * 150, y: camp.y + Math.sin(a) * 150, r: 34, ang: a, color, idx: i });
  });

  // Árboles
  for (let tries = 0; trees.length < 950 && tries < 6000; tries++) {
    const tx = rr(40, WORLD - 40), ty = rr(40, WORLD - 40);
    const in_pinar = pinar && pdist(tx, ty, pinar.x, pinar.y) < pinar.r;
    const canopy = rr(38, 66);
    const pine = in_pinar ? true : rnd() < 0.45;   // si está en el pinar no se pide número
    const shade = in_pinar ? 0 : rnd();
    if (mundo_libre(tx, ty, 30, blocked, 0) && mundo_libre(tx, ty, 0, trees, 34)) trees.push({ x: tx, y: ty, r: 14, canopy, pine, shade });
  }
  // Rocas
  for (let tries = 0; rocks.length < 130 && tries < 3000; tries++) {
    const kx = rr(40, WORLD - 40), ky = rr(40, WORLD - 40), kr = rr(14, 32), ks = rnd();
    if (mundo_libre(kx, ky, kr, blocked, 10) && mundo_libre(kx, ky, kr, trees, 4)) rocks.push({ x: kx, y: ky, r: kr, seed: ks });
  }
  // Arbustos con bayas
  const all = [...blocked, ...trees, ...rocks];
  for (let tries = 0; bushes.length < 170 && tries < 4000; tries++) {
    const bx = rr(60, WORLD - 60), by = rr(60, WORLD - 60);
    if (pdist(bx, by, camp.x, camp.y) < 350) continue;
    if (mundo_libre(bx, by, 22, all, 10) && mundo_libre(bx, by, 22, bushes, 30)) bushes.push({ x: bx, y: by, r: 22, berries: 3, regrow: 0 });
  }
  for (let i = 0; i < 260; i++) mundo_poner_rama();

  // Decoración del suelo (pasto, flores, hojas)
  for (let i = 0; i < 3500; i++) {
    const dx = rr(0, WORLD), dy = rr(0, WORLD), dk = Math.floor(rnd() * 4), da = rnd() * 6.28;
    decos.push({ x: dx, y: dy, k: dk, a: da });
  }
  if (claro) for (let i = 0; i < 280; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * claro.r, da = rnd() * 6.28;
    decos.push({ x: claro.x + Math.cos(a) * d, y: claro.y + Math.sin(a) * d, k: 2, a: da });
  }
  // nada de pasto encima del agua ni en el cerro
  const lagos = [...lake_water, ...monte_zona()];
  decos = decos.filter(d => mundo_libre(d.x, d.y, 0, lagos, 0));

  solids = [...trees, ...rocks, ...lake_water, ...tents, { x: camp.x, y: camp.y, r: 26 }];
  mapa_construir();
}

// Pone una rama nueva en un lugar libre, lejos del jugador (usa el azar normal)
function mundo_poner_rama() {
  for (let tries = 0; tries < 50; tries++) {
    const sx = 60 + random(WORLD - 120), sy = 60 + random(WORLD - 120), sa = random(6.28);
    if (player && pdist(sx, sy, player.x, player.y) < 500) continue;
    if (mundo_libre(sx, sy, 10, lake_water, 0) && mundo_libre(sx, sy, 10, monte_zona(), 0) && mundo_libre(sx, sy, 10, rocks, 0) && mundo_libre(sx, sy, 4, trees, 0)) {
      sticks.push({ x: sx, y: sy, a: sa, r: 8 });
      return;
    }
  }
}
