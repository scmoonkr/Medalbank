// MongoDB 연결 — .env 의 MONGODB_ADDR / MONGO_USERNAME / MONGO_PWD 사용.
// SwimmingPhotography DB(articles 등) 접근용. 연결은 최초 1회만 맺고 재사용한다.
import { MongoClient } from 'mongodb'
import { stampDb } from '../lib/dbBackup.js'

let clientPromise = null

// env 는 호출 시점에 읽는다 (dotenv.config 이후 보장 — import 순서 문제 회피)
function buildUri() {
  const addr = process.env.MONGODB_ADDR
  const user = process.env.MONGO_USERNAME
  const pwd = process.env.MONGO_PWD
  const authSource = process.env.MONGO_AUTHSOURCE || 'admin'
  if (!addr) throw new Error('MONGODB_ADDR 가 설정되지 않았습니다 (.env 확인)')
  const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pwd || '')}@` : ''
  return `mongodb://${auth}${addr}/?authSource=${authSource}`
}

export function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(buildUri(), { serverSelectionTimeoutMS: 8000 })
    clientPromise = client.connect().catch((e) => { clientPromise = null; throw e })
  }
  return clientPromise
}

export async function getDb(name) {
  const client = await getClient()
  return client.db(name)
}

// SwimmingPhotography DB (기사/속보 등)
// 쓰기에 updatedAt 이 자동으로 들어간다(증분 백업 기준). images 는 updatedAt 이 업무 값(저장 일자)이라 뺀다.
export const SP_NO_STAMP = ['sessions', 'images', 'backupState']
export const SPRAW = () => getDb(process.env.MONGO_DBNAME_SP || 'SwimmingPhotography')   // 백업·복원용(감싸지 않음)
export const SP = async () => stampDb(await SPRAW(), SP_NO_STAMP)
// Breaststroke DB (대회/기록/수영장/팀)
export const BR = () => getDb(process.env.MONGO_DBNAME_BR || 'Breaststroke')
// MedalbankAquatics DB (이미지)
export const MA = () => getDb(process.env.MONGO_DBNAME_MA || 'MedalbankAquatics')
