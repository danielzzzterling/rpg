import './style.css'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CONFIG } from './config.ts'
import { analyze, RepCounter, type Analysis, type Point } from './detector.ts'
import {
  ACHIEVEMENTS,
  applyRep,
  bossHpFor,
  loadPlayer,
  savePlayer,
  titleFor,
  xpIntoLevel,
  type Player,
} from './rpg.ts'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const video = $<HTMLVideoElement>('cam')
const overlay = $<HTMLCanvasElement>('overlay')
const ctx = overlay.getContext('2d')!

let player: Player = loadPlayer()
const counter = new RepCounter()
let landmarker: PoseLandmarker | null = null
let running = false
let frontCam = true
let lastTs = 0
let toastTimer = 0

const SKELETON: [number, number][] = [
  [11, 12], // hombros
  [11, 13], [13, 15], // brazo izq
  [12, 14], [14, 16], // brazo der
  [11, 23], [12, 24], // torso
  [23, 24], // caderas
  [23, 25], [25, 27], // pierna izq
  [24, 26], [26, 28], // pierna der
]

const BOSSES = ['Dragón', 'Golem', 'Hidra', 'Titán', 'Liche', 'Behemoth']
const BOSS_EMOJI = ['🐉', '🗿', '🐍', '🗽', '💀', '🦖']
const bossLabel = (k: number) => `${BOSS_EMOJI[k % BOSSES.length]} ${BOSSES[k % BOSSES.length]}`

// ---------- HUD ----------

function renderHUD() {
  const { level, curr, need } = xpIntoLevel(player.xp)
  $('lvl').textContent = `Lv ${level}`
  $('title').textContent = titleFor(level)
  $('xp-fill').style.width = `${Math.min(100, (curr / need) * 100)}%`
  $('count').textContent = String(player.currentSet)
  $('set').textContent = `Set: ${player.currentSet}`
  $('best').textContent = `Mejor: ${player.bestSet}`

  const boss = $<HTMLDivElement>('boss-hud')
  boss.hidden = false
  const max = bossHpFor(player.bossKills)
  const hp = Math.max(0, player.bossHp)
  $('boss-name').textContent = bossLabel(player.bossKills)
  $('boss-hp').textContent = `${hp}/${max}`
  $('boss-fill').style.width = `${Math.min(100, (hp / max) * 100)}%`
}

function toast(msg: string) {
  const t = $('toast')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    t.hidden = true
  }, 1800)
}

function flashCount() {
  const el = $('count')
  el.classList.add('pop')
  setTimeout(() => el.classList.remove('pop'), 150)
}

function onRep(oneHanded: boolean) {
  const e = applyRep(player, oneHanded)
  savePlayer(player)
  flashCount()
  if (oneHanded) toast(`UNA MANO +${e.xpGained} XP 💪`)
  else toast(`+${e.xpGained} XP`)
  if (e.bossDefeated) {
    toast(`${bossLabel(player.bossKills - 1)} DERROTADO +${e.xpGained} XP ⚔️`)
  }
  if (e.leveledUp) toast(`¡NIVEL ${e.level}! ${titleFor(e.level)} 🎉`)
  for (const a of e.newAchievements) toast(`🏆 Logro: ${a}`)
  renderHUD()
}

// ---------- Cámara ----------

async function startCamera() {
  if (video.srcObject) {
    ;(video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: frontCam ? 'user' : 'environment',
      width: { ideal: CONFIG.CAM_W },
      height: { ideal: CONFIG.CAM_H },
    },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
}

async function initLandmarker() {
  if (landmarker) return
  const fileset = await FilesetResolver.forVisionTasks(CONFIG.WASM_ROOT)
  const opts = {
    baseOptions: {
      modelAssetPath: CONFIG.MODEL_URL,
      delegate: 'GPU' as const,
    },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
  }
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts)
  } catch {
    // algunos iPhones/Safari antiguos rechazan GPU
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      ...opts,
      baseOptions: { ...opts.baseOptions, delegate: 'CPU' },
    })
  }
}

async function lockScreen() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock
    await wl?.request('screen')
  } catch {
    /* no critical */
  }
}

// ---------- Skeleton ----------

function videoRect() {
  const vw = video.videoWidth || CONFIG.CAM_W
  const vh = video.videoHeight || CONFIG.CAM_H
  const cw = overlay.clientWidth
  const ch = overlay.clientHeight
  const s = Math.min(cw / vw, ch / vh)
  const w = vw * s
  const h = vh * s
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
}

function resizeCanvas() {
  if (overlay.width !== overlay.clientWidth || overlay.height !== overlay.clientHeight) {
    overlay.width = overlay.clientWidth
    overlay.height = overlay.clientHeight
  }
}

// ponytail: los landmarks son normalizados (0..1) del frame que entró al modelo.
// Se mapean al rect del video renderizado; la cámara frontal se espeja.
// Si en tu iPhone la pose sale volteada/rotada, es orientación de video: marca
// la diferencia aquí girando las coords (upgrade: ImageBitmap + detección a mano).
function drawSkeleton(pts: Point[] | null) {
  resizeCanvas()
  ctx.clearRect(0, 0, overlay.width, overlay.height)
  if (!pts) return
  const r = videoRect()
  const map = (p: Point): [number, number] => {
    const fx = frontCam ? 1 - p.x : p.x
    return [r.x + fx * r.w, r.y + p.y * r.h]
  }
  ctx.lineWidth = 3
  ctx.strokeStyle = '#ffb020'
  ctx.lineCap = 'round'
  for (const [a, b] of SKELETON) {
    if (!pts[a] || !pts[b]) continue
    const [x1, y1] = map(pts[a])
    const [x2, y2] = map(pts[b])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.fillStyle = '#ff6a3d'
  for (const p of pts) {
    const [x, y] = map(p)
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ---------- Loop ----------

function loop(ts: number) {
  if (!running) return
  if (ts - lastTs >= 1000 / CONFIG.FPS && landmarker && video.readyState >= 2) {
    lastTs = ts
    try {
      const res = landmarker.detectForVideo(video, ts)
      const lms = res.landmarks?.[0]
      if (lms && lms.length > 0) {
        const pts = lms.map(l => ({ x: l.x, y: l.y }))
        drawSkeleton(pts)
        const a: Analysis = analyze(pts)
        const rep = counter.update(a)
        if (rep) onRep(rep.oneHanded)
      } else {
        drawSkeleton(null)
      }
    } catch {
      /* frame puntual fallido, se sigue intentando */
    }
  }
  requestAnimationFrame(loop)
}

// ---------- Modales ----------

function renderAchievements() {
  $('ach-list').innerHTML = ACHIEVEMENTS.map(a => {
    const got = player.achievements.includes(a.id)
    return `<li class="${got ? '' : 'locked'}">${got ? '✅' : '🔒'} ${a.name} — ${a.desc}</li>`
  }).join('')
}

function renderStats() {
  $('stats-list').innerHTML = [
    ['Nivel', String(xpIntoLevel(player.xp).level)],
    ['Título', titleFor(xpIntoLevel(player.xp).level)],
    ['XP total', String(player.xp)],
    ['Push-ups', String(player.totalReps)],
    ['A una mano', String(player.oneHandedReps)],
    ['Mejor set', String(player.bestSet)],
    ['Racha actual', `${player.streak} día(s)`],
    ['Bosses derrotados', String(player.bossKills)],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('')
}

// ---------- Arranque ----------

async function startSession() {
  player.currentSet = 0
  savePlayer(player)
  renderHUD()
  $<HTMLElement>('start-screen').hidden = true
  try {
    await startCamera()
    await initLandmarker()
  } catch (err) {
    toast('No pude abrir la cámara: revisa permisos')
    console.error(err)
    return
  }
  running = true
  void lockScreen()
  requestAnimationFrame(loop)
}

function bind() {
  $('btn-start').addEventListener('click', () => void startSession())
  $('btn-add').addEventListener('click', () => onRep(false))
  $('btn-flip').addEventListener('click', () => {
    frontCam = !frontCam
    void startCamera().catch(e => console.error(e))
  })
  $('btn-ach').addEventListener('click', () => {
    renderAchievements()
    $<HTMLElement>('modal-ach').hidden = false
  })
  $('btn-close-ach').addEventListener('click', () => {
    $<HTMLElement>('modal-ach').hidden = true
  })
  $('btn-stats').addEventListener('click', () => {
    renderStats()
    $<HTMLElement>('modal-stats').hidden = false
  })
  $('btn-close-stats').addEventListener('click', () => {
    $<HTMLElement>('modal-stats').hidden = true
  })
}

renderHUD()
bind()