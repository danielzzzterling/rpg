import { CONFIG } from './config.ts'

// Índices de landmarks de PoseLandmarker (33 points)
export const LM = {
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
}

// Resumen de una pose: codo + señal de "mano suelta".
export function analyze(pts: Point[]): Analysis {
  const ls = pts[LM.leftShoulder]
  const rs = pts[LM.rightShoulder]
  const le = pts[LM.leftElbow]
  const re = pts[LM.rightElbow]
  const lw = pts[LM.leftWrist]
  const rw = pts[LM.rightWrist]
  const lh = pts[LM.leftHip]
  const rh = pts[LM.rightHip]

  const elbow = (angle3(ls, le, lw) + angle3(rs, re, rw)) / 2
  const torso = dist(
    { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 },
    { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 },
  )
  const wristGapNorm = torso > 0 ? Math.abs(lw.y - rw.y) / torso : 0
  return { elbow, wristGapNorm }
}

export type Phase = 'up' | 'down' | 'none'

export interface RepResult {
  oneHanded: boolean
}

// Máquina de estados: cuenta una rep en la transición abajo -> arriba.
// La "mano suelta" se decide con la poses de muñecas dentro de la fase abajo.
export class RepCounter {
  count = 0
  oneHandedCount = 0
  private phase: Phase = 'none'
  private lastGap = 0

  update(a: Analysis): RepResult | null {
    const next: Phase =
      a.elbow > CONFIG.ANGLE_UP ? 'up' : a.elbow < CONFIG.ANGLE_DOWN ? 'down' : this.phase
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