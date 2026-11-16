# MongoDB 사용 현황 (service별)

모든 서비스가 **같은 MongoDB 서버·계정**(`.env` 의 `MONGODB_ADDR` / `MONGO_USERNAME` / `MONGO_PWD`, `authSource=admin`)을 쓰고, **데이터베이스만 다르다.**
(코드·`.env` 기준으로 정리. 실제 서버의 컬렉션과는 다를 수 있다.)

## 1. 데이터베이스 한눈에 보기

| DB | 환경변수 | 기본값 | 주로 쓰는 서비스 |
|---|---|---|---|
| `Breaststroke` | `MONGO_DBNAME_BR` | `Breaststroke` | medalbank(registry), swimmingPhotography API(읽기/일부 쓰기) |
| `MedalbankAquatics` | `MONGO_DBNAME`, `MONGO_DBNAME_MA` | `MedalbankAquatics` | server(사진 서비스 API) |
| `SwimmingPhotography` | `MONGO_DBNAME_SP` | `SwimmingPhotography` | server/swimmingPhotography (기사·영상·대회) |
| `MedalbankERP` | `MONGO_DBNAME_ERP` | `MedalbankERP` | server/erp (ERP) |

## 2. service ↔ DB 요약

| service (PM2 이름 / 포트) | 코드 위치 | 연결 DB | 비고 |
|---|---|---|---|
| medalbank-aquatics-api (server) | `server/` | `MedalbankAquatics` | `server/db.js` — `MONGO_DBNAME` 한 DB만 연결 |
| └ `/sp` 마운트 (swimmingPhotography API) | `server/swimmingPhotography/` | `SwimmingPhotography` + `Breaststroke` + `MedalbankAquatics` | `db.js` 의 `SP()` / `BR()` / `MA()` |
| medalbank-aquatics-erp (6643) | `server/erp/` | `MedalbankERP` | `server/erp/db.js` — `col(name)` |
| medalbank-aquatics-registry (6631) | `medalbank/` | `Breaststroke` | `medalbank/server/utils/mongo.ts` — `mongoDb` = `MONGO_DBNAME_BR` |
| medalbank-aquatics-sse (6634) | `sse/` | (코드에서 직접 사용 안 함) | `nuxt.config.ts` 에 `Breaststroke` 접속 설정만 있고 `collection()` 호출 없음 |
| medalbank-aquatics-nuxt (6632) | `aquatics/` | 없음 | |
| medalbank-aquatics-breaststroke (6633) | `breaststroke/` | 없음(직접) | 프런트. 데이터는 API 호출로 접근 |
| swimmingPhotography (6641) | `swimmingPhotography/` | 없음(직접) | `/sp` API 프록시 → 위 server |
| swimmingPhotographyDashboard (6642) | `swimmingPhotographyDashboard/` | 없음(직접) | `/sp` API 프록시 → 위 server |

## 3. DB별 컬렉션

### 3.1 `MedalbankAquatics` — server (사진 서비스)

| 컬렉션 | 사용 위치 | 용도 |
|---|---|---|
| `images` | `models/Image.js`, `routes/images.js`, `consent.js` | 사진 메타 |
| `athletes` | `models/Athlete.js`, `routes/images.js`, `consent.js` | 선수 |
| `meets` | `models/Meet.js`, `routes/athletes.js`, `routes/images.js` | 대회 |
| `request` | `routes/requests.js` | 요청 |
| `consent_log` | `routes/consent.js` | 동의 이력 |
| `counters` | `index.js`, `routes/upload.js` | 순번 |

일회성 스크립트: `seed.js`(images/meets/athletes 초기화 후 시드), `migrate-images-to-idrive.mjs`, `migrate-strip-url-prefix.mjs`(images).

### 3.2 `Breaststroke` — medalbank (registry)

`medalbank/server/` 의 `getDb()` 로 접근.

| 컬렉션 | 용도 |
|---|---|
| `mergedTimes` | 통합 기록(검색·시트·유사기록·tid 채번, 인덱스는 `plugins/ensure-indexes.ts`) |
| `errata` | 정정 요청 |
| `records` | 한국/세계 기록 등(`canon`) |
| `users` | 로그인 사용자(네이버 로그인, 백엔드 권한) |
| `competitions` | 대회 |
| `teams` | 팀 |
| `athletes` | 선수 |
| `pools` | 수영장 |
| `stems` | 백엔드 stems 관리 |
| `timesImport` | 기록 가져오기 |
| `userPbs` | 사용자 PB |
| `userContrib` | 사용자 기여 |
| `ledger` | 장부 |
| `logs` | 로그 |
| `imagesAiden` | 백엔드 이미지 |
| `counters` | 순번(tid 등) |

### 3.3 `SwimmingPhotography` — server/swimmingPhotography

`SP()` 로 접근.

| 컬렉션 | 사용 위치 | 용도 |
|---|---|---|
| `articles` | articles, images, athletes, youtube, counts | 기사/속보 |
| `competitions` | competitions, times, images, videos, youtube, athletes | 대회 |
| `times` | times, images, videos, youtube, athletes | 기록 |
| `images` | images, times, athletes | 이미지 메타 |
| `videos` | videos, counts | 영상 |
| `youtube` | youtube, videos, counts | YouTube 수집 |
| `venues` | venues, counts | 경기장 |
| `athletes` | articles, athletes, times | 선수 |
| `myTimes` | athletes | 선수 개인 기록 |
| `users` | auth, images, videos | 사용자 |
| `sessions` | auth | 세션 |

### 3.4 `Breaststroke` — server/swimmingPhotography 에서 접근

`BR()` 로 접근. 대부분 조회용이고 `competitions` 만 조회+연동 용도.

| 컬렉션 | 사용 위치 |
|---|---|
| `mergedTimes` | times, athletes |
| `competitions` | competitions, times |
| `records` | athletes |
| `athletes` | counts |
| `teams` | counts |
| `pools` | venues |

### 3.5 `MedalbankAquatics` — server/swimmingPhotography 에서 접근

`MA()` 로 접근: `images` (counts 집계용).

### 3.6 `MedalbankERP` — server/erp

`server/erp/db.js` 의 `col(name)`. 인덱스는 `ensureIndexes()` 가 시작 시 생성.

| 컬렉션 | 용도 | 인덱스 |
|---|---|---|
| `orders` | 주문(작업지시) | `orderNo` unique, `status+dueAt`, `partnerId+orderedAt`, `designs.designId` |
| `workSchedules` | 작업 일정 | `date+orderNo`, `orderId` |
| `scheduleScenarios` | 생산계획 시나리오 | |
| `designs` | 디자인 | `code` unique, `partnerId+updatedAt` |
| `smartstoreOrders` | 스마트스토어 주문 | `productOrderId` unique, `paidAt` |
| `machines` | 기계 | |
| `materials` | 물품(부모-옵션 구조) | `options.code` unique sparse, `name` |
| `goods` | 상품(부모-옵션 구조) | `options.code` unique sparse, `name` |
| `stockMoves` | 재고 이동 | `kind+code+at`, `orderId` |
| `purchaseOrders` | 발주 | `poNo` unique |
| `stocktakes` | 재고 실사 | `no` unique |
| `partners` | 거래처 | `name` |
| `customers` | 고객 | `name` |
| `activityLogs` | 활동 로그 | `target+targetId+at` |
| `users` | ERP 사용자 | `username` unique |
| `sessions` | 세션 | |
| `settings` | 설정 | |
| `counters` | 순번(주문번호 등, `nextSeq`) | |

## 4. 같은 이름 컬렉션 주의

DB가 다르면 이름이 같아도 별개 데이터다.

| 이름 | 존재하는 DB |
|---|---|
| `athletes` | MedalbankAquatics / Breaststroke / SwimmingPhotography |
| `images` | MedalbankAquatics / SwimmingPhotography |
| `competitions` | Breaststroke / SwimmingPhotography (`meets` 는 MedalbankAquatics) |
| `users` | Breaststroke / SwimmingPhotography / MedalbankERP |
| `counters` | MedalbankAquatics / Breaststroke / MedalbankERP |
| `sessions` | SwimmingPhotography / MedalbankERP |

## 5. 참고 / 확인 필요

- `medalbank/nuxt.config.ts`, `sse/nuxt.config.ts` 의 `runtimeConfig` 에 접속 주소·계정·비밀번호 **기본값이 하드코딩**되어 있다. 저장소에 올라가 있으므로 기본값을 제거하고 `.env` 만 쓰도록 바꾸고, 비밀번호 변경을 검토할 것.
- `.env` 에 `MONGO_DBNAME_ERP` 는 없어 기본값 `MedalbankERP` 가 쓰인다.
- `sse` 는 접속 설정만 있고 실제 쿼리가 없다(스키마 문서 `sse_schema.md` 만 존재).
