// Controles táctiles: para jugar en el celular.
// Lado izquierdo de la pantalla: una palanca para caminar y girar. Lado derecho: arrastrar el dedo para mirar.
// Y botones redondos para las acciones. Cada botón se puede mover y cambiar de tamaño (ver editor_...).
// En la computadora, F4 prende y apaga el "modo celular" para probarlo con el mouse (el mouse hace de dedo).

// ---------- Los botones y dónde van si no los has movido ----------
// ax, ay: de qué orilla se miden (0 = izquierda o arriba, 1 = derecha o abajo)
// dx, dy: qué tan lejos de esa orilla (en unidades "u", ver tu()); r: radio (también en "u")
// "rover" es un solo botón que dice "Reto" o "Marcar" según lo que toque hacer (y no sale si no hace falta).
const BOTONES = [
  { id: 'palanca', label: 'Palanca', ax: 0, ay: 1, dx: 96, dy: -96, r: 50 },
  { id: 'usar', label: 'Usar', ax: 1, ay: 1, dx: -64, dy: -70, r: 31 },
  { id: 'correr', label: 'Correr', ax: 1, ay: 1, dx: -64, dy: -150, r: 23 },
  { id: 'comer', label: 'Ración', ax: 1, ay: 1, dx: -146, dy: -44, r: 23 },
  { id: 'rover', label: 'Reto/Marcar', ax: 1, ay: 1, dx: -146, dy: -124, r: 23 },
  { id: 'menu', label: 'Menú', ax: 0, ay: 0, dx: 28, dy: 138, r: 19 },
  { id: 'mapa', label: 'Pasaporte', ax: 0, ay: 0, dx: 72, dy: 138, r: 19 },
  { id: 'libreta', label: 'Libreta', ax: 0, ay: 0, dx: 116, dy: 138, r: 19 },
];

// Unidad de tamaño: 1 en un celular acostado normal (unos 400 píxeles de alto); crece en pantallas grandes
const tu = () => clamp(Math.min(W, H) / 400, 0.7, 2.6);

// En un celular o tableta empieza en modo táctil (también se activa al primer toque)
let tactil = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const dedos = new Map();   // id del dedo -> qué está haciendo: 'palanca', 'mirar', 'boton' o 'cuerda'
let palanca = null;        // { dedo, ox, oy, x, y }: dónde empezó (ox, oy) y dónde está el dedo
let tactil_avance = 0, tactil_giro = 0, tactil_correr = false;
let tactil_remo = 0, tactil_agita = false, tactil_cuerda = false;
let boton_brillo = '', boton_brillo_t = 0;
let toque_px = 0, toque_py = 0, toque_dedo = null, toque_usado = false;
let editor = null;

// Suelta todo lo que tenían agarrado los dedos
function tactil_soltar() { dedos.clear(); palanca = null; tactil_avance = 0; tactil_giro = 0; }

// ¿Qué se puede hacer con los dedos ahorita? '' = nada (hay una ventanita: ella revisa los toques con toque_pulsado())
function tactil_modo() {
  if (state !== 'play') return '';
  if (reto || prender || book || mapa_abierto || reveal || comiendo) return '';
  if (rapel) return 'rapel';
  if (canoa) return canoa.manual ? '' : 'canoa';
  if (rescate) return 'rescate';
  return 'juego';
}

// ---------- Toques para las ventanitas (reto, libreta, menú...) ----------
// Igual que un clic, pero con cualquier dedo. Guarda dónde fue en toque_px, toque_py (y qué dedo en toque_dedo).
function toque_pulsado() {
  if (toque_usado) return false; // ese toque ya lo usó un botón del juego en este cuadro
  for (const [id, p] of punteros) if (p.pulsado) { toque_px = p.x; toque_py = p.y; toque_dedo = id; return true; }
  return false;
}
const toque_dentro = h => toque_px >= h.x && toque_px <= h.x + h.w && toque_py >= h.y && toque_py <= h.y + h.h;

// ---------- Botones ----------
const boton_def = id => BOTONES.find(b => b.id === id);
// Dónde está un botón y qué tan grande es: { x, y, r } en la pantalla
function boton_pos(b) {
  const u = tu(), c = settings.botones[b.id];
  let k = 1, x = b.ax * W + b.dx * u, y = b.ay * H + b.dy * u;
  if (c) { k = c.k; x = c.x * W; y = c.y * H; } // lo moviste en el editor
  const r = b.r * u * k;
  return { x: clamp(x, r, W - r), y: clamp(y, r, H - r), r };
}
// Rover: 'reto' si te falta la pista de la siguiente base, 'marcar' si ya la tienes y estás fuera del campamento, '' si ninguno
function rover_boton() {
  if (cat.hint !== 'ruta' || !fire.lit) return '';
  const f = base_sin_marcar();
  if (!f) return '';
  if (!f.unlocked) return 'reto';
  if (dist(player, camp) < CAMP_ZONE) return '';
  return 'marcar';
}
// ¿Se ve este botón ahorita?
function boton_visible(b, modo) {
  if (b.id === 'palanca') return false; // la palanca se dibuja aparte
  if (modo === 'juego') {
    if (b.id === 'libreta') return cat.hint === 'ruta';
    if (b.id === 'rover') return rover_boton() !== '';
    return true;
  }
  return modo !== '' && b.id === 'menu'; // en la canoa, el agua y el rapel solo está el de Menú
}
// El botón que está bajo el dedo (o null)
function boton_en(x, y, modo) {
  const extra = 6 * tu(); // un poquito de margen, que los dedos no son exactos
  for (let i = BOTONES.length - 1; i >= 0; i--) {
    const b = BOTONES[i];
    if (!boton_visible(b, modo)) continue;
    const p = boton_pos(b);
    if (pdist(x, y, p.x, p.y) < p.r + extra) return b;
  }
  return null;
}

// Lo que hace cada acción (la usan las teclas y los botones)
function accion_juego(a) {
  switch (a) {
    case 'usar': usar(); break;
    case 'comer': comer(); break;
    case 'mapa': mapa_abierto = true; soltar_raton(); break;
    case 'menu': abrir_menu(); break;
    case 'correr': tactil_correr = !tactil_correr; break;
    case 'libreta': case 'marcar': case 'reto':
      if (cat.hint !== 'ruta') break;
      if (!fire.lit) { toast('Primero prende la fogata.'); break; }
      if (a === 'libreta') { book = true; soltar_raton(); }
      else if (a === 'marcar') marcar_base();
      else pedir_reto();
      break;
  }
}

// ---------- Cada cuadro: leer los dedos ----------
function tactil_actualizar(dt) {
  toque_usado = false;
  tactil_remo = 0; tactil_agita = false; tactil_cuerda = false;
  if (boton_brillo_t > 0) boton_brillo_t -= dt;
  if (kp('f4')) { // para probar en la computadora
    forzar_tactil = !tactil; tactil = !tactil; tactil_soltar();
    toast(tactil ? 'Modo celular (F4 para quitarlo)' : 'Modo computadora', 2);
  }
  if (!tactil) return;
  soltar_raton();

  let modo = tactil_modo();
  if (modo !== 'juego' && modo !== 'rescate') { palanca = null; tactil_avance = 0; tactil_giro = 0; }
  for (const [id, p] of punteros) {
    const x = p.x, y = p.y;
    if (p.pulsado) {
      // dedo nuevo: ¿qué tocó?
      dedos.delete(id);
      if (modo !== '') {
        toque_usado = true;
        const b = boton_en(x, y, modo);
        if (b) {
          dedos.set(id, 'boton'); boton_brillo = b.id; boton_brillo_t = 0.15;
          accion_juego(b.id === 'rover' ? rover_boton() : b.id);
          modo = tactil_modo(); // el botón pudo abrir una ventanita
        } else if ((modo === 'juego' || modo === 'rescate') && x < W * 0.45 && !palanca) {
          palanca = { dedo: id, ox: x, oy: y, x, y }; dedos.set(id, 'palanca'); palanca_mover();
        } else if (modo === 'juego') dedos.set(id, 'mirar');
        else if (modo === 'canoa') tactil_remo = x < W / 2 ? -1 : 1; // mitad izquierda: giras a la izquierda
        else if (modo === 'rescate') tactil_agita = true;
        else if (modo === 'rapel') { dedos.set(id, 'cuerda'); tactil_cuerda = true; }
      }
    } else if (p.abajo) {
      // dedo que sigue en la pantalla
      const d = dedos.get(id);
      if (d === 'palanca' && palanca) { palanca.x = x; palanca.y = y; palanca_mover(); }
      else if (d === 'mirar' && modo === 'juego') {
        const k = settings.sens * 0.0012;
        player.ang += (x - p.px) * k;
        player.pitch = clamp(player.pitch - (y - p.py) * k * (settings.invert ? -1 : 1), -0.5, 0.5);
      } else if (d === 'cuerda') tactil_cuerda = true;
    }
    if (p.soltado && dedos.has(id)) {
      // dedo que se levantó
      if (dedos.get(id) === 'palanca') { palanca = null; tactil_avance = 0; tactil_giro = 0; }
      dedos.delete(id);
    }
  }
}

// La palanca: la base sigue al dedo si te sales del círculo. Arriba = caminar, a los lados = girar.
const palanca_radio = () => boton_pos(boton_def('palanca')).r;
function palanca_mover() {
  const R = palanca_radio();
  let dx = palanca.x - palanca.ox, dy = palanca.y - palanca.oy;
  const d = Math.hypot(dx, dy);
  if (d > R) {
    palanca.ox = palanca.x - dx / d * R; palanca.oy = palanca.y - dy / d * R;
    dx = palanca.x - palanca.ox; dy = palanca.y - palanca.oy;
  }
  // zona muerta: si casi no mueves el dedo, no cuenta
  tactil_avance = Math.abs(dy / R) < 0.18 ? 0 : -dy / R;
  tactil_giro = Math.abs(dx / R) < 0.18 ? 0 : dx / R;
}

// ---------- Dibujo ----------
// encendido: se ve naranja (Correr prendido o recién tocado); marcado: borde naranja (elegido en el editor)
function boton_dibujar(p, label, encendido, marcado = false) {
  circulo(p.x, p.y, p.r, encendido ? '#e0a23a' : '#000', encendido ? 0.85 : 0.38, false);
  circulo(p.x, p.y, p.r, marcado ? '#ffb84a' : '#fff', marcado ? 1 : 0.5, true, marcado ? 2.5 : 1);
  let px = Math.max(9, p.r * 0.4);
  while (px > 8 && texto_ancho(label, px, true) > p.r * 1.8) px--;
  texto(p.x, p.y + px * 0.36, label, px, true, 'center', encendido ? '#222' : '#fff');
}
function palanca_dibujar(marcado = false) {
  const base = boton_pos(boton_def('palanca')), R = base.r;
  const bx = palanca ? palanca.ox : base.x, by = palanca ? palanca.oy : base.y;
  circulo(bx, by, R, '#fff', 0.12, false);
  circulo(bx, by, R, marcado ? '#ffb84a' : '#fff', marcado ? 1 : 0.35, true, marcado ? 2.5 : 1);
  circulo(palanca ? palanca.x : bx, palanca ? palanca.y : by, R * 0.43, '#fff', 0.45, false);
  if (!palanca) texto(bx, by + R + Math.max(10, 12 * tu()), 'caminar', Math.max(10, 11 * tu()), false, 'center', '#fff', 0.6);
}
function tactil_dibujar() {
  if (!tactil) return;
  const modo = tactil_modo();
  if (modo === 'juego' || modo === 'rescate') palanca_dibujar();
  for (const b of BOTONES) {
    if (!boton_visible(b, modo)) continue;
    const label = b.id === 'rover' ? (rover_boton() === 'reto' ? 'Reto' : 'Marcar') : b.label;
    const on = (b.id === 'correr' && tactil_correr) || (boton_brillo_t > 0 && boton_brillo === b.id);
    boton_dibujar(boton_pos(b), label, on);
  }
  if (modo === 'canoa') { // las dos mitades de la pantalla son los remos
    const px = Math.max(11, 13 * tu());
    linea_redonda(W / 2, H * 0.45, W / 2, H, 2, 'rgba(255,255,255,0.18)');
    pastilla(W * 0.25, H - 20, 'Toca aquí: giras a la izquierda', px, 0.8);
    pastilla(W * 0.75, H - 20, 'Toca aquí: giras a la derecha', px, 0.8);
  }
  if (H > W && ((state === 'play' && modo !== '') || state === 'title')) pastilla(W / 2, H * 0.55, 'Gira el celular para jugar mejor', 13, 1);
}

// ---------- Editor de botones (desde el menú de pausa) ----------
// Arrastras un botón para moverlo; lo tocas y con - / + le cambias el tamaño. Se guarda en los ajustes.
function editor_abrir() { state = 'botones'; editor = { sel: 'usar', dedo: null, offx: 0, offy: 0, hits: [] }; }
function editor_cerrar() { ajustes_guardar(); editor = null; state = 'menu'; }
// El ajuste guardado de un botón (si no existe, se crea con la posición de siempre)
function boton_ajuste(id) {
  let c = settings.botones[id];
  if (!c) { const p = boton_pos(boton_def(id)); c = settings.botones[id] = { x: p.x / W, y: p.y / H, k: 1 }; }
  return c;
}
function editor_actualizar() {
  const e = editor;
  if (kp('escape')) { editor_cerrar(); return; }
  if (e.dedo !== null) { // arrastrando un botón
    const p = punteros.get(e.dedo);
    if (p && p.abajo) {
      const c = boton_ajuste(e.sel);
      c.x = clamp((p.x - e.offx) / W, 0, 1);
      c.y = clamp((p.y - e.offy) / H, 0, 1);
    } else { e.dedo = null; ajustes_guardar(); }
    return;
  }
  if (!toque_pulsado()) return;
  // primero los botones del panelito
  for (const h of e.hits) {
    if (!toque_dentro(h)) continue;
    if (h.act === 'listo') editor_cerrar();
    else if (h.act === 'restablecer') { settings.botones = {}; ajustes_guardar(); }
    else { // 'menos' o 'mas'
      const c = boton_ajuste(e.sel);
      c.k = clamp(Math.round((c.k + (h.act === 'mas' ? 0.1 : -0.1)) * 10) / 10, 0.6, 1.8);
      ajustes_guardar();
    }
    return;
  }
  // luego los botones del juego (todos, aunque ahorita no salgan)
  const extra = 6 * tu();
  for (let i = BOTONES.length - 1; i >= 0; i--) {
    const b = BOTONES[i], p = boton_pos(b);
    if (pdist(toque_px, toque_py, p.x, p.y) < p.r + extra) {
      e.sel = b.id; e.dedo = toque_dedo; e.offx = toque_px - p.x; e.offy = toque_py - p.y;
      return;
    }
  }
}
// Botón rectangular del panelito del editor
function editor_boton(x, y, w, h, text, act, col) {
  rect_redondo(x, y, w, h, 8 * tu(), col, 1);
  const px = Math.max(11, 15 * tu());
  texto(x + w / 2, y + h / 2 + px * 0.36, text, px, true, 'center', '#fff');
  editor.hits.push({ x, y, w, h, act });
}
function editor_dibujar() {
  const e = editor, u = tu();
  rect(0, 0, W, H, '#000', 0.35);
  // todos los botones, con el elegido marcado
  palanca_dibujar(e.sel === 'palanca');
  for (const b of BOTONES) if (b.id !== 'palanca') boton_dibujar(boton_pos(b), b.label, false, e.sel === b.id);
  // panelito en medio
  e.hits = [];
  const pw = Math.min(W - 20, 330 * u), ph = 168 * u, x0 = (W - pw) / 2, y0 = (H - ph) / 2;
  panel_borde(x0, y0, pw, ph, 12 * u, '#2a3a2c', '#8e7a4a', 2);
  texto(W / 2, y0 + 28 * u, 'Acomodar botones', Math.max(13, 19 * u), true, 'center', '#ffe9b0');
  const ayuda = 'Arrastra un botón para moverlo. Tócalo y cambia su tamaño:';
  let apx = Math.max(10, 12 * u);
  while (apx > 8 && texto_ancho(ayuda, apx, false) > pw - 16) apx -= 0.5; // que quepa en el panelito
  texto(W / 2, y0 + 50 * u, ayuda, apx, false, 'center', '#fff', 0.85);
  const c = settings.botones[e.sel], k = c ? c.k : 1;
  const by = y0 + 64 * u, bh = 38 * u, bw = 46 * u;
  editor_boton(x0 + 14 * u, by, bw, bh, '-', 'menos', '#4a5f45');
  editor_boton(x0 + pw - 14 * u - bw, by, bw, bh, '+', 'mas', '#4a5f45');
  texto(W / 2, by + bh / 2 + 6 * u, boton_def(e.sel).label + ' · ' + Math.round(k * 100) + ' %', Math.max(12, 16 * u), true, 'center', '#fff');
  const by2 = y0 + ph - 14 * u - bh, bw2 = (pw - 42 * u) / 2;
  editor_boton(x0 + 14 * u, by2, bw2, bh, 'Restablecer', 'restablecer', '#6b5a3a');
  editor_boton(x0 + pw - 14 * u - bw2, by2, bw2, bh, 'Listo', 'listo', '#3fae4a');
}
