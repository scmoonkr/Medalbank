// ERP DB 백업 — 공용 구현(lib/dbBackup.js)에 ERP 설정만 얹는다.
//   예약: .env ERP_BACKUP_INTERVAL (cron 식, 매시간 정각 = 0 0 * * * *) · ERP_BACKUP_TZ(기본 Asia/Seoul)
//   클라우드: CLOUDE_MONGODB_BUCKET 의 erp/ 폴더
import { createBackup } from '../lib/dbBackup.js'
import { DB } from './db.js'

export const backup = createBackup({
  label: 'erp',
  app: 'MedalbankERP',
  getDb: DB,
  exclude: ['sessions'],            // 로그인 세션은 백업·복원 대상이 아니다
  noStamp: ['sessions'],
  prefix: 'erp',
  envInterval: 'ERP_BACKUP_INTERVAL',
  envTz: 'ERP_BACKUP_TZ',
  stateId: 'erpBackup',
})
