import { CONFIG } from './config.ts'

// Índices de landmarks de PoseLandmarker (33 points)
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const

export interface Point {
  x: number
  y: number
}

// Ángulo en el punto medio b, formado por a-b-c (0..180). Fórmula de Google.
export function angle3(a: Point, b: Point, c: Point): number {
  const rad =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let deg = Math.abs((rad * 180) / Math.PI)
  return deg > 180 ? 360 - deg : deg
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export interface Analysis {
  elbow: number // ángulo medio de ambos codos
  wristGapNorm: number // separación vertical muñeca/muñeca normalizada por torso
  shoulderGap: number // (muñeca.y - hombro.y) / torso; positivo = hombros sobre manos
  bodyScale: number // torso / frameHeight; grande = cerca de cámara = abajo
  noseY: number // y de la nariz (0..1); grande = abajo en pantalla
}

// Resumen de una pose.
export function analyze(pts: Point[]): Analysis {
  const ls = pts[LM.leftShoulder]
  const rs = pts[LM.rightShoulder]
  const le = pts[LM.leftElbow]
  const re = pts[LM.rightElbow]
  const lw = pts[LM.leftWrist]
  const rw = pts[LM.rightWrist]
  const lh = pts[LM.leftHip]
  const rh = pts[LM.rightHip]
  const nose = pts[LM.nose]

  const elbow = (angle3(ls, le, lw) + angle3(rs, re, rw)) / 2
  const shoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  const hip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
  const torso = dist(shoulder, hip)
  const wristMid = { x: (lw.x + rw.x) / 2, y: (lw.y + rw.y) / 2 }
  const wristGapNorm = torso > 0 ? Math.abs(lw.y - rw.y) / torso : 0
  const shoulderGap = torso > 0 ? (wristMid.y - shoulder.y) / torso : 0
  const bodyScale = torso
  return { elbow, wristGapNorm, shoulderGap, bodyScale, noseY: nose.y }
}

export type Phase = 'up' | 'down' | 'none'

export interface RepResult {
  oneHanded: boolean
}

// Máquina de estados con voto conjunto de 4 señales independientes. Robusta
// a cualquier ángulo de cámara: la señal que peor se ve queda en zona muerta
// y las demás deciden. La "mano suelta" se lee en la fase abajo.
export class RepCounter {
  count = 0
  oneHandedCount = 0
  private phase: Phase = 'none'
  private lastGap = 0

  get currentPhase(): Phase {
    return this.phase
  }

  // Devuelve el voto de cada señal para depuración: muestras votando up/down.
  votes(a: Analysis): { up: number; down: number } {
    let up = 0
    let down = 0
    if (a.elbow > CONFIG.ANGLE_UP) up++; else if (a.elbow < CONFIG.ANGLE_DOWN) down++
    if (a.shoulderGap > CONFIG.GAP_UP) up++; else if (a.shoulderGap < CONFIG.GAP_DOWN) down++
    if (a.bodyScale < CONFIG.SCALE_UP) up++; else if (a.bodyScale > CONFIG.SCALE_DOWN) down++
    if (a.noseY < CONFIG.NOSE_UP) up++; else if (a.noseY > CONFIG.NOSE_DOWN) down++
    return { up, down }
  }

  update(a: Analysis): RepResult | null {
    const v = this.votes(a)
    const next: Phase =
      v.up > v.down ? 'up' : v.down > v.up ? 'down' : this.phase
    // ponytail: empate = mantener fase (histéresis); si un ángulo mantiene
    // empate permanente, ajustar los umbrales de esa señal en CONFIG.
    if (next === 'down') this.lastGap = a.wristGapNorm
    if (next === 'up' && this.phase === 'down') {
      this.count++
      const oneHanded = this.lastGap >= CONFIG.ONE_HAND_GAP
      if (oneHanded) this.oneHandedCount++
      this.phase = next
      return { oneHanded }
    }
    this.phase = next
    return null
  }
}