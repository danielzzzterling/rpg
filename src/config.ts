// Calibración del detector y la curva RPG. Ajusta aquí contra tu físico.
// El detector usa 4 señales simultáneas y voto por mayoría; funciona desde
// cualquier ángulo de cámara (lateral, frontal, diagonal).

export const CONFIG = {
  // --- Umbrales por señal ---

  // 1. Ángulo del codo (grados). Lateral: nítido. Frontal: poco rango.
  ANGLE_UP: 160,
  ANGLE_DOWN: 90,

  // 2. Gap hombro↔muñeca / torso. Hombros sobre manos → arriba.
  GAP_UP: 0.5,
  GAP_DOWN: 0.25,

  // 3. Body scale: torso (dist hombro-hip) en coords normalizadas 0..1.
  // Grande = cuerpo cerca/largo en pantalla = abajo. El brazo del conteo
  // frontal: cuando te acercas a la cámara al bajar, el torso crece.
  SCALE_UP: 0.20,
  SCALE_DOWN: 0.32,

  // 4. Nose Y (coord MediaPipe, 0=arriba, 1=abajo). Más abajo en
  // pantalla = cuerpo bajo = abajo.
  NOSE_UP: 0.25,
  NOSE_DOWN: 0.55,

  // --- Una mano ---
  // Diferencia vertical muñeca/muñeca / torso. Súbelo si cuenta de más.
  // ponytail: heurística naïve, upgrade = clasificador k-NN (Google, ~200
  // muestras por pose).
  ONE_HAND_GAP: 0.35,

  // --- Sistema RPG ---
  XP_REP: 10,
  XP_ONE_HAND_MULT: 2,
  XP_BOSS_BONUS: 50,
  XP_CURVE_BASE: 100,
  BOSS_BASE_HP: 10,
  BOSS_SCALE: 3,

  // --- Rendimiento ---
  FPS: 20,
  CAM_W: 640,
  CAM_H: 480,

  // --- Recursos MediaPipe ---
  WASM_ROOT: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
  MODEL_URL: './pose-landmarker-full.task',
} as const
