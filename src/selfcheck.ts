// Self-check runnable: node --experimental-strip-types src/selfcheck.ts
import assert from 'node:assert'
import { CONFIG } from './config.ts'
import { angle3, analyze, RepCounter } from './detector.ts'
import { applyRep, bossHpFor, defaultPlayer, levelOf, titleFor } from './rpg.ts'

// --- detector: ángulos ---
assert.ok(Math.abs(angle3({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }) - 90) < 1e-9, 'ángulo recto')
assert.ok(Math.abs(angle3({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }) - 180) < 1e-9, 'brazo recto')

// --- detector: analyze (posturas sintéticas en coords normalizadas 0..1) ---
const blank = () => Array.from({ length: 33 }, () => ({ x: 0, y: 0 }))

// abajo: cuerpo cerca de la cámara (torso grande), nariz baja en pantalla,
// codo plegado, muñecas al ras
const down = blank()
down[0] = { x: 0.1, y: 0.67 }
down[11] = { x: 0.21, y: 0.625 }; down[12] = { x: 0.25, y: 0.625 }
down[13] = { x: 0.125, y: 0.708 }; down[14] = { x: 0.167, y: 0.708 }
down[15] = { x: 0.31, y: 0.75 }; down[16] = { x: 0.35, y: 0.75 }
down[23] = { x: 0.23, y: 0.979 }; down[24] = { x: 0.27, y: 0.979 }
const aDown = analyze(down)
assert.ok(aDown.elbow < CONFIG.ANGLE_DOWN, `codo plegado (${aDown.elbow})`)
assert.ok(aDown.wristGapNorm < 0.1, 'doble mano: muñecas a la misma altura')
assert.ok(aDown.noseY > CONFIG.NOSE_DOWN, `nariz abajo (${aDown.noseY})`)
assert.ok(aDown.bodyScale > CONFIG.SCALE_DOWN, `torso grande/cerca (${aDown.bodyScale})`)

// arriba: cuerpo lejos (torso chico), nariz alta, brazos extendidos
const up = blank()
up[0] = { x: 0.05, y: 0.13 }
up[11] = { x: 0.25, y: 0.17 }; up[12] = { x: 0.29, y: 0.17 }
up[13] = { x: 0.33, y: 0.20 }; up[14] = { x: 0.375, y: 0.20 }
up[15] = { x: 0.40, y: 0.23 }; up[16] = { x: 0.44, y: 0.23 }
up[23] = { x: 0.28, y: 0.33 }; up[24] = { x: 0.30, y: 0.34 }
const aUp = analyze(up)
assert.ok(aUp.elbow > CONFIG.ANGLE_UP, `codo extendido (${aUp.elbow})`)
assert.ok(aUp.noseY < CONFIG.NOSE_UP, `nariz arriba (${aUp.noseY})`)
assert.ok(aUp.bodyScale < CONFIG.SCALE_UP, `torso chico/lejos (${aUp.bodyScale})`)

// una mano: muñeca derecha levantada hacia la cadera (mano libre)
const one = blank()
one[11] = { x: 0.21, y: 0.625 }; one[12] = { x: 0.25, y: 0.625 }
one[13] = { x: 0.125, y: 0.708 }; one[14] = { x: 0.167, y: 0.708 }
one[15] = { x: 0.31, y: 0.75 }; one[16] = { x: 0.28, y: 0.90 }
one[23] = { x: 0.23, y: 0.979 }; one[24] = { x: 0.27, y: 0.979 }
const aOne = analyze(one)
assert.ok(aOne.wristGapNorm >= CONFIG.ONE_HAND_GAP, `mano suelta detectada (${aOne.wristGapNorm})`)

// --- detector: voto por mayoría ---
const c = new RepCounter()
assert.ok(c.votes(aUp).up >= 2, 'arriba: mayoría de votos up')
assert.ok(c.votes(aDown).down >= 2, 'abajo: mayoría de votos down')
assert.equal(c.update(aUp), null, 'extender no cuenta')
assert.equal(c.update(aDown), null, 'bajar no cuenta')
const r = c.update(aUp)
assert.ok(r && !r.oneHanded, 'rep normal')
assert.equal(c.count, 1)

const c2 = new RepCounter()
c2.update(aUp)
const aDownOneHanded = { ...aDown, wristGapNorm: 0.6 }
c2.update(aDownOneHanded)
const r2 = c2.update(aUp)
assert.ok(r2 && r2.oneHanded, 'rep a una mano')
assert.equal(c2.oneHandedCount, 1)

// zonas muertas no rompen el conteo (empate = mantener fase)
const neutral = { elbow: 120, wristGapNorm: 0, shoulderGap: 0.4, bodyScale: 0.26, noseY: 0.4 }
const c3 = new RepCounter()
c3.update(aUp)
c3.update(neutral)
c3.update(aDown)
c3.update(neutral)
c3.update(aUp)
assert.equal(c3.count, 1, 'histeresis')

// empate sin empezar no decide por nadie
const c4 = new RepCounter()
assert.equal(c4.update(neutral), null, 'neutral no decide')
assert.equal(c4.currentPhase, 'none')

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