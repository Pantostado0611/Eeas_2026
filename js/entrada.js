// Entrada: teclado, mouse y dedos. Todo se junta aquí y el juego lo revisa una vez por cuadro
// (como keyboard_check_pressed y device_mouse de GameMaker).

// ---------- Teclado ----------
// Las teclas se guardan por su nombre en minúsculas (e.key): 'w', 'arrowup', 'shift', ' ', 'escape'...
const teclas_abajo = new Set(), teclas_pulsadas = new Set();
let tecla_ultima = null;      // última tecla pulsada (para cambiar controles)
let texto_tecleado = '';      // lo que se escribe en los retos (como keyboard_string)
const kd = k => teclas_abajo.has(k);
const kp = k => teclas_pulsadas.has(k);

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  musica_desbloquear();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab', 'backspace', "'", '/'].includes(k) || (state === 'play' && reto)) e.preventDefault();
  if (k === 'f3' || k === 'f4') e.preventDefault();
  // escribir en el reto (letras, números, puntos, rayas, espacios)
  if (state === 'play' && reto && !reto_con_opciones()) {
    if (k === 'backspace') texto_tecleado = texto_tecleado.slice(0, -1);
    else if (e.key.length === 1 && texto_tecleado.length < 80 && !e.ctrlKey && !e.metaKey) texto_tecleado += e.key;
  }
  if (e.repeat) return;
  teclas_abajo.add(k); teclas_pulsadas.add(k); tecla_ultima = k;
});
addEventListener('keyup', e => { teclas_abajo.delete(e.key.toLowerCase()); });

// ---------- Mouse y dedos (Pointer Events: el mouse y los dedos llegan igual) ----------
// punteros: id -> { x, y, px, py (dónde estaba el cuadro anterior), abajo, pulsado, soltado, tipo }
const punteros = new Map();
const raton = { x: -1, y: -1, pulsado: [false, false, false], abajo: [false, false, false], dx: 0, dy: 0 };
let forzar_tactil = false; // F4: modo celular en la computadora

function puntero_pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', e => {
  musica_desbloquear();
  const [x, y] = puntero_pos(e);
  if (e.pointerType === 'touch' || e.pointerType === 'pen') { if (!tactil) { tactil = true; tactil_soltar(); } }
  else if (tactil && !forzar_tactil) { tactil = false; tactil_soltar(); } // usaste el mouse: modo computadora
  if (e.pointerType === 'mouse') {
    raton.x = x; raton.y = y; raton.pulsado[e.button] = true; raton.abajo[e.button] = true;
    if (e.button !== 0) return; // solo el botón izquierdo cuenta como "toque"
  }
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* no pasa nada */ }
  punteros.set(e.pointerId, { x, y, px: x, py: y, abajo: true, pulsado: true, soltado: false, tipo: e.pointerType });
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  const [x, y] = puntero_pos(e);
  if (e.pointerType === 'mouse') { raton.x = x; raton.y = y; if (raton_capturado) { raton.dx += e.movementX; raton.dy += e.movementY; } }
  const p = punteros.get(e.pointerId);
  if (p) { p.x = x; p.y = y; }
});
function puntero_fin(e) {
  if (e.pointerType === 'mouse') { raton.abajo[e.button] = false; if (e.button !== 0) return; }
  const p = punteros.get(e.pointerId);
  if (p) { p.abajo = false; p.soltado = true; }
}
cv.addEventListener('pointerup', puntero_fin);
cv.addEventListener('pointercancel', puntero_fin);
cv.addEventListener('contextmenu', e => e.preventDefault()); // clic derecho = remo izquierdo
addEventListener('mouseup', e => { raton.abajo[e.button] = false; });

// Al final de cada cuadro: lo "recién pulsado" deja de serlo y los dedos levantados se olvidan
function entrada_fin_cuadro() {
  teclas_pulsadas.clear();
  raton.pulsado = [false, false, false];
  raton.dx = 0; raton.dy = 0;
  for (const [id, p] of punteros) { p.pulsado = false; p.px = p.x; p.py = p.y; if (p.soltado) punteros.delete(id); }
}

// ---------- Mouse capturado para mirar (pointer lock) ----------
let raton_capturado = false, soltando_raton = false, perdio_captura = false, perdio_foco = false;
function capturar_raton() {
  if (tactil || !cv.requestPointerLock || document.pointerLockElement === cv) return;
  try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* el navegador no dejó */ }
}
function soltar_raton() {
  if (document.pointerLockElement === cv) { soltando_raton = true; document.exitPointerLock(); }
  raton_capturado = false;
}
document.addEventListener('pointerlockchange', () => {
  raton_capturado = document.pointerLockElement === cv;
  if (!raton_capturado && !soltando_raton) perdio_captura = true; // Esc del navegador: se abre el menú
  soltando_raton = false;
});
addEventListener('blur', () => { teclas_abajo.clear(); raton.abajo = [false, false, false]; perdio_foco = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { teclas_abajo.clear(); perdio_foco = true; } });

// ---------- Música ----------
// "First Light on the Ridge" (hecha con Gemini). Suena en bucle; el navegador solo deja empezarla después de un toque o tecla.
const musica = new Audio('musica.mp3');
musica.loop = true;
let musica_lista = false;
function musica_volumen() {
  musica.volume = clamp(settings.musica / 10 * 0.8, 0, 1);
  if (!musica_lista) return;
  if (settings.musica > 0 && musica.paused) musica.play().catch(() => {});
  else if (settings.musica === 0 && !musica.paused) musica.pause();
}
function musica_desbloquear() {
  if (musica_lista) return;
  musica_lista = true;
  musica_volumen();
}
