// HUD: lo que se dibuja encima del mundo (textos, barras, brújula...), pantalla de inicio, mapa, pasaporte,
// ajustes guardados, menú de Esc y créditos.

// ---------- Iconitos (centrados en x, y; "t" = tamaño aproximado en píxeles) ----------
function icono_sol(x, y, t) {
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2;
    linea_redonda(x + Math.cos(a) * t * 0.32, y + Math.sin(a) * t * 0.32, x + Math.cos(a) * t * 0.48, y + Math.sin(a) * t * 0.48, Math.max(1.5, t * 0.08), '#ffd34d');
  }
  blob(x, y, t * 0.24, '#ffd34d');
}
function icono_luna(x, y, t) { // media luna: arco de afuera y arco de adentro
  const r = t * 0.42;
  ctx.fillStyle = '#f2e7b0'; ctx.beginPath();
  ctx.arc(x, y, r, -PI / 2, PI / 2);
  ctx.ellipse(x, y, r * 0.45, r, 0, PI / 2, -PI / 2, true);
  ctx.fill();
}
function icono_nube(x, y, t, con_gotas) {
  const col = '#d9dee6';
  blob(x - t * 0.18, y, t * 0.2, col); blob(x + t * 0.05, y - t * 0.08, t * 0.26, col); blob(x + t * 0.26, y + t * 0.02, t * 0.17, col);
  rect(x - t * 0.18, y, t * 0.44, t * 0.18, col);
  if (con_gotas) for (let i = -1; i <= 1; i++) linea_redonda(x + i * t * 0.16, y + t * 0.3, x + i * t * 0.16 - t * 0.05, y + t * 0.44, Math.max(1.5, t * 0.07), '#7fb2ff');
}
// Rama chiquita (icono de la leña): centrada en x, y, girada a radianes
function icono_rama(x, y, a, k = 1) {
  const cs = Math.cos(a) * k, sn = Math.sin(a) * k;
  linea_redonda(x - 11 * cs, y - 11 * sn, x + 11 * cs, y + 11 * sn, 4 * k, '#6b4a2b');
  linea_redonda(x + 3 * cs, y + 3 * sn, x + 8 * cs + 6 * sn, y + 8 * sn - 6 * cs, 4 * k, '#6b4a2b');
}
// Corazón rojo de tamaño t, centrado en (x, y)
function corazon_dibujar(x, y, t) {
  const r = t * 0.28;
  blob(x - r * 0.95, y - r * 0.5, r, '#e0384a'); blob(x + r * 0.95, y - r * 0.5, r, '#e0384a');
  poligono([x - r * 1.9, y - r * 0.25, x + r * 1.9, y - r * 0.25, x, y + r * 2.1], '#e0384a');
}

// Barra con etiqueta (Energía, Fogata). k: tamaño (1 = normal; en el celular se achica, ver hud_k)
function barra(x, y, w, label, v, col, k = 1) {
  rect_redondo(x, y, w, 20 * k, 6 * k, '#000', 0.5);
  const ancho = Math.max(0, (w - 4 * k) * v / 100);
  if (ancho >= 1) rect_redondo(x + 2 * k, y + 2 * k, ancho, 16 * k, Math.min(5 * k, ancho / 2), col, 1);
  texto(x + 8 * k, y + 14 * k, label, fk(12, k), true, 'left', '#fff');
}
// Tamaño de letra con la escala k, sin bajar de 10 píxeles (más chico ya no se lee en el celular)
const fk = (px, k) => k === 1 ? px : Math.max(10, px * k);
// Escala del HUD: 1 en la computadora; en el celular, más chico (pero no tanto que no se lea)
const hud_k = () => tactil ? Math.max(0.75, tu() * 0.8) : 1;

// Recuadro oscuro con texto centrado (avisos y mensajes)
function pastilla(x, y, text, px, alpha) {
  const w = texto_ancho(text, px, true) + 20 + (px >= 17 ? 8 : 0);
  const h = px >= 17 ? 32 : 26, arriba = px >= 17 ? 22 : 18;
  rect_redondo(x - w / 2, y - arriba, w, h, px >= 17 ? 10 : 8, '#000', 0.6 * alpha);
  texto(x, y, text, px, true, 'center', '#fff', alpha);
}
// Mensaje que puede ocupar varios renglones (no más ancho que max_w), centrado en x; y es el primer renglón. Devuelve qué tan alto quedó.
function pastilla_varias(x, y, text, px, alpha, max_w) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (texto_ancho(t, px, true) > max_w && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  const lh = px * 1.35;
  const w = Math.max(...lines.map(l => texto_ancho(l, px, true))) + px * 1.4, h = lines.length * lh + px * 0.6;
  rect_redondo(x - w / 2, y - lh * 0.8 - px * 0.3, w, h, px * 0.6, '#000', 0.6 * alpha);
  lines.forEach((l, i) => texto(x, y + i * lh, l, px, true, 'center', '#fff', alpha));
  return h;
}
// Pantalla grande con título (ganar / perder)
// baja: cuánto se recorre hacia abajo (en pantallas angostas, para no chocar con la pregunta de los créditos)
function pantalla_final(titulo, lineas, baja = 0) {
  rect(0, 0, W, H, 'rgb(10,20,10)', 0.78);
  const k = Math.min(1, W / 760);
  texto(W / 2, H / 2 - 70 * k + baja, titulo, 46 * k, true, 'center', '#ffe9b0');
  lineas.forEach((l, i) => texto(W / 2, H / 2 - 10 * k + i * 32 * k + baja, l, Math.max(12, 19 * k), false, 'center', '#fff'));
}

let fps_n = 0, fps_t = 0, fps = 0;
function hud_dibujar() {
  // En la computadora todo va a tamaño normal (k = 1). En el celular se achica con k y se quita lo que
  // estorba (insignia, minimapa, lista de teclas): el mapa se abre con su botón.
  const k = hud_k();
  rect_redondo(12 * k, 12 * k, 236 * k + (tactil ? 16 : 0), 122 * k, 12 * k, '#000', 0.35);
  const h = hora(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  const txt = 'Día ' + dia_visible() + ' · ' + dos(hh) + ':' + dos(mm);
  texto(24 * k, 38 * k, txt, fk(16, k), true, 'left', '#fff');
  const ix = 24 * k + texto_ancho(txt, fk(16, k), true) + 16 * k;
  if (es_noche()) icono_luna(ix, 32 * k, 18 * k); else icono_sol(ix, 32 * k, 18 * k);
  if (rain) icono_nube(ix + 26 * k, 30 * k, 20 * k, true);

  barra(24 * k, 46 * k, 212 * k, 'Energía', energy, energy < 25 ? '#d9432f' : '#e0a23a', k);
  barra(24 * k, 72 * k, 212 * k, 'Fogata', fire.fuel, fire.fuel < 25 ? '#d9432f' : '#e8692a', k);
  icono_rama(34 * k, 114 * k, -0.3, k);
  // ración (un sándwich)
  rect_redondo(132 * k, 106 * k, 18 * k, 5 * k, 2 * k, '#d9a85a', 1); rect(133 * k, 111 * k, 16 * k, 3 * k, '#7a9a3a'); rect_redondo(132 * k, 114 * k, 18 * k, 5 * k, 2 * k, '#d9a85a', 1);
  texto(52 * k, 119 * k, 'Leña: ' + wood + '/' + WOOD_MAX, fk(14, k), false, 'left', '#fff');
  texto(156 * k, 119 * k, 'Raciones: ' + food + '/' + FOOD_MAX, fk(14, k), false, 'left', '#fff');

  // Insignia de la categoría (en el celular no: ya sabes cuál elegiste)
  if (!tactil) {
    const badge = cat.name + ' · ' + cat.diff, bw = texto_ancho(badge, 13, true) + 34;
    rect_redondo(12, 140, bw, 24, 12, '#000', 0.35);
    blob(26, 152, 6, cat.color);
    texto(38, 157, badge, 13, true, 'left', '#fff');
  }
  brujula_dibujar(k);

  if (state === 'play' && !reto && !prender && !canoa && !rescate && !rapel && !book && !mapa_abierto && !comiendo) {
    // Aviso de interacción
    const cerca = cerca_de_algo();
    if (cerca) pastilla(W / 2, H * (tactil ? 0.64 : 0.68), cerca.label, tactil ? fk(15, k) : 15, 1);
    if (!raton_capturado && !tactil) texto(W / 2, 30, 'Haz clic para mirar con el mouse', 14, true, 'center', '#fff', 0.85);
  }

  // Mensajes: en la computadora abajo; en el celular arriba en medio (abajo están los botones), en renglones cortos
  const nt = toasts.length;
  if (tactil) {
    // en la canoa, el agua y el rapel van más abajo (arriba están sus avisos y barras)
    let y = (canoa || rescate || rapel) ? 252 : H * 0.34;
    const px = fk(15, k);
    for (const t of toasts) y += pastilla_varias(W / 2, y, t.text, px, Math.min(1, t.t * 2), W * 0.5) + 6;
  } else toasts.forEach((t, i) => pastilla(W / 2, H - 40 - (nt - 1 - i) * 36, t.text, 17, Math.min(1, t.t * 2)));

  if (tactil) { if (ver_fps) texto(W - 12, H - 12, 'FPS ' + fps, 12, true, 'right', '#ff0'); return; }

  // Ayuda de controles (todas se pueden cambiar en el menú de Esc)
  const b = settings.binds, n = nombre_tecla;
  texto(14, H - 12, n(b.adelante) + '/' + n(b.atras) + ': caminar · ' + n(b.izquierda) + '/' + n(b.derecha)
    + ': girar · mouse: mirar · ' + n(b.correr) + ': correr · ' + n(b.usar) + ': usar · ' + n(b.comer) + ': ración · ' + n(b.mapa) + ': pasaporte'
    + (cat.hint === 'ruta' ? ' · ' + n(b.reto) + ': reto · ' + n(b.marcar) + ': marcar · ' + n(b.libreta) + ': libreta' : '')
    + ' · Esc: menú', 12, false, 'left', '#fff', 0.7);
  minimapa_dibujar();
  if (ver_fps) texto(W - 12, H - 220, 'FPS ' + fps, 14, true, 'right', '#ff0');
}

// ---------- Brújula ----------
// Arriba es hacia donde miras: las letras giran contigo y la aguja roja siempre apunta al frente.
// Debajo van las pistas: rumbo (Caminante y Rover), pasos (Rover), a dónde ir y cuántas bases llevas.
function brujula_dibujar(k = 1) {
  const R = 62 * k, cx = W - R - 22 * k, cy = R + 22 * k, tg = target(), borde = '#8e7a4a';
  blob(cx, cy, R + 6 * k, '#d8cfb4'); blob(cx, cy, R + 1 * k, borde); blob(cx, cy, R - 1 * k, '#f4efe0');
  const vista = -player.ang - PI / 2; // dirección del mundo -> ángulo en la brújula
  [['N', -PI / 2], ['S', PI / 2], ['E', 0], ['O', PI]].forEach(([l, a0], i) => {
    const a = a0 + vista;
    texto(cx + Math.cos(a) * (R - 13 * k), cy + Math.sin(a) * (R - 13 * k) + 5 * k, l, fk(14, k), true, 'center', i === 0 ? '#c0392b' : '#333');
  });
  ctx.strokeStyle = borde; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.283 + vista, r2 = R - (i % 4 ? 7 : 1) * k;
    ctx.moveTo(cx + Math.cos(a) * (R - 4 * k), cy + Math.sin(a) * (R - 4 * k)); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
  }
  ctx.stroke();
  poligono([cx, cy - R - 9 * k, cx - 6 * k, cy - R - 1 * k, cx + 6 * k, cy - R - 1 * k], borde); // marca de "al frente"
  // aguja: roja hacia el frente (arriba), gris hacia atrás
  poligono([cx, cy - (R - 20 * k), cx - 6 * k, cy, cx + 6 * k, cy], '#c0392b');
  poligono([cx, cy + (R - 26 * k), cx - 6 * k, cy, cx + 6 * k, cy], '#555');
  blob(cx, cy, 4 * k, '#222');

  // Pistas: en la computadora debajo de la brújula; en el celular a su izquierda (abajo están los botones)
  const pistas = [];
  if (cat.hint === 'grados' || cat.hint === 'ruta') pistas.push('Rumbo: ' + bearing_of_angle(player.ang) + '°');
  if (cat.hint === 'ruta') { const ref = cur_ref(); if (ref) pistas.push('Pasos ' + con_art('desde', ref) + ': ' + steps_from(ref)); }
  pistas.push('Ve a: ' + tg.name);
  if (tg.hint) pistas.push(tg.hint);
  const bases = 'Bases: ' + bases_hechas() + '/' + NUM_FLAGS;
  if (tactil) {
    pistas.push(bases);
    const px = fk(13, k), paso = px + 13, xr = cx - R - 14 * k;
    let py = 12 * k + px + 4;
    for (const p of pistas) {
      const w = texto_ancho(p, px, true) + 16;
      rect_redondo(xr - w, py - px - 4, w, px + 10, 7, '#000', 0.55);
      texto(xr - w / 2, py, p, px, true, 'center', '#fff');
      py += paso;
    }
    return;
  }
  let py = cy + R + 29;
  for (const p of pistas) { pastilla_brujula(cx, py, p); py += 28; }
  texto(cx, py - 1, bases, 13, true, 'center', '#fff');
}
// Pastilla centrada bajo la brújula, sin salirse por la derecha
function pastilla_brujula(cx, y, text) {
  const w = texto_ancho(text, 13, true) + 20, x = Math.min(cx - w / 2, W - 12 - w);
  rect_redondo(x, y - 17, w, 24, 8, '#000', 0.55);
  texto(x + w / 2, y, text, 13, true, 'center', '#fff');
}

// Nombre corto de una tecla para mostrarlo en pantalla
function nombre_tecla(k) {
  const n = { ' ': 'Espacio', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', shift: 'Shift', control: 'Ctrl', alt: 'Alt',
    tab: 'Tab', enter: 'Enter', backspace: 'Borrar', insert: 'Insert', delete: 'Supr', home: 'Inicio', end: 'Fin', pageup: 'RePág', pagedown: 'AvPág', capslock: 'Mayús' }[k];
  return n || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));
}

// ---------- Pantalla de inicio: elegir la categoría (dificultad) ----------
// La cámara da vueltas alrededor de la fogata mientras eliges.
let titulo_hits = [];
function ir_al_titulo() {
  if (!mundo_sin_usar) { player = null; mundo_generar(20261101); mundo_sin_usar = true; }
  player = { x: camp.x, y: camp.y + 90, ang: -1.57, pitch: 0, step: 0, moving: false, place: null, alt: 0 };
  monte_modo = ''; cuerda = -1; rapel = null;
  fire = { fuel: 70, lit: true }; prender = null; chaleco = false; canoa = null; rescate = null; time = 0.1; day = 1; rain = false; drops = []; toasts = [];
  energy = 100; wood = 0; food = 0;
  reto = null; book = false; reveal = null; mapa_abierto = false; pas_tab = 0;
  comedor_reiniciar();
  titulo_hits = [];
  soltar_raton();
  state = 'title';
}
function elegir_categoria(i) {
  settings.cat = clamp(i, 0, CATEGORIES.length - 1);
  cat = CATEGORIES[settings.cat];
  ajustes_guardar();
}
function titulo_actualizar() {
  const t = ahora() / 9000;
  player.x = camp.x + Math.cos(t) * 190; player.y = camp.y + Math.sin(t) * 190; player.ang = t + PI; player.pitch = 0;
  if (kp('enter')) { empezar_juego(); return; }
  if (kp('arrowleft') || kp('a')) elegir_categoria(settings.cat - 1);
  if (kp('arrowright') || kp('d')) elegir_categoria(settings.cat + 1);
  for (let k = 0; k < 4; k++) if (kp(String(k + 1))) elegir_categoria(k);
  if (kp('m') || kp('tab')) { settings.modo = 1 - settings.modo; ajustes_guardar(); }
  if (toque_pulsado()) for (const h of titulo_hits) if (toque_dentro(h)) {
    if (h.modo !== undefined) { settings.modo = h.modo; ajustes_guardar(); return; }
    // clic en una tarjeta la elige; clic en la ya elegida (o en Empezar) arranca
    if (h.cat < 0 || h.cat === settings.cat) empezar_juego(); else elegir_categoria(h.cat);
    return;
  }
}
// Camisa de uniforme vista de frente (para las tarjetas de categoría)
function dibujar_uniforme(x, y, k, col) {
  const p = (lista, c, a = 1) => { const pts = []; for (let i = 0; i < lista.length; i += 2) pts.push(x + lista[i] * k, y + lista[i + 1] * k); poligono(pts, c, a); };
  p([-22, -30, 22, -30, 26, -4, 26, 34, -26, 34, -26, -4], col);
  p([-22, -30, -26, -4, -36, 2, -44, -18], col);
  p([22, -30, 44, -18, 36, 2, 26, -4], col);
  rect(x - 2 * k, y - 26 * k, 4 * k, 60 * k, '#000', 0.15); // botones / abertura y bolsillos
  rect(x - 20 * k, y - 8 * k, 12 * k, 9 * k, '#000', 0.15);
  rect(x + 8 * k, y - 8 * k, 12 * k, 9 * k, '#000', 0.15);
  p([-22, -30, 22, -30, 0, 4], '#f2ead6'); // pañoleta
  blob(x, y - 16 * k, 4 * k, '#8e6f40'); // anillo
}
function titulo_dibujar() {
  rect(0, 0, W, H, 'rgb(10,20,10)', 0.72);
  const s = Math.min(1, W / 920, H / 620), ox = W / 2, oy = H / 2;
  titulo_hits = [];
  texto(ox, oy - 235 * s, 'Scouteando en Puebla', 46 * s, true, 'center', '#ffe9b0');
  texto(ox, oy - 198 * s, 'Explora el bosque, completa los retos de las 5 bases, mantén viva la fogata y no te pierdas las comidas.', 17 * s, false, 'center', '#fff');
  texto(ox, oy - 150 * s, 'Elige tu categoría', 20 * s, true, 'center', '#ffe9b0');
  CATEGORIES.forEach((c, i) => {
    const sel = i === settings.cat;
    const x = ox + (-430 + i * 220) * s, y = oy - 125 * s, w = 200 * s, h = 270 * s, cx = x + w / 2;
    if (sel) { rect_redondo(x, y, w, h, 14 * s, 'rgb(255,240,200)', 0.18); borde_redondo(x, y, w, h, 14 * s, c.color, 1, 4 * s); }
    else { rect_redondo(x, y, w, h, 14 * s, '#000', 0.35); borde_redondo(x, y, w, h, 14 * s, '#fff', 0.15, 2 * s); }
    dibujar_uniforme(cx, y + 62 * s, 1.1 * s, c.color);
    texto(cx, y + 132 * s, c.name, 20 * s, true, 'center', '#fff');
    texto(cx, y + 156 * s, c.diff, 15 * s, true, 'center', c.color);
    c.desc.forEach((d, j) => texto(cx, y + (188 + j * 19) * s, d, 13 * s, false, 'center', '#fff', 0.8));
    texto(x + 14 * s, y + 20 * s, String(i + 1), 12 * s, false, 'center', '#fff', 0.4);
    titulo_hits.push({ x, y, w, h, cat: i });
  });
  // Modalidad (cuánto dura el día) y Empezar
  const by = oy + 172 * s;
  MODOS.forEach((m, i) => {
    const mx = ox + (-430 + i * 205) * s, sel = i === settings.modo, mw = 195 * s;
    rect_redondo(mx, by, mw, 46 * s, 12 * s, sel ? '#ffe9b0' : '#000', sel ? 1 : 0.35);
    if (!sel) borde_redondo(mx, by, mw, 46 * s, 12 * s, '#fff', 0.2, 2 * s);
    texto(mx + mw / 2, by + 21 * s, m.name, 17 * s, true, 'center', sel ? '#1a1a1a' : '#fff');
    texto(mx + mw / 2, by + 38 * s, m.desc, 12 * s, false, 'center', sel ? '#3a2a14' : '#fff', sel ? 1 : 0.7);
    titulo_hits.push({ x: mx, y: by, w: mw, h: 46 * s, modo: i });
  });
  const bx = ox + 10 * s;
  rect_redondo(bx, by, 420 * s, 46 * s, 12 * s, cat.color, 1);
  texto(bx + 210 * s, oy + 202 * s, 'Empezar', 20 * s, true, 'center', '#1a1a1a');
  titulo_hits.push({ x: bx, y: by, w: 420 * s, h: 46 * s, cat: -1 });
  texto(ox, oy + 245 * s, tactil ? 'Toca una categoría y una modalidad, y luego Empezar' : 'A/D, flechas o 1-4: categoría · M: modalidad · ENTER: empezar', Math.max(11, 14 * s), false, 'center', '#fff', 0.7);
}

// ---------- Mapa del bosque ----------
// Como un mapa de papel: no marca dónde estás ni las banderas. Se dibuja una sola vez por bosque.
const MAP = 180, MAP_RES = 700;
const mapa_cv = document.createElement('canvas'); mapa_cv.width = mapa_cv.height = MAP_RES;
const mapa_mini = document.createElement('canvas'); mapa_mini.width = mapa_mini.height = MAP;
function mapa_construir() {
  const g = mapa_cv.getContext('2d'), k = MAP_RES / WORLD;
  const circ = (x, y, r, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(x * k, y * k, Math.max(0.6, r * k), 0, 7); g.fill(); g.globalAlpha = 1; };
  g.fillStyle = '#86ad60'; g.fillRect(0, 0, MAP_RES, MAP_RES);
  for (const l of landmarks) {
    if (l.kind === 'pinar') circ(l.x, l.y, l.r, '#5d8a4a');
    if (l.kind === 'claro') circ(l.x, l.y, l.r, '#b9d482');
  }
  for (const t of trees) circ(t.x, t.y, t.canopy, t.pine ? 'rgb(25,65,35)' : 'rgb(45,85,30)', t.pine ? 0.5 : 0.45);
  for (const o of lake_water) circ(o.x, o.y, o.r + 12, '#8f8259');
  for (const o of lake_water) circ(o.x, o.y, o.r, '#3f86b3');
  if (montana) { // cerro: del pie (verde) a la cima (gris), sendero (rojo en los pasos angostos) y rapel
    const mt = montana;
    for (let kk = mt.K; kk >= 0; kk--) {
      g.fillStyle = css(mezclar_rgb(hex_rgb('#6d8a4c'), hex_rgb('#a39d92'), 1 - kk / mt.K));
      g.beginPath();
      mt.v[kk].forEach((p, j) => j ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k));
      g.fill();
    }
    for (let ss = 0; ss <= mt.largo; ss += 18) { const p = monte_en_camino(ss, 0, -1); circ(p.x, p.y, 13, monte_angosto_en(ss) >= 0 ? '#b0443a' : '#e0cf9a'); }
    circ(mt.rapel.x, mt.rapel.y, 20, '#3a2a14');
  }
  if (cascada) circ(cascada.x, cascada.y - cascada.r, 60, '#8b8d88');
  if (comedor) { // comedor: techo gris con el porche café
    const c = comedor;
    g.fillStyle = '#8a6a48'; g.fillRect(c.x0 * k, c.y1 * k, (c.x1 - c.x0) * k, c.porche * k);
    g.fillStyle = '#9a9fa4'; g.fillRect(c.x0 * k, c.y0 * k, (c.x1 - c.x0) * k, (c.y1 - c.y0) * k);
    g.fillStyle = '#b98f62'; g.fillRect((c.x - 34) * k, (camp.y + 215) * k, 68 * k, (c.y0 - camp.y - 215) * k);
  }
  for (const m of muelles) for (let j = 0; j <= 5; j++) { const d = m.w + 45 - j * 21; circ(m.cx + m.ox * d, m.cy + m.oy * d, 16, '#6b4a2b'); }
  for (const r of rocks) circ(r.x, r.y, r.r, '#8b8d88');
  circ(camp.x, camp.y, 230, '#b39b62');
  for (const t of tents) circ(t.x, t.y, 34, t.color);
  circ(camp.x, camp.y, 30, '#e8692a');
  for (const arbol of landmarks.filter(l => l.kind === 'arbol')) { circ(arbol.x, arbol.y, 135, '#2d5a26'); circ(arbol.x - 30, arbol.y - 30, 60, '#3f7a33'); }
  g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 6; g.strokeRect(0, 0, MAP_RES, MAP_RES); // marco
  // copia ya achicada para el minimapa (se ve más suave que achicar el grande en cada cuadro)
  const m = mapa_mini.getContext('2d');
  m.imageSmoothingQuality = 'high';
  m.drawImage(mapa_cv, 0, 0, MAP, MAP);
}
// Dibuja el mapa en pantalla con los nombres de los lugares
function mapa_dibujar_en(x0, y0, size) {
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mapa_cv, x0, y0, size, size);
  const k = size / WORLD, px = Math.round(size / 42);
  for (const l of landmarks) {
    const x = clamp(x0 + l.x * k, x0 + 70, x0 + size - 70);
    const y = Math.max(y0 + 18, y0 + l.y * k - (l.kind === 'pinar' ? 0 : l.r * k + 8));
    texto_borde(x, y, l.name, px, '#3a2a14', 'rgb(255,250,235)');
  }
  // nombres de los ríos (en azul, encima del agua)
  for (const r of rios) {
    const x = clamp(x0 + r.etq[0] * k, x0 + 70, x0 + size - 70), y = clamp(y0 + r.etq[1] * k, y0 + 18, y0 + size - 10);
    texto_borde(x, y, r.name, px, '#173f63', 'rgb(255,250,235)');
  }
}
// Una punta de la rosa de los vientos: mitad clara y mitad oscura
function rosa_punta(cx, cy, ang, len, w, claro, oscuro) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const tx = cx + len * sn, ty = cy - len * cs;
  poligono([tx, ty, cx - w * cs, cy - w * sn, cx, cy], claro);
  poligono([tx, ty, cx + w * cs, cy + w * sn, cx, cy], oscuro);
}
// Rosa de los vientos (el norte del mapa siempre está arriba). Con letras solo si es grande.
function rosa_vientos(cx, cy, r, letras) {
  const g = Math.max(1, r / 30);
  blob(cx, cy, r * 0.62 + g / 2, '#8e7a4a'); blob(cx, cy, r * 0.62 - g / 2, 'rgb(244,239,224)');
  for (let i = 0; i < 4; i++) rosa_punta(cx, cy, PI / 4 + i * PI / 2, r * 0.62, r * 0.14, '#cdbf98', '#8e7a4a');
  for (let i = 0; i < 4; i++) rosa_punta(cx, cy, i * PI / 2, r, r * 0.2, i === 0 ? '#e0584a' : '#efe6cc', i === 0 ? '#a52a1e' : '#5a4a2a');
  blob(cx, cy, Math.max(1.5, r * 0.07), '#5a4a2a');
  if (letras) {
    const px = Math.round(r * 0.36), d = r + r * 0.28;
    [['N', 0, -d], ['S', 0, d], ['E', d, 0], ['O', -d, 0]].forEach(([l, dx, dy], i) => texto(cx + dx, cy + dy + px * 0.36, l, px, true, 'center', i === 0 ? '#c0392b' : '#333'));
  }
}
// Minimapa (abajo a la derecha). Con M o con un clic se hace grande.
const mini_x = () => W - MAP - 18, mini_y = () => H - MAP - 18;
const raton_en_minimapa = () => raton.x >= mini_x() && raton.x <= mini_x() + MAP && raton.y >= mini_y() && raton.y <= mini_y() + MAP;
function minimapa_dibujar() {
  const x0 = mini_x(), y0 = mini_y();
  rect_redondo(x0 - 6, y0 - 6, MAP + 12, MAP + 12, 10, '#d8cfb4', 1);
  ctx.drawImage(mapa_mini, x0, y0);
  rosa_vientos(x0 + 20, y0 + 20, 15, false);
  rect_redondo(x0 + MAP / 2 - 52, y0 + MAP - 22, 104, 18, 6, '#000', 0.6);
  texto(x0 + MAP / 2, y0 + MAP - 9, '[' + nombre_tecla(settings.binds.mapa) + '] pasaporte', 11, true, 'center', '#fff');
}
// ---------- Pasaporte (con M): Mapa, Sellos de las bases y Horarios del comedor ----------
// Como el pasaporte de los camporees. El juego se pausa mientras lo ves.
let pas_tab = 0, pas_hits = [], pas_panel = { x: 0, y: 0, w: 0, h: 0 };
const PAS_TABS = ['Mapa', 'Sellos', 'Horarios'];
const SELLO_COLORES = ['#c0392b', '#2a6fb0', '#2e8b3a', '#8e44ad', '#d9813b'];
function pasaporte_actualizar() {
  if (kp(settings.binds.mapa) || kp('escape')) { mapa_abierto = false; return; }
  for (let k = 0; k < PAS_TABS.length; k++) if (kp(String(k + 1))) pas_tab = k;
  if (kp('arrowright') || kp('tab') || kp(settings.binds.derecha)) pas_tab = (pas_tab + 1) % PAS_TABS.length;
  if (kp('arrowleft') || kp(settings.binds.izquierda)) pas_tab = (pas_tab + PAS_TABS.length - 1) % PAS_TABS.length;
  if (toque_pulsado()) {
    for (const h of pas_hits) if (toque_dentro(h)) { if (h.act === 'tab') pas_tab = h.arg; else mapa_abierto = false; return; }
    if (!toque_dentro(pas_panel)) mapa_abierto = false; // tocar afuera lo cierra
  }
}
function pasaporte_dibujar() {
  rect(0, 0, W, H, '#000', 0.7);
  const pw = Math.min(W - 12, 860), ph = Math.min(H - 12, 640), x0 = (W - pw) / 2, y0 = (H - ph) / 2;
  const k = Math.min(1, pw / 760, ph / 560); // en pantallas chicas todo se achica
  pas_panel = { x: x0, y: y0, w: pw, h: ph }; pas_hits = [];
  panel_borde(x0, y0, pw, ph, 16 * k, '#f4ecd2', '#2f5a3a', 5 * k);
  const cafe = '#3a2a14', gris = '#6b5a3a';
  texto(x0 + 22 * k, y0 + 34 * k, 'Pasaporte scout', 22 * k, true, 'left', '#2f5a3a');
  texto(x0 + pw - 22 * k, y0 + 34 * k, cat.name + ' · ' + MODOS[settings.modo].name, 14 * k, true, 'right', gris);
  // pestañas
  const tw = Math.min(170 * k, (pw - 40 * k) / 3), th = 34 * k, ty = y0 + 48 * k;
  PAS_TABS.forEach((t, i) => {
    const tx = x0 + 20 * k + i * (tw + 8 * k), sel = i === pas_tab;
    rect_redondo(tx, ty, tw, th, 9 * k, sel ? '#2f5a3a' : '#d8cfb4', 1);
    texto(tx + tw / 2, ty + th / 2 + 6 * k, (tactil ? '' : (i + 1) + '. ') + t, 16 * k, true, 'center', sel ? '#fff' : cafe);
    pas_hits.push({ x: tx, y: ty, w: tw, h: th, act: 'tab', arg: i });
  });
  // botón de cerrar (para el celular; en la compu también sirve)
  const cw = 40 * k;
  rect_redondo(x0 + pw - cw - 14 * k, ty, cw, th, 9 * k, '#c0392b', 1);
  texto(x0 + pw - cw / 2 - 14 * k, ty + th / 2 + 7 * k, 'X', 18 * k, true, 'center', '#fff');
  pas_hits.push({ x: x0 + pw - cw - 14 * k, y: ty, w: cw, h: th, act: 'cerrar' });
  const ax = x0 + 20 * k, ay = ty + th + 12 * k, aw = pw - 40 * k, ah = ph - (ay - y0) - 34 * k;
  if (pas_tab === 0) pasaporte_mapa(ax, ay, aw, ah);
  else if (pas_tab === 1) pasaporte_sellos(ax, ay, aw, ah, k);
  else pasaporte_horarios(ax, ay, aw, ah, k);
  texto(W / 2, y0 + ph - 12 * k, tactil ? 'Toca una pestaña · toca afuera o la X para cerrar'
    : '1-3 o flechas: cambiar de hoja · ' + nombre_tecla(settings.binds.mapa) + ' o Esc: cerrar', 13 * k, false, 'center', gris);
}
function pasaporte_mapa(ax, ay, aw, ah) {
  const size = Math.min(aw, ah), x = ax + (aw - size) / 2;
  rect_redondo(x - 5, ay - 5, size + 10, size + 10, 8, '#d8cfb4', 1);
  mapa_dibujar_en(x, ay, size);
  rosa_vientos(x + size * 0.09, ay + size * 0.09, size * 0.06, size > 300);
}
// Un sello redondo (girado), como los que ponen en cada base
function sello_dibujar(cx, cy, r, f) {
  const col = SELLO_COLORES[(f.n - 1) % SELLO_COLORES.length];
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.2 + f.n * 0.09);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, r * 0.08); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.03); ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
  texto(0, -r * 0.3, 'BASE ' + f.n, r * 0.3, true, 'center', col, 0.9);
  texto(0, r * 0.08, f.sello ? f.sello.clave : '', r * 0.17, true, 'center', col, 0.9);
  texto(0, r * 0.4, f.sello ? 'Día ' + f.sello.dia + ' · ' + f.sello.hora : '', r * 0.15, false, 'center', col, 0.9);
  ctx.restore();
}
function pasaporte_sellos(ax, ay, aw, ah, k) {
  const cafe = '#3a2a14', gris = '#6b5a3a';
  texto(ax + aw / 2, ay + 22 * k, 'Sellos de las bases: ' + bases_hechas() + ' de ' + NUM_FLAGS, 18 * k, true, 'center', cafe);
  const cols = 3, rows = 2, cw = aw / cols, rh = (ah - 40 * k) / rows, r = Math.min(cw, rh) * 0.36;
  flags.forEach((f, i) => {
    const row = i < 3 ? 0 : 1, col = row === 0 ? i : i - 3 + 0.5;
    const cx = ax + (col + 0.5) * cw, cy = ay + 40 * k + (row + 0.5) * rh;
    if (f.done) sello_dibujar(cx, cy, r, f);
    else {
      ctx.setLineDash([6, 6]); circulo(cx, cy, r, '#b8a98a', 1, true, 2); ctx.setLineDash([]);
      texto(cx, cy - r * 0.05, 'Base ' + f.n, r * 0.26, true, 'center', '#b8a98a');
      texto(cx, cy + r * 0.3, 'sin sello', r * 0.17, false, 'center', '#b8a98a');
    }
  });
  if (!bases_hechas()) texto(ax + aw / 2, ay + ah - 6 * k, 'Resuelve el reto de cada base para que te pongan su sello.', 14 * k, false, 'center', gris);
}
function pasaporte_horarios(ax, ay, aw, ah, k) {
  const cafe = '#3a2a14', gris = '#6b5a3a', verde = '#2e8b3a', h = hora();
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  texto(ax + aw / 2, ay + 22 * k, 'Horarios del comedor', 20 * k, true, 'center', cafe);
  texto(ax + aw / 2, ay + 46 * k, 'Ahora: día ' + dia_visible() + ', ' + hh + ':' + dos(mm) + ' · Modalidad ' + MODOS[settings.modo].name + ' (' + MODOS[settings.modo].desc.toLowerCase() + ')', 14 * k, false, 'center', gris);
  const actual = comida_actual();
  const fh = Math.min(74 * k, (ah - 170 * k) / 3);
  COMIDAS.forEach((c, i) => {
    // de madrugada ya se ven las comidas del día que empieza (las del juego cambian a las 6:00)
    const clave = (h < 6 ? day + 1 : day) + '-' + i;
    const y = ay + 62 * k + i * (fh + 8 * k), ya = comidas_comidas.has(clave), servida = comidas_hechas.has(clave);
    const ahora_si = i === actual;
    rect_redondo(ax, y, aw, fh, 10 * k, ahora_si ? '#dcefd2' : '#ebe2c8', 1);
    texto(ax + 16 * k, y + fh * 0.42, c.name, 19 * k, true, 'left', cafe);
    texto(ax + 16 * k, y + fh * 0.78, hora_txt(c.ini) + ' a ' + hora_txt(c.fin) + ' · ' + c.menu, 14 * k, false, 'left', gris);
    let est, col;
    if (ya) { est = 'Ya comiste'; col = verde; }
    else if (servida) { est = 'Te sirvieron: siéntate a comer'; col = '#b07a10'; }
    else if (ahora_si) { est = '¡Ahora! Ve al comedor'; col = '#c0392b'; }
    else if (h >= c.fin && h >= 6) { est = 'Ya pasó'; col = '#9a8a6a'; }
    else { est = 'Más tarde'; col = gris; }
    texto(ax + aw - 16 * k, y + fh * 0.55, est, 15 * k, true, 'right', col);
  });
  const notas = ['Fuera de horario solo te dan algo chico (fruta y pan).',
    'En la ventanilla de Agua y raciones te dan 2 raciones para el camino (caben ' + RACIONES_MAX + ').',
    'Antes de salir, deja tu charola en Devolución.'];
  const ny = ay + 62 * k + 3 * (fh + 8 * k) + 18 * k;
  notas.forEach((n, i) => texto(ax + 10 * k, ny + i * 22 * k, '• ' + n, 14 * k, false, 'left', cafe));
}

// ---------- Ajustes guardados (en este navegador) ----------
function ajustes_guardar() { try { localStorage.setItem('scout_ajustes', JSON.stringify(settings)); } catch (e) { /* no se pudo guardar: no pasa nada */ } }
function ajustes_cargar() {
  try {
    const s = JSON.parse(localStorage.getItem('scout_ajustes') || 'null');
    if (!s) return;
    const num = v => typeof v === 'number' && isFinite(v);
    if (num(s.sens)) settings.sens = clamp(Math.round(s.sens), 1, 10);
    if (num(s.giro)) settings.giro = clamp(Math.round(s.giro), 1, 10);
    if (s.invert !== undefined) settings.invert = !!s.invert;
    if (num(s.musica)) settings.musica = clamp(Math.round(s.musica), 0, 10);
    if (num(s.cat)) settings.cat = clamp(Math.round(s.cat), 0, CATEGORIES.length - 1);
    if (num(s.modo)) settings.modo = clamp(Math.round(s.modo), 0, MODOS.length - 1);
    if (s.botones && typeof s.botones === 'object') // dónde pusiste cada botón del celular
      for (const id in s.botones) {
        const c = s.botones[id];
        if (boton_def(id) && c && num(c.x) && num(c.y) && num(c.k)) settings.botones[id] = { x: clamp(c.x, 0, 1), y: clamp(c.y, 0, 1), k: clamp(c.k, 0.6, 1.8) };
      }
    if (s.binds) for (const a of BIND_ORDER) if (typeof s.binds[a] === 'string' && s.binds[a]) settings.binds[a] = s.binds[a];
  } catch (e) { /* ajustes dañados: se usan los de siempre */ }
}
// Si la tecla nueva ya la usaba otra acción, se intercambian
function cambiar_tecla(accion, k) {
  for (const a of BIND_ORDER) if (a !== accion && settings.binds[a] === k) settings.binds[a] = settings.binds[accion];
  settings.binds[accion] = k;
  ajustes_guardar();
}

// ---------- Menú de Esc (el juego se pausa) ----------
let menu_hits = [], esperando_tecla = null, confirmar_salida = false, arrastre = null, menu_abierto_en = 0;
function abrir_menu() {
  state = 'menu'; esperando_tecla = null; confirmar_salida = false; arrastre = null;
  menu_abierto_en = ahora();
  soltar_raton();
}
function cerrar_menu() { state = 'play'; esperando_tecla = null; confirmar_salida = false; arrastre = null; }
function menu_slider_valor(h, mx) {
  settings[h.arg] = clamp(Math.round(h.vmin + (mx - h.bx) / h.bw * (10 - h.vmin)), h.vmin, 10);
  if (h.arg === 'musica') musica_volumen();
}
function menu_actualizar() {
  // esperando la tecla nueva para un control
  if (esperando_tecla && teclas_pulsadas.size) {
    if (tecla_ultima !== 'escape') cambiar_tecla(esperando_tecla, tecla_ultima);
    esperando_tecla = null;
    teclas_abajo.clear(); teclas_pulsadas.clear();
    return;
  }
  if (kp('escape')) {
    if (confirmar_salida) confirmar_salida = false;
    else if (ahora() - menu_abierto_en > 300) cerrar_menu();
    return;
  }
  // barrita que se está arrastrando (con el mouse o con el dedo que la agarró)
  if (arrastre) {
    const p = punteros.get(arrastre.dedo);
    if (p && p.abajo) menu_slider_valor(arrastre, p.x);
    else { arrastre = null; ajustes_guardar(); }
    return;
  }
  if (!toque_pulsado()) return;
  for (const h of menu_hits) {
    if (!toque_dentro(h)) continue;
    switch (h.act) {
      case 'continuar': cerrar_menu(); if (!tactil) capturar_raton(); break; // en la computadora se vuelve a mirar con el mouse
      case 'botones': editor_abrir(); break;
      case 'salir': confirmar_salida = true; esperando_tecla = null; break;
      case 'si_salir': ir_al_titulo(); break;
      case 'cancelar': confirmar_salida = false; break;
      case 'slider': menu_slider_valor(h, toque_px); arrastre = Object.assign({}, h, { dedo: toque_dedo }); break;
      case 'invertir': settings.invert = !settings.invert; ajustes_guardar(); break;
      case 'tecla': esperando_tecla = h.arg; break;
      case 'restablecer': settings.binds = { ...DEFAULT_BINDS }; esperando_tecla = null; ajustes_guardar(); break;
    }
    return;
  }
}
// Botón del menú (coordenadas del panel, con el centro de la pantalla en 0,0)
function menu_boton(x, y, w, h, text, act, arg, activo, col) {
  rect_redondo(rx(x), ry(y), w * reto_s, h * reto_s, 9 * reto_s, col || (activo ? '#e0a23a' : '#4a5f45'), 1);
  let f = 16;
  while (texto_ancho(text, f * reto_s, true) > (w - 12) * reto_s && f > 9) f--;
  rtexto(x + w / 2, y + h / 2 + 6, text, f, true, 'center', activo ? '#222' : '#fff');
  menu_hits.push({ x: rx(x), y: ry(y), w: w * reto_s, h: h * reto_s, act, arg });
}
// lx: donde va el nombre; bx, bw: dónde empieza y qué tan larga es la barrita; vmin: valor más bajo
function menu_slider(label, y, clave, lx = -300, bx = -60, bw = 300, vmin = 1) {
  rtexto(lx, y + 5, label, 15, false, 'left', '#fff');
  const v = settings[clave], px = bx + (v - vmin) / (10 - vmin) * bw;
  rect_redondo(rx(bx), ry(y - 5), bw * reto_s, 10 * reto_s, 5 * reto_s, '#1a241b', 1);
  rect_redondo(rx(bx), ry(y - 5), (px - bx) * reto_s, 10 * reto_s, 5 * reto_s, '#e0a23a', 1);
  blob(rx(px), ry(y), 11 * reto_s, '#e0a23a');
  rtexto(bx + bw + 22, y + 5, String(v), 15, false, 'left', '#fff');
  menu_hits.push({ x: rx(bx - 12), y: ry(y - 16), w: (bw + 24) * reto_s, h: 32 * reto_s, act: 'slider', arg: clave, bx: rx(bx), bw: bw * reto_s, vmin });
}
function menu_dibujar() {
  rect(0, 0, W, H, 'rgb(8,16,12)', 0.78);
  // en el celular el menú es más corto (no trae la lista de teclas), así que cabe más grande
  const alto = tactil ? 450 : 620;
  reto_s = tactil ? Math.min(1.2, (H - 10) / alto, (W - 10) / 680) : Math.min(1, H / 660, W / 700);
  reto_ox = W / 2; reto_oy = H / 2 + (tactil ? 85 * reto_s : 0);
  menu_hits = [];
  panel_borde(rx(-330), ry(-310), 660 * reto_s, alto * reto_s, 18 * reto_s, '#2a3a2c', '#8e7a4a', 3 * reto_s);
  const crema = '#ffe9b0';
  rtexto(0, -265, 'Menú', 30, true, 'center', crema);
  menu_boton(-230, -245, 220, 40, 'Continuar', 'continuar', null, false);
  menu_boton(10, -245, 220, 40, 'Salir al menú', 'salir', null, false, '#c0392b');
  rtexto(-300, -170, 'Sensibilidad', 18, true, 'left', crema);
  menu_slider(tactil ? 'Mirar con el dedo' : 'Mouse', -138, 'sens');
  if (!tactil) menu_slider('Girar con teclado', -100, 'giro');
  rtexto(-300, -57, 'Invertir arriba/abajo', 15, false, 'left', '#fff');
  menu_boton(-60, -78, 90, 30, settings.invert ? 'Sí' : 'No', 'invertir', null, settings.invert);
  menu_slider('Música', -62, 'musica', 80, 160, 120, 0);

  if (tactil) { // en el celular: en vez de las teclas, acomodar los botones
    rtexto(-300, -10, 'Botones en pantalla', 18, true, 'left', crema);
    rtexto(-300, 24, 'Puedes moverlos y cambiarles el tamaño.', 15, false, 'left', '#fff');
    menu_boton(-150, 50, 300, 50, 'Acomodar botones', 'botones', null, false);
    menu_confirmar_salida(crema);
    return;
  }
  rtexto(-300, -10, 'Controles', 18, true, 'left', crema);
  rtexto(300, -10, 'Haz clic en una tecla y luego pulsa la nueva', 13, false, 'right', '#fff', 0.7);
  BIND_ORDER.forEach((a, i) => {
    const col = i < 7 ? -300 : 10, y = 8 + (i % 7) * 31, espera = esperando_tecla === a;
    rtexto(col, y + 20, BIND_NAMES[a], 14, false, 'left', '#fff');
    menu_boton(col + 180, y, 100, 30, espera ? '...' : nombre_tecla(settings.binds[a]), 'tecla', a, espera);
  });
  menu_boton(-120, 232, 240, 34, 'Restablecer controles', 'restablecer', null, false);
  rtexto(0, 280, esperando_tecla ? 'Pulsa la tecla nueva (Esc para cancelar)' : 'Esc: volver al juego', 14, false, 'center', '#fff', 0.75);
  menu_confirmar_salida(crema);
}
// Ventanita "¿Salir al menú?" encima del menú: tapa el resto y solo deja estos dos botones
function menu_confirmar_salida(crema) {
  if (!confirmar_salida) return;
  menu_hits = [];
  rect(0, 0, W, H, '#000', 0.55);
  panel_borde(rx(-220), ry(-95), 440 * reto_s, 190 * reto_s, 16 * reto_s, '#2a3a2c', '#c0392b', 3 * reto_s);
  rtexto(0, -45, '¿Salir al menú?', 24, true, 'center', crema);
  rtexto(0, -12, 'Se perderá lo que llevas de esta partida.', 15, false, 'center', '#fff', 0.85);
  menu_boton(-190, 25, 180, 44, 'Sí, salir', 'si_salir', null, false, '#c0392b');
  menu_boton(10, 25, 180, 44, 'Cancelar', 'cancelar', null, false);
}

// ---------- Créditos ----------
// En la victoria, arriba a la derecha: la pregunta. "Sí" -> créditos; "No" -> "ok mañana"... y créditos igual.
const CREDITOS = [
  { t: 'Scouteando en Puebla', px: 44, b: true, c: '#ffe9b0' },
  { t: '', px: 20 },
  { t: 'Ideas, diseños, pruebas y humanosidades', px: 18, b: true, c: '#e0a23a' },
  { t: 'Pantostado0611', px: 24 },
  { t: '', px: 20 },
  { t: 'Programación', px: 18, b: true, c: '#e0a23a' },
  { t: 'Claude (Anthropic)', px: 24 },
  { t: '', px: 20 },
  { t: 'Música', px: 18, b: true, c: '#e0a23a' },
  { t: '"First Light on the Ridge"', px: 24 },
  { t: 'hecha con Gemini', px: 18 },
  { t: '', px: 20 },
  { t: 'Letras', px: 18, b: true, c: '#e0a23a' },
  { t: 'Open Sans y Droid Sans Mono', px: 24 },
  { t: 'de Steve Matteson / Google', px: 18 },
  { t: '', px: 20 },
  { t: 'Hecho con', px: 18, b: true, c: '#e0a23a' },
  { t: 'GameMaker y JavaScript', px: 24 },
  { t: '', px: 40 },
  { t: 'Agradezco a mi mamá y mi papá por ayudarme en esto', px: 22, corazon: true },
  { t: '', px: 30 },
  { t: '¡Siempre listos!', px: 30, b: true, c: '#ffe9b0' },
  { t: 'Gracias por jugar', px: 22 },
];
let creditos_paso = 'pregunta', creditos_t = 0, creditos_hits = [];
// Devuelve true si ya se encargó de este cuadro (el resto de la victoria no se revisa)
function creditos_preguntar(dt) {
  soltar_raton();
  if (creditos_paso === 'ok') { creditos_t += dt; if (creditos_t > 1.8) creditos_empezar(); return true; }
  let si = kp('s'), no = kp('n');
  if (toque_pulsado()) for (const h of creditos_hits) if (toque_dentro(h)) { if (h.si) si = true; else no = true; }
  if (si) { creditos_empezar(); return true; }
  if (no) { creditos_paso = 'ok'; creditos_t = 0; return true; }
  return false;
}
function creditos_empezar() { state = 'creditos'; creditos_paso = 'pregunta'; creditos_t = 0; player.pitch = 0; }
function creditos_pregunta_dibujar() {
  const w = Math.min(380, W - 24), h = 132, x = W - w - 12, y = 12;
  creditos_hits = [];
  panel_borde(x, y, w, h, 14, '#2a3a2c', '#8e7a4a', 3);
  if (creditos_paso === 'ok') { texto(x + w / 2, y + h / 2 + 12, 'ok mañana', 30, true, 'center', '#ffe9b0'); return; }
  texto(x + w / 2, y + 36, 'hola amiguito como estas, bien?', 17, true, 'center', '#fff');
  texto(x + w / 2, y + 62, 'Querés ver los créditos?', 17, true, 'center', '#fff');
  const bw = 130, bh = 38, by = y + h - bh - 16;
  for (const [bx, t, col, si] of [[x + w / 2 - bw - 10, 'Sí', '#3fae4a', true], [x + w / 2 + 10, 'No', '#c0392b', false]]) {
    rect_redondo(bx, by, bw, bh, 9, col, 1);
    texto(bx + bw / 2, by + bh / 2 + 6, t, 17, true, 'center', '#fff');
    creditos_hits.push({ x: bx, y: by, w: bw, h: bh, si });
  }
}
const creditos_alto = () => CREDITOS.reduce((s, c) => s + c.px * 1.6, 0);
function creditos_actualizar(dt) {
  creditos_t += dt;
  // la cámara da vueltas a la fogata, como en la pantalla de inicio
  const a = ahora() / 9000;
  player.x = camp.x + Math.cos(a) * 190; player.y = camp.y + Math.sin(a) * 190; player.ang = a + PI;
  if (creditos_t > 0.5 && (kp('enter') || kp('escape') || toque_pulsado())) ir_al_titulo();
}
function creditos_dibujar() {
  rect(0, 0, W, H, 'rgb(10,20,10)', 0.72);
  // los nombres suben desde abajo y se quedan centrados al final; si la ventana es chica, todo se achica
  const k = Math.min(1, (H - 70) / creditos_alto(), W / 640);
  const alto = creditos_alto() * k, fin = (H - alto) / 2;
  let y = Math.max(fin, H - 60 - creditos_t * 60);
  for (const c of CREDITOS) {
    const px = c.px * k;
    y += px * 1.6;
    if (!c.t || y < -20 || y > H + 60) continue;
    texto(W / 2, y, c.t, px, !!c.b, 'center', c.c || '#fff');
    if (c.corazon) corazon_dibujar(W / 2 + texto_ancho(c.t, px, !!c.b) / 2 + px * 0.75, y - px * 0.38, px * 0.9);
  }
  if (y <= fin + alto + 1 && H - 60 - creditos_t * 60 <= fin)
    texto(W / 2, H - 24, tactil ? 'Toca para volver al inicio' : 'Enter o clic: volver al inicio', 14, false, 'center', '#fff', 0.7);
}
