// Self-check runnable: node --experimental-strip-types src/selfcheck.ts
import assert from 'node:assert'
import { CONFIG } from './config.ts'
import { angle3, analyze, RepCounter } from './detector.ts'
import { applyRep, bossHpFor, defaultPlayer, levelOf, titleFor } from './rpg.ts'

// --- detector: ángulos ---
assert.ok(Math.abs(angle3({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }) - 90) < 1e-9, 'ángulo recto')
assert.ok(Math.abs(angle3({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }) - 180) < 1e-9, 'brazo recto')

// --- detector: analyze (posturas sintéticas de plancha, en píxeles) ---
const blank = () => Array.from({ length: 33 }, () => ({ x: 0, y: 0 }))

// abajo: hombros casi a la altura de las muñecas (gap < GAP_DOWN), codos
// flexionados (ang. codo < 90), muñecas al ras (misma altura)
const down = blank()
down[11] = { x: 10, y: 100 }; down[12] = { x: 12, y: 100 }
down[13] = { x: 8, y: 80 }; down[14] = { x: 10, y: 80 }
down[15] = { x: 40, y: 106 }; down[16] = { x: 42, y: 106 }
down[23] = { x: 22, y: 130 }; down[24] = { x: 28, y: 134 }
const aDown = analyze(down)
assert.ok(aDown.elbow < CONFIG.ANGLE_DOWN, `codo plegado (${aDown.elbow})`)
assert.ok(aDown.wristGapNorm < 0.1, 'doble mano: muñecas a la misma altura')
assert.ok(aDown.shoulderGap < CONFIG.GAP_DOWN, `hombros bajos (${aDown.shoulderGap})`)

// arriba: brazos extendidos (colineales), hombros elevados sobre las manos
const up = blank()
up[11] = { x: 10, y: 0 }; up[12] = { x: 12, y: 0 }
up[13] = { x: 30, y: 60 }; up[14] = { x: 32, y: 60 }
up[15] = { x: 50, y: 110 }; up[16] = { x: 52, y: 110 }
up[23] = { x: 22, y: 22 }; up[24] = { x: 28, y: 26 }
const aUp = analyze(up)
assert.ok(aUp.elbow > CONFIG.ANGLE_UP, `codo extendido (${aUp.elbow})`)
assert.ok(aUp.shoulderGap > CONFIG.GAP_UP, `hombros elevados (${aUp.shoulderGap})`)

// una mano: muñeca derecha levantada hacia la cadera (mano libre)
const one = blank()
one[11] = { x: 10, y: 0 }; one[12] = { x: 12, y: 0 }
one[13] = { x: 10, y: 60 }; one[14] = { x: 12, y: 60 }
one[15] = { x: 40, y: 56 }; one[16] = { x: 35, y: 120 }
one[23] = { x: 22, y: 118 }; one[24] = { x: 28, y: 122 }
const aOne = analyze(one)
assert.ok(aOne.wristGapNorm >= CONFIG.ONE_HAND_GAP, `mano suelta detectada (${aOne.wristGapNorm})`)

// --- detector: conteo de reps (señal activa: gapY) ---
const c = new RepCounter()
assert.equal(c.update({ elbow: 175, wristGapNorm: 0, shoulderGap: 0.9 }), null, 'extender no cuenta')
assert.equal(c.update({ elbow: 60, wristGapNorm: 0, shoulderGap: 0.1 }), null, 'bajar no cuenta')
const r = c.update({ elbow: 175, wristGapNorm: 0, shoulderGap: 0.9 })
assert.ok(r && !r.oneHanded, 'rep normal')
assert.equal(c.count, 1)

const c2 = new RepCounter()
c2.update({ elbow: 175, wristGapNorm: 0, shoulderGap: 0.9 })
c2.update({ elbow: 60, wristGapNorm: 0.5, shoulderGap: 0.1 })
const r2 = c2.update({ elbow: 175, wristGapNorm: 0, shoulderGap: 0.9 })
assert.ok(r2 && r2.oneHanded, 'rep a una mano')
assert.equal(c2.oneHandedCount, 1)

// zona muerta entre umbrales no rompe el conteo
const c3 = new RepCounter()
c3.update({ elbow: 175, wristGapNorm: 0, shoulderGap: 0.9 })
c3.update({ elbow: 95, wristGapNorm: 0, shoulderGap: 0.4 })
c3.update({ elbow: 60, wristGapNorm: 0, shoulderGap: 0.1 })
c3.update({ elbow: 100, wristGapNorm: 0, shoulderGap: 0.35 })
c3.update({ elbow: 175, wristGapNorm: 0, shoulderGap: 0.9 })
assert.equal(c3.count, 1, 'histeresis')

// --- rpg: curva de niveles ---
assert.equal(levelOf(0), 1)
assert.equal(levelOf(CONFIG.XP_CURVE_BASE), 2)
assert.equal(levelOf(CONFIG.XP_CURVE_BASE * 3), 3)
assert.equal(levelOf(CONFIG.XP_CURVE_BASE * 3 - 1), 2)
assert.equal(titleFor(1), 'Novato')
assert.equal(titleFor(5), 'Guerrero')
assert.equal(titleFor(40), 'Leyenda')
assert.equal(bossHpFor(0), CONFIG.BOSS_BASE_HP)
assert.equal(bossHpFor(2), CONFIG.BOSS_BASE_HP + 2 * CONFIG.BOSS_SCALE)

// --- rpg: applyRep ---
const p = defaultPlayer()
const e1 = applyRep(p, false)
assert.equal(p.totalReps, 1)
assert.equal(p.xp, CONFIG.XP_REP)
assert.equal(e1.leveledUp, false)
assert.ok(p.achievements.includes('first'), 'logro primer empujón')
assert.ok(p.achievements.includes('onehand') === false, 'no hay logro de una mano todavía')

const p2 = defaultPlayer()
applyRep(p2, true)
assert.equal(p2.xp, CONFIG.XP_REP * CONFIG.XP_ONE_HAND_MULT, 'doble XP a una mano')
assert.ok(p2.achievements.includes('onehand'))

// boss: 10 reps normales matan al primer boss (HP 10)
const p3 = defaultPlayer()
let kills = 0
let sawDefeat = false
for (let i = 0; i < 10; i++) {
  const e = applyRep(p3, false)
  if (e.bossDefeated) {
    kills++
    sawDefeat = true
  }
}
assert.equal(kills, 1, 'una muerte de boss')
assert.ok(sawDefeat)
assert.equal(p3.bossHp, bossHpFor(1), 'respawn con más HP')
assert.ok(p3.achievements.includes('boss1'), 'logro cazaboss')

// mejor set no decrece
const p4 = defaultPlayer()
for (let i = 0; i < 3; i++) applyRep(p4, false)
applyRep(p4, false)
assert.equal(p4.bestSet, 4)

console.log('self-check OK')