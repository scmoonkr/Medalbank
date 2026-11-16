import { MongoClient } from 'mongodb'
import { stampDb } from './lib/dbBackup.js'

let client
let db
let stamped

export async function connectDB() {
  const { MONGODB_ADDR, MONGO_USERNAME, MONGO_PWD, MONGO_DBNAME } = process.env
  const uri = `mongodb://${MONGO_USERNAME}:${encodeURIComponent(MONGO_PWD)}@${MONGODB_ADDR}/${MONGO_DBNAME}?authSource=admin`
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(MONGO_DBNAME)
  stamped = stampDb(db, ['backupState'])      // 쓰기에 updatedAt 자동 기록 — 증분 백업 기준
  console.log(`MongoDB connected: ${MONGO_DBNAME}`)
}

// 쓰기에 updatedAt 이 자동으로 들어간다(lib/dbBackup.js).
export function getDB() {
  if (!stamped) throw new Error('DB not initialized. Call connectDB() first.')
  return stamped
}

// Breaststroke DB(같은 서버·계정) — 백업·복원 전용. 쓰기 쪽(레거시 medalbank-api·medalbank)은 따로 연결한다.
export function getBRRawDB() {
  if (!client) throw new Error('DB not initialized. Call connectDB() first.')
  return client.db(process.env.MONGO_DBNAME_BR || 'Breaststroke')
}

// 감싸지 않은 Db — 백업·복원이 원본 값을 그대로 다룰 때 쓴다.
export function getRawDB() {
  if (!db) throw new Error('DB not initialized. Call connectDB() first.')
  return db
}
