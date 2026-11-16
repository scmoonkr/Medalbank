import { MongoClient, Db } from 'mongodb'
// 쓰기에 updatedAt 을 자동으로 넣는다 — 증분 백업 기준. 공용 구현: server/lib/stamp.cjs
// @ts-ignore
import stampLib from '../../../server/lib/stamp.cjs'

declare global {
  // persist connection across Nitro hot-reloads
  var __ksrMongo: MongoClient | undefined
}

export async function getDb(): Promise<Db> {
  const config = useRuntimeConfig()
  const { mongoAddr, mongoUser, mongoPwd, mongoDb } = config

  if (!globalThis.__ksrMongo) {
    const uri = `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPwd)}@${mongoAddr}/${mongoDb}?authSource=admin`
    globalThis.__ksrMongo = new MongoClient(uri)
    await globalThis.__ksrMongo.connect()
  }

  return stampLib.stampDb(globalThis.__ksrMongo.db(mongoDb)) as Db
}
