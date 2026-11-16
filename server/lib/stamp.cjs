// updatedAt 자동 기록 — 의존성 없는 CJS. ESM(lib/dbBackup.js)·레거시 CJS(medalbank-api)·Nuxt(medalbank) 가 같이 쓴다.
'use strict'

// ── updatedAt 자동 기록 ───────────────────────────────────────────────
// 모든 쓰기(insert/update/replace/bulkWrite)에 updatedAt 을 자동으로 넣는다 — 증분 백업이 이 값을 기준으로 한다.
// 직접 지정한 updatedAt 은 덮어쓰지 않는다. 원본 값을 보존해야 하면(복원 등) 감싸지 않은 컬렉션을 쓴다.
const isOp = (u) => u && !Array.isArray(u) && Object.keys(u).some((k) => k.startsWith('$'))
const stampDoc = (d) => (d && typeof d === 'object' && !('updatedAt' in d) ? { ...d, updatedAt: new Date() } : d)
function stampUpdate(u) {
  if (Array.isArray(u)) return [...u, { $set: { updatedAt: '$$NOW' } }]          // 집계 파이프라인 업데이트
  if (!isOp(u)) return stampDoc(u)                                               // 치환 문서
  if (u.$set?.updatedAt !== undefined || u.$currentDate?.updatedAt !== undefined || u.$setOnInsert?.updatedAt !== undefined) return u
  return { ...u, $set: { ...(u.$set || {}), updatedAt: new Date() } }
}
const STAMPERS = {
  insertOne: (a) => [stampDoc(a[0]), ...a.slice(1)],
  insertMany: (a) => [(a[0] || []).map(stampDoc), ...a.slice(1)],
  updateOne: (a) => [a[0], stampUpdate(a[1]), ...a.slice(2)],
  updateMany: (a) => [a[0], stampUpdate(a[1]), ...a.slice(2)],
  findOneAndUpdate: (a) => [a[0], stampUpdate(a[1]), ...a.slice(2)],
  replaceOne: (a) => [a[0], stampDoc(a[1]), ...a.slice(2)],
  findOneAndReplace: (a) => [a[0], stampDoc(a[1]), ...a.slice(2)],
  bulkWrite: (a) => [(a[0] || []).map((op) => {
    const [k, v] = Object.entries(op)[0] || []
    if (k === 'insertOne') return { insertOne: { document: stampDoc(v.document) } }
    if (k === 'updateOne' || k === 'updateMany') return { [k]: { ...v, update: stampUpdate(v.update) } }
    if (k === 'replaceOne') return { replaceOne: { ...v, replacement: stampDoc(v.replacement) } }
    return op
  }), ...a.slice(1)],
}
function stamped(c) {
  return new Proxy(c, {
    get(t, prop) {
      const v = Reflect.get(t, prop, t)
      if (typeof v !== 'function') return v
      const st = STAMPERS[prop]
      return st ? (...a) => v.apply(t, st(a)) : v.bind(t)
    },
  })
}
// Db 를 감싸 collection() 이 돌려주는 컬렉션마다 stamped 를 적용한다. noStamp 에 든 이름은 그대로 둔다.
function stampDb(db, noStamp = []) {
  const skip = new Set(noStamp)
  return new Proxy(db, {
    get(t, prop) {
      if (prop === 'collection') return (name, ...a) => { const c = t.collection(name, ...a); return skip.has(name) ? c : stamped(c) }
      const v = Reflect.get(t, prop, t)
      return typeof v === 'function' ? v.bind(t) : v
    },
  })
}

module.exports = { stamped, stampDb }
