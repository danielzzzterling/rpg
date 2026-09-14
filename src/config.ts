// Calibración del detector y la curva RPG. Ajusta aquí contra tu físico:
// la cámara lateral vs frontal y tu técnica cambian los umbrales.

export const CONFIG = {
  // Señal de conteo: 'gapY' cuenta la altura de los hombros sobre las manos
  // (robusta cuando la cámara ve el brazo de frente, teléfono en el piso);
  // 'elbow' usa el ángulo del codo (útil solo con cámara lateral).
  // Revisa los valores reales con el toggle 🎛️ del overlay antes de ajustar.
  SIGNAL: 'gapY' as 'gapY' | 'elbow',

  // Umbrales de gapY: distancia vertical (hombro medio -> muñeca media) / torso.
  // Arriba: hombros bien elevados sobre las manos (> GAP_UP).
  // Abajo: hombros casi a la altura de las muñecas (< GAP_DOWN).
  GAP_UP: 0.5,
  GAP_DOWN: 0.25,

  // Umbrales del codo (grados) solo para SIGNAL: 'elbow'.
  ANGLE_UP: 160,
  ANGLE_DOWN: 90,

  // Una mano: diferencia vertical entre muñecas normalizada por el torso.
  // 0.35 es un grueso razonable; súbelo si no detecta la mano suelta y
  // bájalo si cuenta de más.
  // ponytail: heurística naïvede gap vertical, ceiling = falsos positivos con
  // apoyos irregulares; upgrade si el físico lo pide = clasificador k-NN
  // (camino documentado por Google con ~200 muestras por pose).
  ONE_HAND_GAP: 0.35,

  // Sistema RPG
  XP_REP: 10,
  XP_ONE_HAND_MULT: 2,
  XP_BOSS_BONUS: 50,
  XP_CURVE_BASE: 100, // XP para subir de nivel N a N+1
  BOSS_BASE_HP: 10,
  BOSS_SCALE: 3,

  // Rendimiento
  FPS: 20,
  CAM_W: 640,
  CAM_H: 480,

  // Recursos MediaPipe (wasm desde CDN del mismo paquete, modelo local)
  WASM_ROOT: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
  MODEL_URL: './pose-landmarker-lite.task',
} as const