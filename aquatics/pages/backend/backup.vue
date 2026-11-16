<script setup lang="ts">
// DB 백업·복원 — MedalbankAquatics DB. 이 백엔드에는 로그인이 없어, 서버의 AQUATICS_BACKUP_KEY 와 같은 키를 입력해야 동작한다.
definePageMeta({ layout: 'backend' })

const BASE = '/api/admin/backup'
const KEYNAME = 'aqBackupKey'
const LASTNAME = 'aqLastBackupKst'
const nowKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ')

type Msg = { text: string; bad?: boolean }
const key = ref('')
const full = reactive({ busy: false, msg: { text: '' } as Msg })
const inc = reactive({ busy: false, msg: { text: '' } as Msg, since: '' })
const cloud = reactive({ busy: false, msg: { text: '' } as Msg, mode: 'incremental' })
const rest = reactive({ busy: false, msg: { text: '' } as Msg, col: '', names: [] as string[], docs: null as any[] | null, file: null as File | null, error: '' })

const headers = () => ({ 'x-backup-key': key.value.trim() })
const errText = async (e: any) => {
  let d = e?.data
  try { if (d instanceof Blob) d = JSON.parse(await d.text()) } catch { /* 그대로 */ }
  return (typeof d?.error === 'string' && d.error) || (typeof d?.message === 'string' && d.message) || '요청을 처리하지 못했습니다.'
}

async function loadCollections() {
  rest.names = []
  try { rest.names = (await $fetch<{ items: string[] }>(`${BASE}/collections`, { headers: headers() })).items }
  catch (e) { rest.msg = { text: await errText(e), bad: true } }
}
function saveKey() {
  try { sessionStorage.setItem(KEYNAME, key.value) } catch { /* 저장소 사용 불가 */ }
  rest.msg = { text: '' }
  loadCollections()
}
onMounted(() => {
  try { key.value = sessionStorage.getItem(KEYNAME) || ''; inc.since = localStorage.getItem(LASTNAME) || '' } catch { /* 무시 */ }
  if (key.value) loadCollections()
})

// zip 내려받기 — 키 헤더가 필요해 링크 대신 fetch 로 받아 저장한다
async function download(path: string, body: any, st: { busy: boolean; msg: Msg }) {
  st.busy = true; st.msg = { text: '만드는 중…' }
  try {
    const r: any = await $fetch.raw(`${BASE}${path}`, { method: 'POST', body, headers: headers(), responseType: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(r._data as Blob)
    a.download = r.headers.get('x-backup-filename') || 'MedalbankAquatics-backup.zip'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    st.msg = { text: '다운로드했습니다.' }
    try { localStorage.setItem(LASTNAME, nowKst()) } catch { /* 무시 */ }
  } catch (e) { st.msg = { text: await errText(e), bad: true } }
  finally { st.busy = false }
}
const downloadFull = () => download('/full', {}, full)
const downloadInc = () => download('/incremental', { since: inc.since.trim() }, inc)

async function runCloud() {
  cloud.busy = true; cloud.msg = { text: '백업해서 올리는 중…' }
  try {
    const j: any = await $fetch(`${BASE}/cloud`, { method: 'POST', body: { mode: cloud.mode }, headers: headers() })
    cloud.msg = { text: j.skipped ? `변경된 문서가 없어 올리지 않았습니다. (기준 ${j.since})` : `업로드 완료 — ${j.key} · ${j.total}건 · ${(j.bytes / 1024).toFixed(1)}KB (${j.mode === 'full' ? '전체' : '증분'})` }
  } catch (e) { cloud.msg = { text: await errText(e), bad: true } }
  finally { cloud.busy = false }
}

// ── 복원: 파일을 읽어 표로 보여 준 뒤 확인하면 올린다 ──
const bk = (v: any): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if ('$oid' in v) return v.$oid
    if ('$date' in v) { const d = new Date(typeof v.$date === 'object' ? Number(v.$date.$numberLong) : v.$date); return isNaN(+d) ? String(v.$date) : new Date(+d + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ') }
    if ('$numberLong' in v) return v.$numberLong
    if ('$numberDecimal' in v) return v.$numberDecimal
    return JSON.stringify(v)
  }
  return String(v)
}
const cols = computed(() => [...new Set((rest.docs || []).flatMap((d) => Object.keys(d)))])
const shown = computed(() => (rest.docs || []).slice(0, 50))
const canRestore = computed(() => !!(rest.docs?.length && rest.col) && !rest.busy)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] || null
  rest.file = f; rest.docs = null; rest.error = ''; rest.msg = { text: '' }
  if (!f) return
  const base = f.name.replace(/\.json$/i, '')
  if (rest.names.includes(base) && !rest.col) rest.col = base
  try {
    const j = JSON.parse(await f.text())
    if (!Array.isArray(j)) throw new Error('백업 파일은 문서 배열이어야 합니다. (manifest.json 이 아닌 컬렉션 JSON 을 고르세요)')
    if (j.some((d) => !d || typeof d !== 'object' || !('_id' in d))) throw new Error('_id 가 없는 문서가 있습니다.')
    rest.docs = j
  } catch (x: any) { rest.error = x.message }
}
async function doRestore() {
  if (!rest.file || !rest.docs) return
  if (!confirm(`'${rest.col}' 컬렉션에 ${rest.docs.length}건을 복원합니다.\n같은 _id 의 문서는 파일 내용으로 덮어씁니다. 계속할까요?`)) return
  rest.busy = true; rest.msg = { text: '복원 중…' }
  try {
    const fd = new FormData(); fd.append('collection', rest.col); fd.append('file', rest.file)
    const j: any = await $fetch(`${BASE}/restore`, { method: 'POST', body: fd, headers: headers() })
    rest.msg = { text: `복원 완료 — 전체 ${j.total}건 (추가 ${j.inserted}, 수정 ${j.updated})` }
  } catch (e) { rest.msg = { text: await errText(e), bad: true } }
  finally { rest.busy = false }
}
</script>

<template>
  <div class="bkp">
    <header class="bkp-head"><h1>DB 백업</h1>
      <p>MedalbankAquatics DB를 백업·복원합니다. 이 화면에는 로그인이 없어 서버의 백업 키가 필요합니다.</p></header>

    <section class="card">
      <h2>백업 키</h2>
      <p class="desc">서버 .env 의 <b>AQUATICS_BACKUP_KEY</b> 값입니다. 이 브라우저 탭에만 저장됩니다.</p>
      <div class="row"><input v-model="key" type="password" placeholder="백업 키" autocomplete="off" @keyup.enter="saveKey"><button class="btn" type="button" @click="saveKey">적용</button></div>
    </section>

    <section class="card">
      <h2>전체 백업</h2><p class="desc">모든 컬렉션을 JSON 으로 덤프해 zip 으로 내려받습니다.</p>
      <div class="foot"><span class="msg" :class="{ bad: full.msg.bad }">{{ full.msg.text }}</span>
        <button class="btn primary" type="button" :disabled="full.busy" @click="downloadFull">전체 백업 다운로드</button></div>
    </section>

    <section class="card">
      <h2>증분 백업</h2><p class="desc">입력한 시각(한국시간) 이후 수정된 문서만 zip 으로 내려받습니다. 삭제된 문서는 포함되지 않습니다.</p>
      <label class="field"><span>기준 시각 (yyyy-mm-dd hh:mm:ss)</span><input v-model="inc.since" placeholder="2026-11-14 00:00:00" autocomplete="off"></label>
      <div class="foot"><span class="msg" :class="{ bad: inc.msg.bad }">{{ inc.msg.text }}</span>
        <button class="btn primary" type="button" :disabled="inc.busy" @click="downloadInc">증분 백업 다운로드</button></div>
    </section>

    <section class="card">
      <h2>클라우드 즉시 백업</h2>
      <p class="desc">지금 바로 백업을 만들어 클라우드 저장소(iDrive e2, <b>MedalbankAquatics/</b> 폴더)에 올립니다. 예약 백업과 같은 기준 시각을 씁니다.</p>
      <label class="field"><span>방식</span><select v-model="cloud.mode"><option value="incremental">증분 (마지막 백업 이후)</option><option value="full">전체 덤프</option></select></label>
      <div class="foot"><span class="msg" :class="{ bad: cloud.msg.bad }">{{ cloud.msg.text }}</span>
        <button class="btn primary" type="button" :disabled="cloud.busy" @click="runCloud">지금 클라우드에 백업</button></div>
    </section>

    <section class="card">
      <h2>복원</h2>
      <p class="desc">컬렉션을 고르고 백업 zip 안의 <b>컬렉션 JSON 파일</b>을 선택하면 내용을 표로 확인한 뒤 복원합니다. 같은 _id 는 덮어쓰고 없는 문서는 추가하며, 파일에 없는 문서는 건드리지 않습니다.</p>
      <label class="field"><span>컬렉션</span><select v-model="rest.col"><option value="">컬렉션 선택</option><option v-for="n in rest.names" :key="n" :value="n">{{ n }}</option></select></label>
      <label class="field"><span>백업 JSON 파일</span><input type="file" accept=".json,application/json" @change="onFile"></label>
      <div v-if="rest.error" class="desc bad">{{ rest.error }}</div>
      <template v-if="rest.docs">
        <div class="desc">{{ rest.docs.length }}건{{ rest.docs.length > shown.length ? ` 중 앞 ${shown.length}건만 표시` : '' }} · 필드 {{ cols.length }}개</div>
        <div class="scroll"><table>
          <thead><tr><th v-for="c in cols" :key="c">{{ c }}</th></tr></thead>
          <tbody><tr v-for="(d, i) in shown" :key="i"><td v-for="c in cols" :key="c" :title="bk(d[c])">{{ bk(d[c]).length > 60 ? bk(d[c]).slice(0, 60) + '…' : bk(d[c]) }}</td></tr></tbody>
        </table></div>
      </template>
      <div class="foot"><span class="msg" :class="{ bad: rest.msg.bad }">{{ rest.msg.text }}</span>
        <button class="btn primary" type="button" :disabled="!canRestore" @click="doRestore">복원</button></div>
    </section>
  </div>
</template>

<style scoped>
.bkp { padding: 28px 32px 60px; max-width: 920px; }
.bkp-head h1 { font-size: 20px; font-weight: 700; }
.bkp-head p { font-size: 13px; color: #8b949e; margin: 6px 0 20px; }
.card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
.card h2 { font-size: 15px; font-weight: 700; }
.desc { font-size: 12.5px; color: #8b949e; line-height: 1.5; }
.desc.bad, .msg.bad { color: #f85149; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: #8b949e; }
input, select { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 10px; color: #e6edf3; font: inherit; }
.row { display: flex; gap: 8px; } .row input { flex: 1; }
.foot { display: flex; align-items: center; gap: 12px; }
.msg { margin-right: auto; font-size: 12.5px; color: #8b949e; word-break: break-all; }
.btn { background: #21262d; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; padding: 8px 14px; cursor: pointer; font: inherit; }
.btn.primary { background: #1f6feb; border-color: #1f6feb; color: #fff; }
.btn:disabled { opacity: .5; cursor: default; }
.scroll { max-height: 340px; overflow: auto; border: 1px solid #21262d; border-radius: 6px; }
table { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
th, td { padding: 6px 10px; border-bottom: 1px solid #21262d; text-align: left; }
th { position: sticky; top: 0; background: #0d1117; font-weight: 600; }
</style>
