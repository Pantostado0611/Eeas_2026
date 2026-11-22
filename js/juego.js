// Scouteando en Puebla — exploración + supervivencia ligera, en primera persona con dibujos 2D.
// Este archivo junta todo: categorías, ajustes, empezar partida, actualizar y dibujar cada cuadro.
// (Es la versión web del proyecto de GameMaker ScoutsGM, con las mismas reglas y números.)

// ---------- Categorías scout = dificultades (el color del uniforme es solo de adorno) ----------
// food: raciones con las que empiezas; energy: qué tan rápido se gasta; fire_dur: cuánto dura la fogata comparada con Tropa (1.2 = 20 % más); lighter: probabilidad de prender con el encendedor en cada intento;
// corriente: qué tan fuerte jala el río (unidades por segundo); tambaleo: cuánto se mueve la canoa al remar varias veces del mismo lado;
// muelle_desfase: cuánto se recorre el muelle del otro lado del río (en puntos de ~40 unidades; + = río abajo, - = contra la corriente);
// monte_alto: alto del Cerro del Coyote; monte_angostos: pasos angostos con cuerda; rapel_seguro: velocidad máxima sin rasparte; rain: cada cuánto llueve (más bajo = más seguido)
// hint: cómo son las pistas ('4' = N/S/E/O, '8' = con diagonales, 'grados' = rumbo en grados, 'ruta' = Rover)
const CATEGORIES = [
  { name: 'Lobezno/a', color: '#e8c23a', diff: 'Fácil', energy: 0.7, fire_dur: 1.2, lighter: 0.9, corriente: 12, tambaleo: 0.10, muelle_desfase: 0, monte_alto: 260, monte_angostos: 1, rapel_seguro: 95, rain: 1.4, food: 3, hint: '4',
    desc: ['Te cansas más lento y la', 'fogata dura más. Pistas:', 'norte, sur, este u oeste.'] },
  { name: 'Tropero/a', color: '#3fae4a', diff: 'Normal', energy: 1, fire_dur: 1, lighter: 0.8, corriente: 20, tambaleo: 0.14, muelle_desfase: 6, monte_alto: 330, monte_angostos: 2, rapel_seguro: 80, rain: 1, food: 2, hint: '8',
    desc: ['La aventura como es.', 'Pistas con noreste,', 'sureste, noroeste...'] },
  { name: 'Caminante', color: '#3b7bd9', diff: 'Difícil', energy: 1.25, fire_dur: 0.9, lighter: 0.67, corriente: 28, tambaleo: 0.18, muelle_desfase: -6, monte_alto: 400, monte_angostos: 2, rapel_seguro: 70, rain: 0.8, food: 1, hint: 'grados',
    desc: ['Te cansas más rápido y', 'llueve más seguido.', 'Pistas en grados.'] },
  { name: 'Rover', color: '#d63a2f', diff: 'Muy difícil', energy: 1.5, fire_dur: 0.75, lighter: 0.45, corriente: 38, tambaleo: 0.24, muelle_desfase: -11, monte_alto: 470, monte_angostos: 3, rapel_seguro: 60, rain: 0.6, food: 1, hint: 'ruta',
    desc: ['Bases invisibles: gana', 'la pista con un reto,', 'sigue rumbo y pasos y', 'anótalo en la libreta.'] },
];

// ---------- Ajustes (se guardan en este navegador, ver ajustes_guardar) ----------
const DEFAULT_BINDS = { adelante: 'w', atras: 's', izquierda: 'a', derecha: 'd', arriba: 'arrowup', abajo: 'arrowdown',
  correr: 'shift', usar: 'e', comer: 'f', mapa: 'm', marcar: 'q', libreta: 'l', reto: 'r' };
const BIND_ORDER = ['adelante', 'atras', 'izquierda', 'derecha', 'arriba', 'abajo', 'correr', 'usar', 'comer', 'mapa', 'marcar', 'libreta', 'reto'];
const BIND_NAMES = { adelante: 'Caminar adelante', atras: 'Caminar atrás', izquierda: 'Girar a la izquierda', derecha: 'Girar a la derecha',
  arriba: 'Mirar arriba', abajo: 'Mirar abajo', correr: 'Correr', usar: 'Usar / recoger', comer: 'Comer ración', mapa: 'Pasaporte',
  marcar: 'Marcar (Rover)', libreta: 'Libreta (Rover)', reto: 'Reto (Rover)' };
const settings = { sens: 5, giro: 5, invert: false, cat: 1, modo: 0, musica: 5, binds: { ...DEFAULT_BINDS }, botones: {} }; // botones: los que moviste en el editor (celular)
ajustes_cargar();
let cat = CATEGORIES[settings.cat];

// ---------- Estado de la partida ----------
let state = 'cargando', ver_fps = false;
let player = null, fire = { fuel: 70, lit: true }, time = 0.1, day = 1, energy = 100, wood = 0, food = 0;
let rain = false, rain_timer = 0, next_rain = 100, drops = [], toasts = [], playTime = 0;
let reto = null, book = false, reveal = null, mapa_abierto = false, prender = null, lose_reason = 'energia';
let chaleco = false, canoa = null, rescate = null, canoa_manual_visto = false;
let monte_modo = '', cuerda = -1, rapel = null, monte_aviso_t = 0;
let mundo_sin_usar = false; // true = el bosque recién generado todavía no se jugó
let final_hits = [];        // botones de las pantallas de ganar y perder (en el celular)

function empezar_juego() {
  cat = CATEGORIES[settings.cat];
  // el del título se usa tal cual (no se tocó), salvo que se haya hecho con otra sección (los muelles cambian)
  if (!mundo_sin_usar || mundo_cat !== settings.cat) { player = null; mundo_generar(20261101); }
  mundo_sin_usar = false;
  player = { x: camp.x, y: camp.y + 200, ang: -PI / 2, pitch: 0, step: 0, moving: false, place: null, alt: 0 };
  monte_modo = ''; cuerda = -1; rapel = null;
  fire = { fuel: 0, lit: false }; // hay que prenderla primero (ver abrir_prender)
  prender = null; lose_reason = 'energia';
  chaleco = false; canoa = null; rescate = null; canoa_manual_visto = false;
  tactil_soltar(); tactil_correr = false;
  time = 0.05; day = 1;
  reto = null; book = false; reveal = null; mapa_abierto = false; pas_tab = 0;
  comedor_reiniciar();
  creditos_paso = 'pregunta'; creditos_t = 0;
  energy = 100; wood = 0; food = cat.food;
  rain = false; rain_timer = 0; next_rain = (70 + random(60)) * cat.rain;
  drops = []; toasts = [];
  playTime = 0;
  state = 'play';
  toast('Primero prende la fogata: acércate y presiona ' + tecla_entre_corchetes('usar') + '.', 7);
}

// ---------- Actualización de cada cuadro ----------
function actualizar(dt) {
  if (kp('f3')) ver_fps = !ver_fps;
  const se_fue = perdio_foco || perdio_captura; // cambiaste de ventana o soltaste el mouse con Esc
  perdio_foco = false; perdio_captura = false;

  // ---------- Dedos (celular) ----------
  tactil_actualizar(dt);

  // ---------- Mouse ----------
  if (!tactil && raton_capturado) {
    if (state === 'play') {
      const k = settings.sens * 0.0006;
      player.ang += raton.dx * k;
      player.pitch = clamp(player.pitch - raton.dy * k * (settings.invert ? -1 : 1), -0.5, 0.5);
    }
  } else if (!tactil && raton.pulsado[0] && state === 'play' && !reto && !prender && !canoa && !rescate && !rapel && !book && !mapa_abierto && !comiendo && !raton_en_minimapa()) {
    capturar_raton();
  }

  toasts_actualizar(dt);
  if (state === 'title') { titulo_actualizar(); return; }
  if (state === 'creditos') { creditos_actualizar(dt); return; }
  if (state === 'win' && creditos_preguntar(dt)) return;
  if (state === 'lose' || state === 'win') {
    soltar_raton();
    if (kp('enter')) empezar_juego();
    else if (kp('escape')) ir_al_titulo();
    else if (toque_pulsado()) for (const h of final_hits) { // botones del celular
      if (!toque_dentro(h)) continue;
      if (h.act === 'otra') empezar_juego(); else ir_al_titulo();
      break;
    }
    return;
  }
  if (state === 'menu') { menu_actualizar(); return; }
  if (state === 'botones') { editor_actualizar(); return; }
  if (state !== 'play') return;

  // ---------- Ventanitas: con el reto o la libreta abiertos, el juego se pausa ----------
  if (reveal) { revisar_libreta(dt); return; }
  if (reto) { reto_teclas(); return; }
  if (prender) { prender_actualizar(dt); return; }
  if (mapa_abierto) { pasaporte_actualizar(); return; } // el juego se pausa mientras ves el pasaporte
  if (book) {
    if (kp(settings.binds.libreta) || kp('escape')) book = false;
    else if (kp('backspace')) borrar_ultima_marca();
    else if (toque_pulsado()) { // en el celular hay un botón para borrar; tocar en otro lado cierra
      if (libreta_borrar && toque_dentro(libreta_borrar)) borrar_ultima_marca(); else book = false;
    }
    return;
  }

  // Esc (o cambiar a otra ventana) abre el menú y pausa
  if (kp('escape') || se_fue) { abrir_menu(); return; }

  // El manual de la canoa también pausa el juego (sale antes de remar por primera vez)
  if (canoa && canoa.manual) { rio_actualizar(dt); return; }

  playTime += dt;

  // ---------- Tiempo y días ----------
  time += dt / dia_len();
  if (time >= 1) { time -= 1; day++; toast('Amanece el día ' + day); }

  // ---------- Clima ----------
  clima_actualizar(dt);

  comedor_actualizar(dt);
  // ---------- Sentado comiendo: no te mueves hasta que acabas ----------
  if (comiendo) {
    comer_actualizar(dt);
    supervivencia_actualizar(dt, false);
    return;
  }

  // ---------- Bajando en rapel / en la canoa o esperando el rescate ----------
  if (rapel || canoa || rescate) {
    if (rapel) rapel_actualizar(dt); else rio_actualizar(dt);
    if (state === 'play') supervivencia_actualizar(dt, false);
    if (state === 'play') lluvia_actualizar(dt);
    return;
  }

  // ---------- Acciones (teclas; los botones del celular ya se revisaron en tactil_actualizar) ----------
  const b = settings.binds;
  if (kp(b.usar)) accion_juego('usar');
  if (kp(b.comer)) accion_juego('comer');
  if (kp(b.mapa) || (!tactil && !raton_capturado && raton.pulsado[0] && raton_en_minimapa())) accion_juego('mapa');
  if (kp(b.libreta)) accion_juego('libreta');
  else if (kp(b.marcar)) accion_juego('marcar');
  else if (kp(b.reto)) accion_juego('reto');
  // si se abrió una ventanita (o te subiste a la canoa, empezaste el rapel...), este cuadro ya no caminas
  if (mapa_abierto || book || reto || prender || canoa || rapel || comiendo || state !== 'play') return;

  // ---------- Movimiento en primera persona: A/D giran, W/S caminan hacia adelante/atrás ----------
  const ox = player.x, oy = player.y; // para la montaña (si no se puede pasar, regresas aquí)
  let turn = 0, fwd = 0, look = 0;
  if (kd(b.izquierda)) turn--;
  if (kd(b.derecha)) turn++;
  if (kd(b.adelante)) fwd++;
  if (kd(b.atras)) fwd--;
  if (kd(b.arriba)) look++;
  if (kd(b.abajo)) look--;
  turn = clamp(turn + tactil_giro, -1, 1); fwd = clamp(fwd + tactil_avance, -1, 1); // palanca del celular
  const running = (kd(b.correr) || tactil_correr) && fwd > 0;
  player.ang += turn * (0.6 + settings.giro * 0.34) * dt;
  player.pitch = clamp(player.pitch + look * 1.1 * dt, -0.5, 0.5);
  player.moving = fwd !== 0;
  if (player.moving) {
    const sp = (running ? 250 : 150) * (fwd < 0 ? 0.6 : 1) * (energy < 15 ? 0.6 : 1);
    player.x += Math.cos(player.ang) * fwd * sp * dt;
    player.y += Math.sin(player.ang) * fwd * sp * dt;
    player.step += dt * (running ? 14 : 9);
  }

  // ---------- Choques (círculos) ----------
  const PR = 16;
  if (monte_modo === '') for (const s of solids) { // en la montaña no hay árboles con qué chocar
    const dx = player.x - s.x, dy = player.y - s.y, d = Math.hypot(dx, dy), m = s.r + PR;
    if (d < m && d > 0.001) { player.x = s.x + dx / d * m; player.y = s.y + dy / d * m; }
  }
  monte_mover(ox, oy); // la montaña: chocar con ella, subir por el camino, cuerdas y cima
  comedor_chocar(PR);  // paredes, mesas y la regla de la charola
  player.x = clamp(player.x, 30, WORLD - 30);
  player.y = clamp(player.y, 30, WORLD - 30);

  // ---------- Supervivencia (ramas, fogata, energía) y lluvia ----------
  supervivencia_actualizar(dt, running);
  if (state === 'play' && fire.lit) bases_actualizar(); // las bases cuentan hasta que prendes la fogata
  if (state === 'play') lluvia_actualizar(dt);
}

// ---------- Dibujo de cada cuadro ----------
function dibujar() {
  dibujar_mundo();
  if (state !== 'title' && state !== 'creditos') { rio_vista_dibujar(); monte_vista_dibujar(); }
  if (state === 'play') comedor_vista_dibujar(); // la charola en tus manos (debajo de los mensajes)
  if (state === 'title') titulo_dibujar(); else if (state === 'creditos') creditos_dibujar(); else hud_dibujar();
  if (state === 'play') tactil_dibujar(); // botones del celular (no salen en el menú ni en las ventanitas)
  if (state === 'play' && canoa && canoa.manual) canoa_manual_dibujar();
  if (state === 'play' && mapa_abierto) pasaporte_dibujar();
  if (state === 'play' && book) libreta_dibujar();
  if (state === 'play' && reto) reto_dibujar();
  if (state === 'play' && prender) prender_dibujar();
  if (state === 'menu') menu_dibujar();
  if (state === 'botones') editor_dibujar();
  // Pantallas de ganar y perder: en la computadora con Enter y Esc; en el celular con dos botones
  const otra = tactil ? '' : 'ENTER: intentarlo otra vez · Esc: elegir otra categoría';
  if (state === 'lose') {
    if (lose_reason === 'fogata') pantalla_final('Se apagó la fogata', ['Trae ramas seguido y échalas al fuego con ' + tecla_entre_corchetes('usar') + ' antes de que se acabe.', '', otra]);
    else pantalla_final('Te quedaste sin energía', ['Ve al comedor a las horas de comida (vienen en tu pasaporte), lleva raciones', 'y quédate cerca de la fogata en la noche.', '', otra]);
  }
  // si la pregunta de los créditos (arriba a la derecha) taparía el título, todo baja un poco
  const baja = state === 'win' && creditos_paso === 'pregunta' && W < 1100 && H / 2 - 110 < 150 ? Math.min(50, 150 - (H / 2 - 110)) : 0;
  if (state === 'win') {
    const mins = Math.floor(playTime / 60), secs = Math.floor(playTime % 60);
    pantalla_final('¡Insignia de Explorador!', ['Completaste las ' + NUM_FLAGS + ' bases y volviste al campamento.',
      cat.name + ' (' + cat.diff + ') · Días: ' + day + ' · Tiempo: ' + mins + ':' + dos(secs),
      '', tactil ? '' : 'ENTER: jugar otra vez · Esc: elegir otra categoría'], baja);
  }
  final_hits = [];
  if (tactil && (state === 'lose' || state === 'win')) {
    const bw = Math.min(200, (W - 40) / 2), bh = 44, by = Math.min(H / 2 + 70 + baja, H - bh - 12);
    rect_redondo(W / 2 - bw - 10, by, bw, bh, 10, '#3fae4a', 1);
    texto(W / 2 - bw / 2 - 10, by + bh / 2 + 6, state === 'win' ? 'Jugar otra vez' : 'Intentar otra vez', 16, true, 'center', '#fff');
    final_hits.push({ x: W / 2 - bw - 10, y: by, w: bw, h: bh, act: 'otra' });
    rect_redondo(W / 2 + 10, by, bw, bh, 10, '#4a5f45', 1);
    texto(W / 2 + 10 + bw / 2, by + bh / 2 + 6, 'Elegir categoría', 16, true, 'center', '#fff');
    final_hits.push({ x: W / 2 + 10, y: by, w: bw, h: bh, act: 'categoria' });
  }
  if (state === 'win') creditos_pregunta_dibujar();
}

// ---------- Ciclo principal ----------
let ultimo = ahora();
function ciclo(t) {
  const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
  fps_n++; fps_t += dt; if (fps_t >= 0.5) { fps = Math.round(fps_n / fps_t); fps_n = 0; fps_t = 0; }
  try { actualizar(dt); dibujar(); }
  finally { entrada_fin_cuadro(); }
  requestAnimationFrame(ciclo);
}

// Arranca cuando las letras ya cargaron (los números de las banderas se pintan con ellas)
function arrancar() {
  sprites_crear();
  ir_al_titulo();
  requestAnimationFrame(ciclo);
}
ctx.fillStyle = '#1d2b1a'; ctx.fillRect(0, 0, W, H);
Promise.all([...['16px "Open Sans"', 'bold 16px "Open Sans"', '16px "Droid Sans Mono"'].map(f => document.fonts.load(f)),
  imagenes_cargar(['rescatista-lado', 'rescatista-frente', 'arbol'])])
  .catch(() => {}).finally(arrancar);
