// MongoDB 백업·복원 공용 — ERP · swimmingPhotography 가 같은 코드를 옵션만 바꿔 쓴다.
//   1) updatedAt 자동 기록(stampDb / stamped)  2) 전체·증분 백업 zip  3) 클라우드(iDrive e2) 업로드 + cron 예약
//   4) 관리자용 Express 라우터(다운로드·클라우드 즉시 백업·복원)
// zip 안: manifest.json + <컬렉션>.json (MongoDB Extended JSON 배열 — ObjectId·Date 가 복원된다)
import { Router } from 'express'
import multer from 'multer'
import cron from 'node-cron'
import { Readable, PassThrough } from 'node:stream'
import { BSON } from 'mongodb'
import { ZipArchive } from 'archiver'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const { EJSON } = BSON

// ── 시각 ─────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const KST = 9 * 3600 * 1000
// 'yyyy-mm-dd hh:mm:ss'(한국시간) → Date. 형식이 틀리거나 없는 날짜면 null.
export function parseKst(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim())
  if (!m) return null
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number)
  const t = Date.UTC(y, mo - 1, d, h, mi, se) - KST
  const back = new Date(t + KST)
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || se > 59) return null
  return new Date(t)
}
export const fmtKst = (d) => { const k = new Date(d.getTime() + KST); return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}:${pad(k.getUTCSeconds())}` }
const stampName = (d) => fmtKst(d).replace(/[-:]/g, '').replace(' ', '-')

// updatedAt 자동 기록은 CJS(lib/stamp.cjs) — 레거시 CJS 서버·Nuxt 앱도 같은 코드를 쓴다.
import stampLib from './stamp.cjs'
export const { stamped, stampDb } = stampLib

// 파일 하나가 갖는 JSON 배열을 문자열 조각으로 흘려 보낸다(메모리에 다 올리지 않는다).
async function* jsonArray(cursor) {
  let first = true
  yield '[\n'
  for await (const doc of cursor) {
    yield (first ? '' : ',\n') + EJSON.stringify(doc)
    first = false
  }
  yield '\n]\n'
}

let _s3
const s3 = () => (_s3 ||= new S3Client({
  endpoint: process.env.CLOUD_ENDPOINT,
  region: process.env.CLOUD_REGION ?? 'auto',
  credentials: { accessKeyId: process.env.CLOUD_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUD_SECRET_ACCESS_KEY },
  forcePathStyle: false,
}))
const bucket = () => process.env.CLOUDE_MONGODB_BUCKET || process.env.CLOUD_MONGODB_BUCKET

// 로그인이 없는 백엔드(aquatics · breaststroke)용 — 환경변수의 키를 X-Backup-Key 헤더로 보내야 통과한다.
// 키가 설정돼 있지 않으면 API 전체가 꺼진다(예약 백업은 영향 없음).
import crypto from 'node:crypto'
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest()
export const backupKeyGuard = (envName) => (req, res, next) => {
  const want = process.env[envName]
  if (!want) return res.status(503).json({ error: `${envName} 가 설정되지 않아 백업 API 가 꺼져 있습니다 (.env 확인).` })
  const got = req.get('x-backup-key') || ''
  if (!got || !crypto.timingSafeEqual(digest(got), digest(want))) return res.status(401).json({ error: '백업 키가 올바르지 않습니다.' })
  req.user = { username: 'backup-key' }
  next()
}

/**
 * @param {object} o
 * @param {string}   o.label        로그 머리말 (예: 'erp')
 * @param {string}   o.app          manifest 의 app 이름
 * @param {() => Promise<import('mongodb').Db>} o.getDb   감싸지 않은(raw) Db
 * @param {string[]} [o.exclude]    백업·복원에서 뺄 컬렉션
 * @param {string[]} [o.noStamp]    updatedAt 을 자동으로 넣지도, 보정하지도 않을 컬렉션 (updatedAt 이 업무 값인 곳)
 * @param {string[]} [o.looseSince] 증분 기준을 updatedAt/createdAt/at 중 하나라도 만족하면 포함할 컬렉션 (noStamp 용)
 * @param {string}   o.prefix       클라우드 버킷 안의 폴더 (예: 'erp')
 * @param {string}   o.envInterval  예약 주기 환경변수 이름 (cron 식)
 * @param {string}   o.envTz        시간대 환경변수 이름
 * @param {string}   o.stateId      기준 시각을 저장할 backupState 문서 _id
 */
export function createBackup(o) {
  const exclude = [...(o.exclude || []), 'backupState']
  const noStamp = o.noStamp || []
  const loose = new Set(o.looseSince || [])
  const log = (...a) => console.log(`[${o.label}-backup]`, ...a)
  const rawCol = async (name) => (await o.getDb()).collection(name)

  async function backupCollections() {
    const list = await (await o.getDb()).listCollections({}, { nameOnly: true }).toArray()
    return list.map((c) => c.name).filter((n) => !n.startsWith('system.') && !exclude.includes(n)).sort()
  }

  // 자동 기록이 생기기 전에 저장된 문서에는 updatedAt 이 없다. createdAt → at → _id(ObjectId 생성시각) 순으로 채운다.
  // 이게 없으면 증분 백업에서 옛 문서가 영영 빠진다. 이미 있으면 아무 일도 하지 않는다.
  async function backfillUpdatedAt() {
    const db = await o.getDb()
    for (const name of await backupCollections()) {
      if (noStamp.includes(name)) continue
      const c = db.collection(name)
      const r = await c.updateMany({ updatedAt: { $exists: false } }, [{
        $set: { updatedAt: { $ifNull: ['$createdAt', { $ifNull: ['$at', { $convert: { input: '$_id', to: 'date', onError: '$$NOW', onNull: '$$NOW' } }] }] } },
      }])
      if (r.modifiedCount) log(`${name} ${r.modifiedCount}건에 updatedAt 을 채웠습니다.`)
      await c.createIndex({ updatedAt: 1 })
    }
  }

  const sinceFilter = (name, since) => {
    if (!since) return {}
    if (loose.has(name)) return { $or: [{ updatedAt: { $gte: since } }, { createdAt: { $gte: since } }, { at: { $gte: since } }] }
    return { updatedAt: { $gte: since } }
  }

  // 백업 내용을 센다 — 파일명·manifest 를 정하고, "바뀐 게 없으면 건너뛰기"를 판단하는 데 쓴다.
  async function planBackup({ mode, since }) {
    const db = await o.getDb()
    const names = await backupCollections()
    const counts = {}
    for (const n of names) counts[n] = await db.collection(n).countDocuments(sinceFilter(n, since))
    const now = new Date()
    const manifest = {
      app: o.app, db: db.databaseName, mode, createdAt: now.toISOString(), createdAtKst: fmtKst(now),
      since: since ? since.toISOString() : null, sinceKst: since ? fmtKst(since) : null, collections: counts,
      note: mode === 'incremental' ? '삭제된 문서는 증분 백업에 포함되지 않는다.' : undefined,
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const tag = o.prefix.replace(/[^A-Za-z0-9]/g, '')
    return { db, names, since, manifest, total, file: `${tag}-${mode === 'full' ? 'full' : 'incr'}-${stampName(now)}.zip` }
  }

  async function writeZip(plan, target, onError) {
    const zip = new ZipArchive({ zlib: { level: 6 } })
    zip.on('error', (e) => { console.error(`[${o.label}-backup] zip 오류:`, e.message); onError?.(e) })
    zip.pipe(target)
    zip.append(JSON.stringify(plan.manifest, null, 2), { name: 'manifest.json' })
    for (const n of plan.names) zip.append(Readable.from(jsonArray(plan.db.collection(n).find(sinceFilter(n, plan.since)).sort({ _id: 1 }))), { name: `${n}.json` })
    await zip.finalize()
  }

  // ── 클라우드 업로드 ────────────────────────────────────────────────
  // force: 'full' 이면 기록과 상관없이 전체. 그 외에는 기록이 있으면 증분, 없으면 전체.
  // 기준은 "끝난 시각"이 아니라 "시작한 시각" — 올리는 중에 바뀐 문서도 놓치지 않는다(겹치는 건 복원이 _id 기준이라 무해).
  let running = false
  async function runBackup({ force } = {}) {
    if (running) { console.warn(`[${o.label}-backup] 이전 백업이 아직 진행 중이라 건너뜁니다.`); return { error: '이전 백업이 아직 진행 중입니다.' } }
    running = true
    try {
      const B = bucket()
      if (!B) throw new Error('CLOUDE_MONGODB_BUCKET 가 설정되지 않았습니다 (.env 확인)')
      const state = await rawCol('backupState')
      const started = new Date()
      const last = await state.findOne({ _id: o.stateId })
      const since = last?.lastStartedAt ? new Date(last.lastStartedAt) : null
      const mode = since && force !== 'full' ? 'incremental' : 'full'
      const plan = await planBackup({ mode, since: mode === 'incremental' ? since : null })

      if (mode === 'incremental' && plan.total === 0) {      // 바뀐 게 없으면 올리지 않고 기준만 옮긴다
        await state.updateOne({ _id: o.stateId }, { $set: { lastStartedAt: started, lastCheckedAt: new Date(), lastResult: 'no-change' } }, { upsert: true })
        log(`${fmtKst(since)} 이후 변경 없음 — 업로드 생략`)
        return { skipped: true, since: fmtKst(since) }
      }

      const chunks = []
      const sink = new PassThrough()
      sink.on('data', (c) => chunks.push(c))
      const done = new Promise((resolve, reject) => { sink.on('end', resolve); sink.on('error', reject) })
      await writeZip(plan, sink, (e) => sink.destroy(e))
      await done
      const body = Buffer.concat(chunks)
      const key = `${o.prefix}/${plan.file}`
      await s3().send(new PutObjectCommand({ Bucket: B, Key: key, Body: body, ContentType: 'application/zip' }))

      await state.updateOne({ _id: o.stateId }, { $set: { lastStartedAt: started, lastUploadedAt: new Date(), lastKey: key, lastMode: mode, lastBytes: body.length, lastResult: 'ok' } }, { upsert: true })
      log(`${mode} → ${B}/${key} (${plan.total}건, ${(body.length / 1024).toFixed(1)}KB)`)
      return { key, mode, total: plan.total, bytes: body.length }
    } catch (e) {
      console.error(`[${o.label}-backup] 실패:`, e.message)
      return { error: e.message }
    } finally {
      running = false
    }
  }

  // cron 식(초 포함 6칸 가능)으로 예약. 비우면 끈다.  매시간 정각: 0 0 * * * *
  function startBackupSchedule() {
    const expr = (process.env[o.envInterval] || '').trim()
    if (!expr) return
    if (!cron.validate(expr)) { console.error(`[${o.label}-backup] ${o.envInterval} 형식 오류: "${expr}" (cron 식, 예: 0 0 * * * *)`); return }
    if (!bucket()) { console.error(`[${o.label}-backup] CLOUDE_MONGODB_BUCKET 가 없어 예약 백업을 켜지 않습니다.`); return }
    const timezone = process.env[o.envTz] || 'Asia/Seoul'
    cron.schedule(expr, () => { runBackup() }, { timezone })
    log(`예약 백업 시작: "${expr}" (${timezone}) → ${bucket()}/${o.prefix}/`)
  }

  // 서버 시작 시 한 번: updatedAt 보정 + 예약 켜기
  function init() {
    backfillUpdatedAt().catch((e) => console.error(`[${o.label}-backup] updatedAt 보정 실패:`, e.message))
    startBackupSchedule()
  }

  // ── 라우터 (마운트하는 쪽에서 관리자 권한을 확인한다) ───────────────────
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } })

  async function sendZip(res, opts) {
    const plan = await planBackup(opts)
    res.setHeader('content-type', 'application/zip')
    res.setHeader('content-disposition', `attachment; filename="${plan.file}"`)
    res.setHeader('x-backup-filename', plan.file)
    res.setHeader('access-control-expose-headers', 'x-backup-filename')
    await writeZip(plan, res, (e) => res.destroy(e))
  }
  const fail = (res, e) => { if (!res.headersSent) res.status(500).json({ error: e.message }); else res.destroy(e) }

  router.get('/collections', async (_req, res) => {
    try { res.json({ items: await backupCollections() }) } catch (e) { fail(res, e) }
  })
  router.post('/full', async (_req, res) => {
    try { await sendZip(res, { mode: 'full' }) } catch (e) { fail(res, e) }
  })
  router.post('/incremental', async (req, res) => {
    const since = parseKst(req.body?.since)
    if (!since) return res.status(400).json({ error: '기준 시각은 yyyy-mm-dd hh:mm:ss 형식(한국시간)으로 입력하세요.' })
    try { await sendZip(res, { mode: 'incremental', since }) } catch (e) { fail(res, e) }
  })
  // 지금 바로 클라우드에 백업. mode: 'full' | 'incremental'(마지막 백업 이후, 기록이 없으면 전체)
  router.post('/cloud', async (req, res) => {
    const r = await runBackup({ force: req.body?.mode === 'full' ? 'full' : undefined })
    if (r?.error) return res.status(500).json({ error: r.error })
    res.json(r)
  })
  // 복원 — 백업 JSON 한 개를 고른 컬렉션에 _id 기준으로 덮어쓴다(없으면 추가). 파일에 없는 문서는 건드리지 않는다.
  // updatedAt 을 그대로 보존해야 하므로 자동 기록이 없는 raw 컬렉션을 쓴다.
  router.post('/restore', upload.single('file'), async (req, res) => {
    try {
      const name = String(req.body?.collection || '')
      if (!(await backupCollections()).includes(name)) return res.status(400).json({ error: '복원할 수 없는 컬렉션입니다.' })
      if (!req.file) return res.status(400).json({ error: '파일을 선택하세요.' })
      let docs
      try { docs = EJSON.parse(req.file.buffer.toString('utf8')) } catch { return res.status(400).json({ error: 'JSON 파일을 읽을 수 없습니다.' }) }
      if (!Array.isArray(docs)) return res.status(400).json({ error: '백업 파일은 문서 배열이어야 합니다.' })
      if (docs.some((d) => !d || typeof d !== 'object' || d._id === undefined)) return res.status(400).json({ error: '_id 가 없는 문서가 있습니다.' })
      if (!docs.length) return res.json({ collection: name, total: 0, inserted: 0, updated: 0 })
      const c = await rawCol(name)
      let inserted = 0
      let updated = 0
      for (let i = 0; i < docs.length; i += 500) {
        const r = await c.bulkWrite(docs.slice(i, i + 500).map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })), { ordered: false })
        inserted += r.upsertedCount
        updated += r.modifiedCount
      }
      log(`복원 ${name}: ${docs.length}건 (추가 ${inserted}, 수정 ${updated}) by ${req.user?.username}`)
      res.json({ collection: name, total: docs.length, inserted, updated })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  return { router, init, runBackup, backupCollections, backfillUpdatedAt, startBackupSchedule }
}
