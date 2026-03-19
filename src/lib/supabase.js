// ── Supabase config ──────────────────────────────────────────
const SB_URL = 'https://vfhrpydvlknskmizsfsg.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmaHJweWR2bGtuc2ttaXpzZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NjU3NzcsImV4cCI6MjA4ODM0MTc3N30.GDeW4taxDPjy3my09j2iBPIDL6YWBvYEkYWpZKo46-w'

async function sbFetch(path, opts = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.extraHeaders || {}),
    },
    method: opts.method || 'GET',
    body: opts.body || undefined,
  })
  if (!r.ok) { const e = await r.text(); throw new Error(e) }
  const txt = await r.text()
  return txt ? JSON.parse(txt) : []
}

export const DB = {
  get: (table) => sbFetch(table + '?order=fecha.asc'),
  insert: (table, obj) => sbFetch(table, { method: 'POST', body: JSON.stringify(obj) }),
  update: (table, id, obj) => sbFetch(table + '?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(obj) }),
  delete: (table, id) => sbFetch(table + '?id=eq.' + id, { method: 'DELETE' }),
  deleteWhere: (table, field, val) => sbFetch(table + '?' + field + '=eq.' + encodeURIComponent(val), { method: 'DELETE' }),
}

// ── Utilidades ───────────────────────────────────────────────
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const dateFmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const fmtF = (s) => {
  if (!s) return ''
  try {
    const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
    if (isNaN(d)) return s
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  } catch { return s }
}

export const FUEROS_CIVILES = ['Civil', 'Civil y Comercial', 'Comercial']
export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
export const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const fechaLarga = (d) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

// ── Feriados ─────────────────────────────────────────────────
const feriadosCache = {}
const FB = {
  2025: ['2025-01-01','2025-03-03','2025-03-04','2025-03-24','2025-04-02','2025-04-17','2025-04-18','2025-05-01','2025-05-25','2025-06-16','2025-06-20','2025-07-09','2025-08-17','2025-10-12','2025-11-20','2025-11-21','2025-12-08','2025-12-25'],
  2026: ['2026-01-01','2026-02-16','2026-02-17','2026-03-24','2026-03-23','2026-04-02','2026-04-03','2026-05-01','2026-05-25','2026-06-15','2026-06-20','2026-07-09','2026-08-17','2026-10-12','2026-11-20','2026-12-08','2026-12-25'],
}
export async function fetchFeriados(y) {
  if (feriadosCache[y]) return feriadosCache[y]
  try {
    const r = await fetch(`https://api.argentinadatos.com/v1/feriados/${y}`)
    if (!r.ok) throw 0
    const d = await r.json()
    feriadosCache[y] = new Set(d.map(f => f.fecha))
    return feriadosCache[y]
  } catch {
    feriadosCache[y] = new Set(FB[y] || [])
    return feriadosCache[y]
  }
}
export async function esHabil(d) {
  if (d.getDay() === 0 || d.getDay() === 6) return false
  const f = await fetchFeriados(d.getFullYear())
  return !f.has(dateFmt(d))
}
export async function sumarHabiles(desde, dias) {
  let d = new Date(desde.getTime()); d.setDate(d.getDate() + 1); let c = 0
  while (c < dias) { if (await esHabil(d)) c++; if (c < dias) d.setDate(d.getDate() + 1) }
  return d
}
export async function sumarCorridos(desde, dias) {
  let d = new Date(desde.getTime()); d.setDate(d.getDate() + dias)
  while (!(await esHabil(d))) d.setDate(d.getDate() + 1)
  return d
}

// ── Trámites default ─────────────────────────────────────────
export const TRAMITES_DEFAULT = [
  { id: 't1',  n: 'SOLICITUD DE PARTIDA - CABA URGENTE', p: 11950 },
  { id: 't2',  n: 'BÚSQUEDA DE PARTIDA - CABA',          p: 8110  },
  { id: 't3',  n: 'SOLICITUD DE PARTIDA - PBA',           p: 1755  },
  { id: 't4',  n: 'BONO CPACF',                           p: 20200 },
  { id: 't5',  n: 'BONO COLPROBA',                        p: 19150 },
  { id: 't6',  n: 'JUS PREVISIONAL',                      p: 20000 },
  { id: 't7',  n: 'FORMULARIO 3003/56',                   p: 3000  },
  { id: 't8',  n: 'OFICIO C.P.A.C.F.',                    p: 28000 },
  { id: 't9',  n: 'OFICIO COL. ESCRIBANOS (CABA)',         p: 35100 },
  { id: 't10', n: 'OFICIO COLESCBA',                       p: 26500 },
  { id: 't11', n: 'EDICTOS BORA',                          p: 598   },
  { id: 't12', n: 'EDICTOS BOPBA',                         p: 1365  },
  { id: 't13', n: 'INFORME ANOTACIONES PERSONALES',        p: 22000 },
]
