import { CONFIG } from './config.ts'

const SAVE_KEY = 'pushup-rpg-save'

export interface Player {
  xp: number
  totalReps: number
  oneHandedReps: number
  bestSet: number
  currentSet: number
  streak: number
  lastWorkoutDay: string
  achievements: string[]
  bossKills: number
  bossHp: number
}

export function bossHpFor(kill: number): number {
  return CONFIG.BOSS_BASE_HP + kill * CONFIG.BOSS_SCALE
}

export function defaultPlayer(): Player {
  return {
    xp: 0,
    totalReps: 0,
    oneHandedReps: 0,
    bestSet: 0,
    currentSet: 0,
    streak: 0,
    lastWorkoutDay: '',
    achievements: [],
    bossKills: 0,
    bossHp: bossHpFor(0),
  }
}

// localStorage en try/catch: Safari modo privado tira y no queremos romper la sesión.
export function loadPlayer(): Player {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) return { ...defaultPlayer(), ...JSON.parse(raw) }
  } catch {
    /* sin storage */
  }
  return defaultPlayer()
}

export function savePlayer(p: Player): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p))
  } catch {
    /* dato vivo en memoria hasta cerrar; no re-lanza */
  }
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayKey = () => localISO(new Date())
const yesterdayKey = () => localISO(new Date(Date.now() - 86_400_000))

function touchStreak(p: Player): void {
  const t = todayKey()
  if (p.lastWorkoutDay !== t) {
    p.streak = p.lastWorkoutDay === yesterdayKey() ? p.streak + 1 : 1
    p.lastWorkoutDay = t
  }
}

// Nivel según XP acumulada (subir de L a L+1 cuesta CURVE_BASE * L).
export function levelOf(xp: number): number {
  let lvl = 1
  let rem = xp
  while (rem >= CONFIG.XP_CURVE_BASE * lvl) {
    rem -= CONFIG.XP_CURVE_BASE * lvl
    lvl++
  }
  return lvl
}

export function xpIntoLevel(xp: number): { level: number; curr: number; need: number } {
  const level = levelOf(xp)
  let curr = xp
  for (let l = 1; l < level; l++) curr -= CONFIG.XP_CURVE_BASE * l
  return { level, curr, need: CONFIG.XP_CURVE_BASE * level }
}

export const TITLES: [number, string][] = [
  [1, 'Novato'],
  [5, 'Guerrero'],
  [10, 'Veterano'],
  [15, 'Campeón'],
  [20, 'Élite'],
  [30, 'Maestro'],
  [40, 'Leyenda'],
]
export function titleFor(level: number): string {
  let t = TITLES[0][1]
  for (const [l, name] of TITLES) if (level >= l) t = name
  return t
}

export interface Achievement {
  id: string
  name: string
  desc: string
  check: (p: Player) => boolean
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'Primer empujón', desc: '1 push-up', check: p => p.totalReps >= 1 },
  { id: 'onehand', name: 'La mano que falta', desc: '1 push-up a una mano', check: p => p.oneHandedReps >= 1 },
  { id: 'set10', name: 'Serie de 10', desc: '10 reps en un set', check: p => p.bestSet >= 10 },
  { id: 'set25', name: 'Serie de 25', desc: '25 reps en un set', check: p => p.bestSet >= 25 },
  { id: 'lvl5', name: 'Nivel 5', desc: 'Alcanza nivel 5', check: p => levelOf(p.xp) >= 5 },
  { id: 'lvl10', name: 'Nivel 10', desc: 'Alcanza nivel 10', check: p => levelOf(p.xp) >= 10 },
  { id: 'total100', name: 'Centuria', desc: '100 push-ups totales', check: p => p.totalReps >= 100 },
  { id: 'total500', name: 'Quinientos', desc: '500 push-ups totales', check: p => p.totalReps >= 500 },
  { id: 'streak3', name: 'Racha x3', desc: '3 días seguidos', check: p => p.streak >= 3 },
  { id: 'streak7', name: 'Racha x7', desc: '7 días seguidos', check: p => p.streak >= 7 },
  { id: 'boss1', name: 'Cazaboss', desc: 'Derrota 1 boss', check: p => p.bossKills >= 1 },
  { id: 'boss10', name: 'Cazaboss mayor', desc: 'Derrota 10 bosses', check: p => p.bossKills >= 10 },
]

export function grantAchievements(p: Player): string[] {
  const fresh: string[] = []
  for (const a of ACHIEVEMENTS)
    if (!p.achievements.includes(a.id) && a.check(p)) {
      p.achievements.push(a.id)
      fresh.push(a.name)
    }
  return fresh
}

export interface RepEvents {
  xpGained: number
  leveledUp: boolean
  level: number
  newAchievements: string[]
  bossDefeated: boolean
}

// Registra una rep (normal o a una mano) en el jugador y devuelve eventos de UI.
export function applyRep(p: Player, oneHanded: boolean): RepEvents {
  const before = levelOf(p.xp)
  const base = CONFIG.XP_REP * (oneHanded ? CONFIG.XP_ONE_HAND_MULT : 1)
  p.xp += base
  p.totalReps++
  p.currentSet++
  if (p.currentSet > p.bestSet) p.bestSet = p.currentSet
  if (oneHanded) p.oneHandedReps++
  touchStreak(p)

  let bossDefeated = false
  let bonus = 0
  p.bossHp -= oneHanded ? 2 : 1
  if (p.bossHp <= 0) {
    bossDefeated = true
    bonus = CONFIG.XP_BOSS_BONUS * (1 + p.bossKills)
    p.xp += bonus
    p.bossKills++
    p.bossHp = bossHpFor(p.bossKills)
  }

  const level = levelOf(p.xp)
  return {
    xpGained: base + bonus,
    leveledUp: level > before,
    level,
    newAchievements: grantAchievements(p),
    bossDefeated,
  }
}