// swimmingPhotography DB 백업 — 공용 구현(lib/dbBackup.js)에 설정만 얹는다.
//   예약: .env SP_BACKUP_INTERVAL (cron 식, 매시간 정각 = 0 0 * * * *) · SP_BACKUP_TZ(기본 Asia/Seoul)
//   클라우드: CLOUDE_MONGODB_BUCKET 의 swimmingPhotography/ 폴더
// images 는 updatedAt 이 "저장 일자"라는 업무 값이라(화면의 일자 필터가 쓴다) 자동 기록·보정에서 뺀다.
// 대신 증분 백업은 updatedAt/createdAt 중 하나라도 기준 이후면 포함한다.
import { createBackup } from '../lib/dbBackup.js'
import { SPRAW } from './db.js'

export const backup = createBackup({
  label: 'sp',
  app: 'SwimmingPhotography',
  getDb: SPRAW,
  exclude: ['sessions'],            // 로그인 세션은 백업·복원 대상이 아니다
  noStamp: ['sessions', 'images'],
  looseSince: ['images'],
  prefix: 'swimmingPhotography',
  envInterval: 'SP_BACKUP_INTERVAL',
  envTz: 'SP_BACKUP_TZ',
  stateId: 'spBackup',
})
