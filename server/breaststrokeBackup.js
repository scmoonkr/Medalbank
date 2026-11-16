// Breaststroke DB(대회·기록·선수·수영장·팀 … ) 백업 — 공용 구현(lib/dbBackup.js)에 설정만 얹는다.
//   예약: .env BREASTSTROKE_BACKUP_INTERVAL (cron 식, 매시간 정각 = 0 0 * * * *) · BREASTSTROKE_BACKUP_TZ(기본 Asia/Seoul)
//   클라우드: CLOUDE_MONGODB_BUCKET 의 Breaststroke/ 폴더
//   화면(breaststroke 백엔드)용 API: /BR/backup/* — .env BREASTSTROKE_BACKUP_KEY 를 X-Backup-Key 헤더로 보내야 한다.
// 이 DB 에 쓰는 곳(레거시 medalbank-api · medalbank 레지스트리)은 각자 updatedAt 을 자동으로 넣는다(lib/stamp.cjs).
import { createBackup, backupKeyGuard } from './lib/dbBackup.js'
import { getBRRawDB } from './db.js'

export const backup = createBackup({
  label: 'breaststroke',
  app: 'Breaststroke',
  getDb: async () => getBRRawDB(),
  exclude: ['fs.files', 'fs.chunks'],      // GridFS 는 JSON 으로 담을 수 없어 뺀다
  noStamp: ['fs.files', 'fs.chunks'],
  prefix: 'Breaststroke',
  envInterval: 'BREASTSTROKE_BACKUP_INTERVAL',
  envTz: 'BREASTSTROKE_BACKUP_TZ',
  stateId: 'brBackup',
})

// breaststroke 백엔드에는 로그인이 없다. DB 통째 다운로드·복원을 아무나 부르지 못하도록 키로 막는다.
export const requireBackupKey = backupKeyGuard('BREASTSTROKE_BACKUP_KEY')
