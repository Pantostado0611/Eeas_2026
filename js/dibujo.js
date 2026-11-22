// Dibujo en primera persona.
// No es 3D de verdad: el suelo es un degradado y todo (árboles, rocas...) son dibujos 2D de frente
// que se hacen más chicos con la distancia. Lo lejano se ve más oscuro. El cerro sí es una malla 3D sencilla.

let HOR = 0, FOC = 1, cam_cs = 1, cam_sn = 0, ojo = EYE;
let vis = [], monte_clave = 0;

// ---------- Hora del día ----------
const hora = () => (6 + time * 24) % 24;
function oscuridad() {
  const h = hora();
  if (h >= 6 && h < 18) return 0;
  if (h >= 18 && h < 20) return (h - 18) / 2 * 0.86;
  if (h >= 4 && h < 6) return (6 - h) / 2 * 0.86;
  return 0.86;
}
const es_noche = () => oscuridad() > 0.5;

// Colores del cielo según la hora (de noche: azul, no negro)
function colores_cielo() {
  const h = hora(), n = oscuridad() / 0.86;
  let top = mezclar_rgb([110, 170, 225], [28, 45, 105], n);
  let bot = mezclar_rgb([200, 225, 235], [70, 95, 160], n);
  let dusk = 0;
  if ((h >= 17 && h < 20) || (h >= 4.5 && h < 7)) dusk = 1 - Math.min(1, Math.abs(h < 12 ? h - 5.8 : h - 18.6) / 1.4);
  if (dusk > 0) bot = mezclar_rgb(bot, [235, 150, 95], dusk * 0.8);
  if (rain) { top = mezclar_rgb(top, [120, 125, 135], 0.5); bot = mezclar_rgb(bot, [150, 155, 160], 0.5); }
  return { top: css(top), bot: css(bot), n };
}

// Nivel de niebla según la distancia (0 = cerca, 3 = muy lejos)
const nivel_niebla = z => z < 320 ? 0 : z < 680 ? 1 : z < 1050 ? 2 : 3;

// ---------- Suelo ----------
// Proyecta un polígono del suelo (puntos del mundo [x0, y0, x1, y1, ...], convexo) y lo recorta frente a la cámara
const NEAR = 4;
function suelo_proyectar(wpts) {
  const N = wpts.length / 2, zs = [], xs = [], pts = [];
  for (let i = 0; i < N; i++) {
    const dx = wpts[i * 2] - player.x, dy = wpts[i * 2 + 1] - player.y;
    zs.push(dx * cam_cs + dy * cam_sn); xs.push(-dx * cam_sn + dy * cam_cs);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, pz = zs[i], qz = zs[j];
    if (pz >= NEAR) pts.push(W / 2 + xs[i] / pz * FOC, HOR + ojo / pz * FOC);
    if ((pz >= NEAR) !== (qz >= NEAR)) {
      const t = (NEAR - pz) / (qz - pz), xr = xs[i] + (xs[j] - xs[i]) * t;
      pts.push(W / 2 + xr / NEAR * FOC, HOR + ojo / NEAR * FOC);
    }
  }
  return pts;
}
function suelo_poligono(wpts, col, alpha = 1) { poligono(suelo_proyectar(wpts), col, alpha); }

// ¿Se puede ver algo de un círculo (x, y, r) del suelo? (delante de la cámara y dentro del ángulo de visión)
function suelo_visible(x, y, r) {
  const dx = x - player.x, dy = y - player.y, z = dx * cam_cs + dy * cam_sn;
  if (z < -r || z - r > FAR) return false;
  return Math.abs(-dx * cam_sn + dy * cam_cs) - r <= Math.max(0, z + r) * 1.1 + 10;
}
// Lote: muchos pedazos del mismo color en un solo relleno (mucho más rápido, como el agua).
// Todos se agregan con el mismo sentido de giro para que los encimados no hagan hoyos.
function lote_empezar() { ctx.beginPath(); }
function lote_agregar(wpts) {
  const p = suelo_proyectar(wpts), n = p.length / 2;
  if (n < 3) return;
  let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
  if (area >= 0) { ctx.moveTo(p[0], p[1]); for (let i = 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]); }
  else { ctx.moveTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1]); for (let i = n - 2; i >= 0; i--) ctx.lineTo(p[i * 2], p[i * 2 + 1]); }
  ctx.closePath();
}
function lote_terminar(col) { ctx.fillStyle = col; ctx.fill('nonzero'); }
// Círculo del suelo (24 puntos) al lote, solo si se ve
const CIRC24 = Array.from({ length: 24 }, (_, i) => [Math.cos(i / 24 * PI * 2), Math.sin(i / 24 * PI * 2)]);
function lote_circulo(cx, cy, r) {
  if (!suelo_visible(cx, cy, r)) return;
  const w = [];
  for (const c of CIRC24) w.push(cx + c[0] * r, cy + c[1] * r);
  lote_agregar(w);
}
// Mancha en el suelo (claros, campamento): círculo del mundo proyectado en perspectiva
function mancha_suelo(cx, cy, r, col, alpha) {
  if (pdist(cx, cy, player.x, player.y) - r > FAR) return;
  const w = [];
  for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; w.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  suelo_poligono(w, col, alpha);
}

// ---------- Lo que se ve ----------
// Agrega una cosa a la lista de lo que se ve (si está a la vista).
// spr = dibujo de sprites_crear() o 'fogata' / 'cascada' / 'monte'. alt: a qué altura está parado (en el cerro).
function agregar_visible(ox, oy, spr, w, h, alt = 0) {
  const dx = ox - player.x, dy = oy - player.y, z = dx * cam_cs + dy * cam_sn;
  if (z < 10 || z > FAR) return;
  const sc = FOC / z, sx = W / 2 + (-dx * cam_sn + dy * cam_cs) * sc;
  if (sx + w * sc < -50 || sx - w * sc > W + 50) return;
  // lo que está en el cerro: después del cerro, de lejos a cerca
  vis.push({ k: alt > 0 ? monte_clave - 1 + z / 100000 : z, z, sx, sc, spr, w, h, alt });
}

function dibujar_mundo() {
  // Mirar arriba/abajo: el horizonte sube o baja en la pantalla
  HOR = Math.round(H * 0.47 + player.pitch * H * 0.9);
  FOC = (W / 2) / Math.tan(FOV / 2);
  cam_cs = Math.cos(player.ang); cam_sn = Math.sin(player.ang);
  ojo = EYE + player.alt; // en la montaña o en rapel vas más alto
  comedor_brillos = [];
  if (adentro) { comedor_interior_dibujar(); return; } // dentro del comedor no se ve el bosque
  const sky = colores_cielo();

  // Cielo
  if (HOR > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, HOR);
    g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HOR + 2);
  }
  if (sky.n > 0.3) {
    ctx.fillStyle = `rgba(255,255,240,${(sky.n - 0.3) * (rain ? 0.3 : 1)})`;
    for (const s of stars) {
      let a = s.a - player.ang; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > FOV / 2) continue;
      ctx.fillRect(W / 2 + a / (FOV / 2) * W / 2, HOR - H * 0.47 + s.y * H * 0.4, s.s, s.s);
    }
  }
  // Bosque lejano: la capa de atrás primero
  const full = W * (PI * 2 / FOV); // ancho en pantalla de una vuelta completa
  [ridge[1], ridge[0]].forEach((c, i) => {
    const sh = H * (i ? 0.17 : 0.13), sw = c.width * (sh / c.height);
    const off = (((player.ang / (PI * 2)) * full * (i ? 1 : 0.85)) % sw + sw) % sw;
    for (let x = -off; x < W; x += sw) ctx.drawImage(c, x, HOR - sh + 3, sw, sh);
  });

  // Suelo: oscuro a lo lejos, claro cerca
  if (HOR < H) {
    const g = ctx.createLinearGradient(0, HOR, 0, H);
    g.addColorStop(0, '#1f3326'); g.addColorStop(0.18, '#34532f'); g.addColorStop(1, '#5d8c40');
    ctx.fillStyle = g; ctx.fillRect(0, HOR, W, H - HOR);
  }

  // Manchas del suelo
  for (const l of landmarks) {
    if (l.kind === 'pinar') mancha_suelo(l.x, l.y, l.r, 'rgb(25,50,30)', 0.35);
    if (l.kind === 'claro') mancha_suelo(l.x, l.y, l.r, 'rgb(150,190,100)', 0.35);
  }
  mancha_suelo(camp.x, camp.y, 230, 'rgb(140,120,80)', 0.75);
  // Lagos y ríos: primero toda la orilla y luego toda el agua, así los pedazos encimados se ven como una sola forma
  for (let pasada = 0; pasada < 2; pasada++) {
    const extra = pasada === 0 ? 14 : 0;
    lote_empezar();
    for (const l of lakes) {
      if (!suelo_visible(l.x, l.y, l.r + 14)) continue;
      for (const o of l.lobes) lote_circulo(o.x, o.y, o.r + extra);
    }
    for (const r of rios) for (const q of r.tiras) if (suelo_visible(q.x, q.y, q.r)) lote_agregar(pasada === 0 ? q.orilla : q.agua);
    if (cascada) lote_circulo(cascada.x, cascada.y, cascada.r + extra); // la poza de la cascada
    lote_terminar(pasada === 0 ? 'rgb(144,131,92)' : '#3a7aa6');
  }
  rio_suelo_dibujar();
  comedor_suelo_dibujar();

  // Juntar todo lo que se ve y dibujarlo de lo más lejano a lo más cercano
  vis = []; monte_clave = 0;
  monte_agregar(); // primero la montaña (lo que está en alto se ordena con ella)
  comedor_agregar();
  for (const t of trees) {
    if (t.canopy > 100) agregar_visible(t.x, t.y, sprs.giant, 330, 520);
    else if (t.pine) agregar_visible(t.x, t.y, sprs.pine[Math.floor(t.shade * 2.99)], t.canopy * 1.9, t.canopy * 4.6);
    else if (sprs.arbol) agregar_visible(t.x, t.y, sprs.arbol[Math.floor(t.shade * 2.99)], t.canopy * 2.0, t.canopy * 3.6);
    else agregar_visible(t.x, t.y, sprs.oak[Math.floor(t.shade * 2.99)], t.canopy * 2.3, t.canopy * 3.6);
  }
  for (const k of rocks) agregar_visible(k.x, k.y, sprs.rock[k.seed < 0.5 ? 0 : 1], k.r * 2.6, k.r * 1.7);
  for (const t of tents) agregar_visible(t.x, t.y, sprs.tent[t.idx], 96, 66);
  for (const f of flags) // en Rover son invisibles hasta revelarlas
    if (f.done || cat.hint !== 'ruta') agregar_visible(f.x, f.y, sprs.flag[f.done ? 1 : 0][f.n - 1], 46, 120, f.cima ? montana.H : 0);
  for (const s of sticks) agregar_visible(s.x, s.y, sprs.stick, 30, 9);
  const px = player.x, py = player.y;
  for (const d of decos) if (Math.abs(d.x - px) + Math.abs(d.y - py) < 700) agregar_visible(d.x, d.y, sprs.tuft[d.k === 2 ? 2 : d.k % 2], 16, 14);
  rio_visibles();
  monte_visibles();
  comedor_visibles();
  if (cascada) agregar_visible(cascada.x, cascada.y, 'cascada', 260, 230);
  agregar_visible(camp.x, camp.y, 'fogata', 60, 40);

  vis.sort((a, b) => b.k - a.k); // de lejos a cerca
  for (const it of vis) {
    const w = it.w * it.sc, h = it.h * it.sc, bottom = HOR + (ojo - it.alt) * it.sc;
    // se desvanece al final de la vista, y lo que está pegado a ti se vuelve transparente para no tapar todo
    const alpha = it.z > FAR - 300 ? (FAR - it.z) / 300 : it.z < 90 ? Math.max(0.3, (it.z - 15) / 75) : 1;
    const L = nivel_niebla(it.z);
    if (it.spr === 'monte') monte_dibujar();
    else if (it.spr === 'comedor') comedor_exterior_dibujar();
    else if (it.spr === 'cascada') dibujar_cascada(it.sx, bottom, it.sc, L, alpha);
    else if (it.spr === 'fogata') dibujar_fogata(it.sx, bottom, it.sc, L, alpha);
    else {
      const kx = w / it.spr.w, ky = h / it.spr.h;
      ctx.globalAlpha = alpha;
      if (it.spr.pixel && L === 0) ctx.imageSmoothingEnabled = false; // pixel art nítido de cerca
      ctx.drawImage(it.spr.levels[L], it.sx - w / 2 - PAD * kx, bottom - h - PAD * ky, w + PAD * 2 * kx, h + PAD * 2 * ky);
      ctx.imageSmoothingEnabled = true;
    }
  }
  ctx.globalAlpha = 1;

  // Noche: todo se pone azul (sin oscurecer); la fogata brilla naranja y las ventanas del comedor se ven iluminadas
  if (sky.n > 0) rect(0, 0, W, H, 'rgb(35,65,170)', 0.32 * sky.n);
  comedor_brillos_dibujar(sky.n);
  const dx = camp.x - player.x, dy = camp.y - player.y, fz = dx * cam_cs + dy * cam_sn;
  if (fire.fuel > 0 && fz > 10 && fz < FAR && !comedor_tapa(player.x, player.y, camp.x, camp.y)) {
    const sc = FOC / fz, x = W / 2 + (-dx * cam_sn + dy * cam_cs) * sc, y = HOR + ojo * sc - 20 * sc;
    const r = Math.min(W, (160 + fire.fuel) * sc * (1 + Math.sin(ahora() / 90) * 0.04));
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r);
    gl.addColorStop(0, `rgba(255,160,60,${0.25 + 0.35 * sky.n})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (rain) { rect(0, 0, W, H, 'rgb(90,100,115)', 0.18); dibujar_lluvia(); }
}

// Fogata de frente: piedras, leños y llamas que se mueven
function dibujar_fogata(x, bottom, sc, L, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, bottom); ctx.scale(sc, sc);
  const stone = [['#7d7f7a', '#6a6c67'], ['#686a66', '#585a56'], ['#545753', '#474a46'], ['#444843', '#393d39']][L];
  for (let i = -3; i <= 3; i++) { ctx.fillStyle = stone[i & 1]; ctx.beginPath(); ctx.ellipse(i * 9, -4, 7, 6, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = ['#5a3a20', '#4d331e', '#402c1c', '#352619'][L]; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(14, -16); ctx.moveTo(18, -6); ctx.lineTo(-14, -16); ctx.stroke();
  if (fire.fuel > 0) {
    const t = ahora() / 110, s = 0.55 + fire.fuel / 160;
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

// Gotas de lluvia (se mueven en lluvia_actualizar)
function dibujar_lluvia() {
  ctx.strokeStyle = 'rgba(180,200,255,0.5)'; ctx.lineWidth = 1.5; ctx.lineCap = 'butt'; ctx.beginPath();
  for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 4, d.y - 18); }
  ctx.stroke();
}

// ---------- Ríos: muelles, canoas y chalecos en el mundo ----------
// Casco de canoa (forma de hoja) en el suelo: centro, eje (unitario), largo y medio ancho
function casco_pts(cx, cy, ax, ay, len, hw) {
  const pts = [], px = -ay, py = ax;
  for (let k = 0; k <= 12; k++) {
    const u = -1 + 2 * k / 12, h = hw * Math.pow(Math.max(0, 1 - u * u), 0.6);
    pts.push(cx + ax * u * len / 2 + px * h, cy + ay * u * len / 2 + py * h);
  }
  for (let k = 11; k >= 1; k--) {
    const u = -1 + 2 * k / 12, h = hw * Math.pow(Math.max(0, 1 - u * u), 0.6);
    pts.push(cx + ax * u * len / 2 - px * h, cy + ay * u * len / 2 - py * h);
  }
  return pts;
}
function canoa_suelo(cx, cy, ax, ay, col) {
  if (pdist(cx, cy, player.x, player.y) > FAR) return;
  suelo_poligono(casco_pts(cx, cy, ax, ay, 120, 20), col);
  suelo_poligono(casco_pts(cx, cy, ax, ay, 96, 13), '#5a2a1a');
}
// Dónde está la canoa de seguridad del río i: { x, y, ax, ay }
function seguridad_pos(i) {
  if (rescate && rescate.desde.rio === i) return { x: rescate.bx, y: rescate.by, ax: rescate.ax, ay: rescate.ay }; // mirando hacia donde va
  return rios[i].seguridad;
}
// Muelles y canoas (van pegados al suelo, después del agua)
function rio_suelo_dibujar() {
  for (const m of muelles) {
    if (pdist(m.x, m.y, player.x, player.y) > FAR + 200) continue;
    const tabla = (l) => l.flatMap(([a, b]) => [m.cx + m.ox * a + m.tx * b, m.cy + m.oy * a + m.ty * b]);
    suelo_poligono(tabla([[m.w + 45, 26], [m.w + 45, -26], [m.w - 60, -26], [m.w - 60, 26]]), '#4a3420');
    suelo_poligono(tabla([[m.w + 41, 21], [m.w + 41, -21], [m.w - 56, -21], [m.w - 56, 21]]), '#9a7448');
    // canoa amarrada a un lado del muelle (si no la estás usando)
    const usada = (canoa && canoa.desde === m) || (rescate && rescate.desde === m);
    if (!usada) canoa_suelo(m.cx + m.ox * (m.w - 30) + m.tx * 58, m.cy + m.oy * (m.w - 30) + m.ty * 58, m.ox, m.oy, '#b5462e');
  }
  if (!sprs.salvavidas) for (let i = 0; i < rios.length; i++) { const s = seguridad_pos(i); canoa_suelo(s.x, s.y, s.ax, s.ay, '#e8692a'); }
  if (canoa && !canoa.manual) { // aro naranja donde llegas
    const a = canoa.desde.otro.agua, w = [];
    for (let i = 0; i < 24; i++) { const t = i / 24 * PI * 2; w.push(a.x + Math.cos(t) * 70, a.y + Math.sin(t) * 70); }
    for (let i = 24; i >= 0; i--) { const t = i / 24 * PI * 2; w.push(a.x + Math.cos(t) * 56, a.y + Math.sin(t) * 56); }
    suelo_poligono(w, '#f08a2a', 0.8);
  }
}
// Chalecos colgados y la persona de la canoa de seguridad (dibujos parados)
function rio_visibles() {
  for (const m of muelles) agregar_visible(m.rack.x, m.rack.y, sprs.chalecos, 80, 72);
  for (let i = 0; i < rios.length; i++) {
    const s = seguridad_pos(i), sv = sprs.salvavidas;
    if (!sv) { agregar_visible(s.x, s.y, sprs.rescatista, 34, 56); continue; }
    // Según desde dónde lo veas: de frente (o de espaldas) o de lado, con la punta del bote hacia donde apunta
    const dx = s.x - player.x, dy = s.y - player.y, d = Math.hypot(dx, dy) || 1;
    const de_frente = Math.abs((s.ax * dx + s.ay * dy) / d) > 0.75;
    const spr = de_frente ? sv.frente : (-s.ax * cam_sn + s.ay * cam_cs > 0 ? sv.lado : sv.lado_espejo);
    agregar_visible(s.x, s.y, spr, 77, 90, -5); // un poquito hundido en el agua
  }
}

// ---------- Montaña en 3D y cascada ----------
// Polígono con altura: puntos [x, y, h, x, y, h, ...] (convexo), proyectado y recortado frente a la cámara
function poligono3(p3, col) {
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
  poligono(pts, col);
}
// Proyecta un punto con altura: [x, y] en pantalla, o null si está detrás
function proyectar3(x, y, h) {
  const dx = x - player.x, dy = y - player.y, z = dx * cam_cs + dy * cam_sn;
  if (z < 4) return null;
  return [W / 2 + (-dx * cam_sn + dy * cam_cs) / z * FOC, HOR + (ojo - h) / z * FOC];
}
// Niebla para un color [r,g,b] según lo lejos (igual que los dibujos)
const con_niebla = (col, z) => css(mezclar_rgb(col, [14, 26, 24], NIEBLA[nivel_niebla(Math.max(1, z))]));

// El cerro entra a la lista de lo que se ve como una sola cosa. Si estás en él, se dibuja después de todo lo del suelo.
function monte_agregar() {
  if (!montana) return;
  const dx = montana.x - player.x, dy = montana.y - player.y, z = dx * cam_cs + dy * cam_sn;
  if (monte_modo === '' && !rapel && (z + montana.Rb < 10 || z - montana.Rb > FAR)) return;
  const clave = monte_modo !== '' ? 1 : Math.max(5, z - montana.Rb);
  vis.push({ k: clave, z: clave, sx: 0, sc: 1, spr: 'monte', w: 0, h: 0, alt: 0 });
  monte_clave = clave;
}
// ¿Se ve este punto de la ladera desde donde estás? (la ladera mira hacia ti)
function monte_punto_visible(x, y, h) {
  if (pdist(x, y, montana.x, montana.y) <= montana.rc) return true; // la cima siempre se asoma
  const n = monte_normal_en(x, y);
  return n[0] * (player.x - x) + n[1] * (player.y - y) + n[2] * (ojo - h) > 0;
}
function monte_dibujar() {
  const m = montana, caras = [], ex = player.x, ey = player.y;
  const d3 = (x, y, h) => Math.hypot(x - ex, y - ey, h - ojo);
  for (let k = 0; k < m.K; k++) {
    for (let j = 0; j < m.N; j++) {
      const j1 = (j + 1) % m.N, a = m.v[k][j], b = m.v[k][j1], c = m.v[k + 1][j1], d = m.v[k + 1][j];
      const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cy = (a[1] + b[1] + c[1] + d[1]) / 4, ch = (a[2] + b[2] + c[2] + d[2]) / 4;
      const n = m.nor[k][j];
      if (n[0] * (ex - cx) + n[1] * (ey - cy) + n[2] * (ojo - ch) <= 0) continue; // mira para el otro lado
      const z = (cx - ex) * cam_cs + (cy - ey) * cam_sn;
      if (z < -120) continue;
      caras.push({ d: d3(cx, cy, ch), col: con_niebla(m.col[k][j], z), p: [...a, ...b, ...c, ...d] });
    }
  }
  // la placita de la cima
  if (ojo > m.H) {
    const top = [];
    for (let j = 0; j < m.N; j++) top.push(m.v[0][j][0], m.v[0][j][1], m.H);
    const z = (m.x - ex) * cam_cs + (m.y - ey) * cam_sn;
    caras.push({ d: d3(m.x, m.y, m.H), col: con_niebla(hex_rgb('#8c867a'), z), p: top });
  }
  // el sendero (encima de la ladera)
  for (const t of m.tiras) {
    const n = t.n;
    if (n[0] * (ex - t.x) + n[1] * (ey - t.y) + n[2] * (ojo - t.h) <= 0) continue;
    const z = (t.x - ex) * cam_cs + (t.y - ey) * cam_sn;
    if (z < -60) continue;
    caras.push({ d: d3(t.x, t.y, t.h) - 10, col: con_niebla(t.col, z), p: t.p });
  }
  // de lo más lejano a lo más cercano
  caras.sort((a, b) => b.d - a.d);
  for (const c of caras) poligono3(c.p, c.col);

  // cuerdas de los pasos angostos (por la orilla del sendero, a la altura de la cintura)
  for (let k = 0; k < m.angostos.length; k++) {
    let ant = null;
    const a = m.angostos[k];
    for (let s = a[0] - 10; s <= a[1] + 10.01; s += 10) {
      const q = monte_en_camino(s, 1, k);
      const p = monte_punto_visible(q.x, q.y, q.h) ? proyectar3(q.x, q.y, q.h + 40) : null;
      if (p && ant) linea_redonda(ant[0], ant[1], p[0], p[1], clamp(3 * FOC / Math.max(60, pdist(ex, ey, q.x, q.y)), 1.5, 8), '#e0b84a');
      ant = p;
    }
  }
}
// Pinos, piedras, postes, el coyote y el poste del rapel (van parados sobre el cerro)
function monte_visibles() {
  if (!montana) return;
  const m = montana;
  for (const d of m.deco) {
    if (!monte_punto_visible(d.x, d.y, d.h)) continue;
    if (d.pino) agregar_visible(d.x, d.y, sprs.pine[d.t], 95 * d.s, 230 * d.s, d.h);
    else agregar_visible(d.x, d.y, sprs.rock[d.t % 2], 70 * d.s, 46 * d.s, d.h);
  }
  for (const p of m.postes) if (monte_punto_visible(p.x, p.y, p.h)) agregar_visible(p.x, p.y, sprs.poste, 16, 50, p.h);
  agregar_visible(m.x + Math.cos(0.4) * (m.rc - 14), m.y + Math.sin(0.4) * (m.rc - 14), sprs.coyote, 50, 46, m.H);
  if (monte_modo === 'cima' || ojo > m.H + 30) agregar_visible(m.rapel.x, m.rapel.y, sprs.poste, 16, 50, m.H);
}
// Cascada: la roca es un dibujo; el agua que cae se mueve
function dibujar_cascada(x, bottom, sc, L, alpha) {
  const s = sprs.cascada, w = 260 * sc, h = 230 * sc, kx = w / s.w, ky = h / s.h;
  ctx.globalAlpha = alpha;
  ctx.drawImage(s.levels[L], x - w / 2 - PAD * kx, bottom - h - PAD * ky, w + PAD * 2 * kx, h + PAD * 2 * ky);
  const top = bottom - 200 * sc, agua = css(mezclar_rgb(hex_rgb('#cfe8f5'), [14, 26, 24], NIEBLA[L]));
  ctx.globalAlpha = 0.8 * alpha; ctx.strokeStyle = agua; ctx.lineWidth = Math.max(1, 3 * sc); ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let k = 0; k < 9; k++) {
    const off = ((ahora() / 6 + k * 47) % 190) * sc, xx = x + (k - 4) * 6 * sc;
    ctx.moveTo(xx, top + off); ctx.lineTo(xx, Math.min(bottom - 6 * sc, top + off + 30 * sc));
  }
  ctx.stroke();
  ctx.globalAlpha = alpha;
  for (let k = 0; k < 6; k++) blob(x + (k - 2.5) * 12 * sc, bottom - 6 * sc + Math.sin(ahora() / 150 + k) * 2 * sc, (8 + (k % 2) * 4) * sc, agua);
  ctx.globalAlpha = 1;
}
