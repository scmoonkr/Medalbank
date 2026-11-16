// MedalbankAquatics DB(사진 서비스: images · athletes · meets · request …) 백업 — 공용 구현(lib/dbBackup.js)에 설정만 얹는다.
//   예약: .env AQUATICS_BACKUP_INTERVAL (cron 식, 매시간 정각 = 0 0 * * * *) · AQUATICS_BACKUP_TZ(기본 Asia/Seoul)
//   클라우드: CLOUDE_MONGODB_BUCKET 의 MedalbankAquatics/ 폴더
//   화면(aquatics 백엔드)용 API: /api/admin/backup/* — .env AQUATICS_BACKUP_KEY 를 X-Backup-Key 헤더로 보내야 한다.
import { createBackup, backupKeyGuard } from './lib/dbBackup.js'
import { getRawDB } from './db.js'

export const backup = createBackup({
  label: 'aquatics',
  app: 'MedalbankAquatics',
  getDb: async () => getRawDB(),
  prefix: 'MedalbankAquatics',
  envInterval: 'AQUATICS_BACKUP_INTERVAL',
  envTz: 'AQUATICS_BACKUP_TZ',
  stateId: 'aquaBackup',
})

// aquatics 백엔드에는 로그인이 없다. DB 통째 다운로드·복원을 아무나 부르지 못하도록 AQUATICS_BACKUP_KEY 로 막는다.
export const requireBackupKey = backupKeyGuard('AQUATICS_BACKUP_KEY')
