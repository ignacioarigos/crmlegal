import { useState } from 'react'
import { uid } from '../lib/supabase.js'
import {
  saveSiniestro, deleteSiniestro,
  uploadDoc, getDocUrl, deleteDoc,
} from '../lib/store.js'

// ── Categorías de documentación (mapean al checklist del formulario) ──
const DOC_CATS = [
  { key: 'DNI',         label: 'DNI' },
  { key: 'CV',          label: 'Cédula Verde' },
  { key: 'REG',         label: 'Registro' },
  { key: 'SEG',         label: 'Seguro' },
  { key: 'DA',          label: 'Denuncia Adm.' },
  { key: 'CERT_COB',    label: 'Cert. Cobertura' },
  { key: 'PRESUPUESTO', label: 'Presupuesto' },
  { key: 'FOTOS',       label: 'Fotos', multi: true },
]

// ── Helpers ──
const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const carpetaFmt = (n) => (n == null ? '—' : String(n).padStart(3, '0'))

// fecha YYYY-MM-DD → DD/MM/YYYY sin new Date() (evita el corrimiento UTC)
const fechaFmt = (s) => {
  if (!s) return '—'
  const [y, m, d] = s.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const blank = () => ({
  id: uid(),
  carpeta_nro: null,
  nro_siniestro: '', compania: '', causa_id: null, estado: 'abierto',
  fecha_hecho: '', hora_hecho: '', lugar: '',
  lesiones: false, comprobantes_medicos: false, aseguradora: '', denuncia_admin: false,
  aseg_telefono: '', aseg_domicilio: '', aseg_contacto: '', aseg_mail: '',
  req_nombre: '', req_dni: '', req_telefono: '',
  rdo_nombre: '', rdo_vehiculo: '', rdo_telefono: '', rdo_domicilio: '',
  rdo_dni: '', rdo_dominio: '', rdo_poliza: '',
  mediacion: false, mediacion_fecha: '',
  lesiones_detalle: '', danos_detalle: '',
  vista_medica: false, vm_fecha: '', vm_dr: '', vm_domicilio: '', vm_telefono: '',
  fecha_pago: '', monto_pago: '',
})

// ── Sub-componentes chicos ──
function SiNo({ value, onChange }) {
  return (
    <div className="sin-sino">
      <button type="button" className={value ? 'on' : ''} onClick={() => onChange(true)}>Sí</button>
      <button type="button" className={!value ? 'on' : ''} onClick={() => onChange(false)}>No</button>
    </div>
  )
}

function Field({ label, children, wide }) {
  return (
    <label className={'sin-field' + (wide ? ' wide' : '')}>
      <span>{label}</span>
      {children}
    </label>
  )
}

// ══════════════════════════════════════════════════════════════
export default function Siniestros({ store }) {
  const siniestros = store.siniestros || []
  const docs = store.siniestro_docs || []

  const [view, setView] = useState('list')       // 'list' | 'ficha'
  const [ficha, setFicha] = useState(null)
  const [saving, setSaving] = useState(false)

  // filtros de lista
  const [estadoFilter, setEstadoFilter] = useState('abierto')  // 'todos' | 'abierto' | 'cerrado'
  const [q, setQ] = useState('')

  const set = (k, v) => setFicha((f) => ({ ...f, [k]: v }))

  const abrirNuevo = () => { setFicha(blank()); setView('ficha') }
  const abrirExistente = (s) => { setFicha({ ...s }); setView('ficha') }
  const volver = () => { setView('list'); setFicha(null) }

  const guardar = async () => {
    setSaving(true)
    try {
      // '' → null (evita errores de tipo en columnas date/time/numeric)
      const clean = Object.fromEntries(
        Object.entries(ficha).map(([k, v]) => [k, v === '' ? null : v])
      )
      if (clean.monto_pago != null) {
        const n = Number(clean.monto_pago)
        clean.monto_pago = Number.isFinite(n) ? n : null
      }
      const saved = await saveSiniestro(clean)
      setFicha((f) => ({ ...f, carpeta_nro: saved.carpeta_nro }))
    } catch (e) {
      alert('Error al guardar: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (s) => {
    if (!confirm(`¿Eliminar el siniestro CARPETA ${carpetaFmt(s.carpeta_nro)}? Se borran también sus documentos.`)) return
    await deleteSiniestro(s.id)
    if (ficha && ficha.id === s.id) volver()
  }

  // ── LISTA ──────────────────────────────────────────────────
  if (view === 'list') {
    const filtradas = siniestros
      .filter((s) => estadoFilter === 'todos' ? true : (s.estado || 'abierto') === estadoFilter)
      .filter((s) => {
        if (!q.trim()) return true
        const hay = norm([
          carpetaFmt(s.carpeta_nro), s.nro_siniestro, s.compania,
          s.req_nombre, s.rdo_nombre, s.aseguradora, s.rdo_dominio,
        ].join(' '))
        return hay.includes(norm(q))
      })
      .sort((a, b) => (b.carpeta_nro || 0) - (a.carpeta_nro || 0))

    const count = (est) => siniestros.filter((s) => est === 'todos' ? true : (s.estado || 'abierto') === est).length

    return (
      <div className="sin-wrap">
        <Style />
        <div className="sin-head">
          <h1>Siniestros</h1>
          <button className="sin-btn primary" onClick={abrirNuevo}>+ Nuevo siniestro</button>
        </div>

        <div className="sin-toolbar">
          <div className="sin-chips">
            {[['abierto', 'Activos'], ['cerrado', 'Cerrados'], ['todos', 'Todos']].map(([k, lbl]) => (
              <button
                key={k}
                className={'sin-chip' + (estadoFilter === k ? ' on' : '')}
                onClick={() => setEstadoFilter(k)}
              >{lbl} <em>{count(k)}</em></button>
            ))}
          </div>
          <input
            className="sin-search"
            placeholder="Buscar por carpeta, cliente, compañía, dominio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {filtradas.length === 0 ? (
          <div className="sin-empty">No hay siniestros para este filtro.</div>
        ) : (
          <div className="sin-grid">
            {filtradas.map((s) => {
              const n = docs.filter((d) => d.siniestro_id === s.id).length
              const cerrado = (s.estado || 'abierto') === 'cerrado'
              return (
                <div key={s.id} className={'sin-card' + (cerrado ? ' cerrado' : '')} onClick={() => abrirExistente(s)}>
                  <div className="sin-card-top">
                    <span className="sin-carpeta">CARPETA {carpetaFmt(s.carpeta_nro)}</span>
                    <span className={'sin-estado ' + (cerrado ? 'c' : 'a')}>{cerrado ? 'CERRADO' : 'ACTIVO'}</span>
                  </div>
                  <div className="sin-card-cliente">{s.req_nombre || 'Sin requirente'}</div>
                  <div className="sin-card-meta">
                    {s.compania && <span>{s.compania}</span>}
                    <span>Hecho: {fechaFmt(s.fecha_hecho)}</span>
                    {s.rdo_dominio && <span>Dominio: {s.rdo_dominio}</span>}
                  </div>
                  <div className="sin-card-foot">
                    <span className="sin-docs-badge">{n} doc{n === 1 ? '' : 's'}</span>
                    <button className="sin-del" onClick={(e) => { e.stopPropagation(); eliminar(s) }}>Eliminar</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── FICHA ──────────────────────────────────────────────────
  const guardado = !!siniestros.find((s) => s.id === ficha.id)
  const cerrado = (ficha.estado || 'abierto') === 'cerrado'

  return (
    <div className="sin-wrap">
      <Style />
      <div className="sin-ficha-head">
        <button className="sin-btn ghost" onClick={volver}>← Volver</button>
        <div className="sin-ficha-title">
          <span className="sin-carpeta big">CARPETA {carpetaFmt(ficha.carpeta_nro)}</span>
          {ficha.req_nombre && <span className="sub">{ficha.req_nombre}</span>}
        </div>
        <button className="sin-btn primary" onClick={guardar} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* Cabecera */}
      <Section title="Identificación">
        <Field label="Nº de siniestro"><input value={ficha.nro_siniestro || ''} onChange={(e) => set('nro_siniestro', e.target.value)} /></Field>
        <Field label="Compañía"><input value={ficha.compania || ''} onChange={(e) => set('compania', e.target.value)} /></Field>
        <Field label="Causa vinculada">
          <select value={ficha.causa_id || ''} onChange={(e) => set('causa_id', e.target.value || null)}>
            <option value="">— Sin vincular —</option>
            {(store.causas || []).map((c) => (
              <option key={c.id} value={c.id}>{c.caratula || c.cliente || c.id}</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Requirente */}
      <Section title="Requirente (cliente)">
        <Field label="Nombre" wide><input value={ficha.req_nombre || ''} onChange={(e) => set('req_nombre', e.target.value)} /></Field>
        <Field label="DNI"><input value={ficha.req_dni || ''} onChange={(e) => set('req_dni', e.target.value)} /></Field>
        <Field label="Teléfono"><input value={ficha.req_telefono || ''} onChange={(e) => set('req_telefono', e.target.value)} /></Field>
      </Section>

      {/* Hecho */}
      <Section title="Detalle del hecho">
        <Field label="Fecha"><input type="date" value={ficha.fecha_hecho || ''} onChange={(e) => set('fecha_hecho', e.target.value)} /></Field>
        <Field label="Hora"><input type="time" value={ficha.hora_hecho || ''} onChange={(e) => set('hora_hecho', e.target.value)} /></Field>
        <Field label="Lugar" wide><input value={ficha.lugar || ''} onChange={(e) => set('lugar', e.target.value)} /></Field>
        <Field label="¿Lesiones?"><SiNo value={ficha.lesiones} onChange={(v) => set('lesiones', v)} /></Field>
        <Field label="¿Comprobantes médicos?"><SiNo value={ficha.comprobantes_medicos} onChange={(v) => set('comprobantes_medicos', v)} /></Field>
        <Field label="¿Denuncia administrativa?"><SiNo value={ficha.denuncia_admin} onChange={(v) => set('denuncia_admin', v)} /></Field>
        <Field label="Aseguradora" wide><input value={ficha.aseguradora || ''} onChange={(e) => set('aseguradora', e.target.value)} /></Field>
        <Field label="Tel. aseguradora"><input value={ficha.aseg_telefono || ''} onChange={(e) => set('aseg_telefono', e.target.value)} /></Field>
        <Field label="Contacto aseguradora"><input value={ficha.aseg_contacto || ''} onChange={(e) => set('aseg_contacto', e.target.value)} /></Field>
        <Field label="Domicilio aseguradora" wide><input value={ficha.aseg_domicilio || ''} onChange={(e) => set('aseg_domicilio', e.target.value)} /></Field>
        <Field label="Mail aseguradora"><input value={ficha.aseg_mail || ''} onChange={(e) => set('aseg_mail', e.target.value)} /></Field>
      </Section>

      {/* Requerido */}
      <Section title="Requerido (contraparte)">
        <Field label="Nombre" wide><input value={ficha.rdo_nombre || ''} onChange={(e) => set('rdo_nombre', e.target.value)} /></Field>
        <Field label="Vehículo"><input value={ficha.rdo_vehiculo || ''} onChange={(e) => set('rdo_vehiculo', e.target.value)} /></Field>
        <Field label="Dominio"><input value={ficha.rdo_dominio || ''} onChange={(e) => set('rdo_dominio', e.target.value)} /></Field>
        <Field label="DNI"><input value={ficha.rdo_dni || ''} onChange={(e) => set('rdo_dni', e.target.value)} /></Field>
        <Field label="Póliza"><input value={ficha.rdo_poliza || ''} onChange={(e) => set('rdo_poliza', e.target.value)} /></Field>
        <Field label="Teléfono"><input value={ficha.rdo_telefono || ''} onChange={(e) => set('rdo_telefono', e.target.value)} /></Field>
        <Field label="Domicilio" wide><input value={ficha.rdo_domicilio || ''} onChange={(e) => set('rdo_domicilio', e.target.value)} /></Field>
      </Section>

      {/* Mediación */}
      <Section title="Mediación">
        <Field label="¿Mediación?"><SiNo value={ficha.mediacion} onChange={(v) => set('mediacion', v)} /></Field>
        <Field label="Fecha"><input type="date" value={ficha.mediacion_fecha || ''} onChange={(e) => set('mediacion_fecha', e.target.value)} /></Field>
      </Section>

      {/* Descripciones */}
      <Section title="Descripciones">
        <Field label="Lesiones" wide><textarea rows={3} value={ficha.lesiones_detalle || ''} onChange={(e) => set('lesiones_detalle', e.target.value)} /></Field>
        <Field label="Daños" wide><textarea rows={3} value={ficha.danos_detalle || ''} onChange={(e) => set('danos_detalle', e.target.value)} /></Field>
      </Section>

      {/* Vista médica */}
      <Section title="Vista médica">
        <Field label="¿Vista médica?"><SiNo value={ficha.vista_medica} onChange={(v) => set('vista_medica', v)} /></Field>
        <Field label="Fecha"><input type="date" value={ficha.vm_fecha || ''} onChange={(e) => set('vm_fecha', e.target.value)} /></Field>
        <Field label="Dr."><input value={ficha.vm_dr || ''} onChange={(e) => set('vm_dr', e.target.value)} /></Field>
        <Field label="Teléfono"><input value={ficha.vm_telefono || ''} onChange={(e) => set('vm_telefono', e.target.value)} /></Field>
        <Field label="Domicilio" wide><input value={ficha.vm_domicilio || ''} onChange={(e) => set('vm_domicilio', e.target.value)} /></Field>
      </Section>

      {/* Cierre */}
      <Section title="Cierre">
        <Field label="¿Cerrado?"><SiNo value={cerrado} onChange={(v) => set('estado', v ? 'cerrado' : 'abierto')} /></Field>
        {cerrado && <>
          <Field label="Fecha de pago"><input type="date" value={ficha.fecha_pago || ''} onChange={(e) => set('fecha_pago', e.target.value)} /></Field>
          <Field label="Monto"><input type="number" step="0.01" value={ficha.monto_pago ?? ''} onChange={(e) => set('monto_pago', e.target.value)} /></Field>
        </>}
      </Section>

      {/* Documentación */}
      <div className="sin-section">
        <h3>Documentación</h3>
        {!guardado ? (
          <div className="sin-doc-note">Guardá el siniestro para habilitar la carga de documentación.</div>
        ) : (
          <div className="sin-docs">
            {DOC_CATS.map((cat) => (
              <DocSlot key={cat.key} cat={cat} siniestroId={ficha.id} docs={docs} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Slot de documentación ──
function DocSlot({ cat, siniestroId, docs }) {
  const [busy, setBusy] = useState(false)
  const mine = docs.filter((d) => d.siniestro_id === siniestroId && d.categoria === cat.key)
  const filled = mine.length > 0

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try { await uploadDoc(file, siniestroId, cat.key) }
    catch (err) { alert('Error al subir: ' + (err.message || err)) }
    finally { setBusy(false) }
  }

  const ver = async (d) => {
    try { window.open(await getDocUrl(d.storage_path), '_blank') }
    catch (err) { alert('No se pudo abrir: ' + (err.message || err)) }
  }

  const quitar = async (d) => {
    if (!confirm(`¿Quitar "${d.nombre_archivo}"?`)) return
    try { await deleteDoc(d.id, d.storage_path) }
    catch (err) { alert('Error al quitar: ' + (err.message || err)) }
  }

  const canUpload = cat.multi || !filled

  return (
    <div className={'sin-slot' + (filled ? ' filled' : '')}>
      <div className="sin-slot-head">
        <span className="dot" />
        <span className="lbl">{cat.label}</span>
      </div>
      {mine.map((d) => (
        <div key={d.id} className="sin-slot-file">
          <button className="link" onClick={() => ver(d)} title={d.nombre_archivo}>{d.nombre_archivo}</button>
          <button className="x" onClick={() => quitar(d)}>✕</button>
        </div>
      ))}
      {canUpload && (
        <label className="sin-slot-up">
          {busy ? 'Subiendo…' : (filled && cat.multi ? '+ Agregar' : 'Subir archivo')}
          <input type="file" hidden onChange={onFile} disabled={busy} />
        </label>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="sin-section">
      <h3>{title}</h3>
      <div className="sin-grid-fields">{children}</div>
    </div>
  )
}

// ── Estilos (scoped, estética dark-gold) ──
function Style() {
  return (
    <style>{`
    .sin-wrap { padding: 1.25rem 1.5rem 4rem; font-family: 'IBM Plex Mono', monospace; color: var(--text, #e8e4da); }
    .sin-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; }
    .sin-head h1, .sin-section h3 { font-family:'Fraunces', serif; }
    .sin-head h1 { font-size:1.6rem; margin:0; color: var(--gold, #c9a24b); }

    .sin-btn { border:1px solid var(--border,#3a3730); background:transparent; color:var(--text,#e8e4da);
      padding:.5rem .9rem; border-radius:8px; cursor:pointer; font-family:inherit; font-size:.82rem; }
    .sin-btn.primary { background:var(--gold,#c9a24b); color:#1a1712; border-color:var(--gold,#c9a24b); font-weight:600; }
    .sin-btn.ghost:hover, .sin-btn:hover { border-color:var(--gold,#c9a24b); }
    .sin-btn:disabled { opacity:.5; cursor:default; }

    .sin-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap; }
    .sin-chips { display:flex; gap:.5rem; }
    .sin-chip { border:1px solid var(--border,#3a3730); background:transparent; color:var(--muted,#9a948a);
      padding:.35rem .75rem; border-radius:20px; cursor:pointer; font-family:inherit; font-size:.78rem; }
    .sin-chip.on { border-color:var(--gold,#c9a24b); color:var(--gold,#c9a24b); }
    .sin-chip em { font-style:normal; opacity:.6; margin-left:.25rem; }
    .sin-search { flex:1; min-width:220px; background:var(--panel,#211e18); border:1px solid var(--border,#3a3730);
      color:var(--text,#e8e4da); padding:.5rem .75rem; border-radius:8px; font-family:inherit; font-size:.82rem; }

    .sin-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; }
    .sin-card { background:var(--panel,#211e18); border:1px solid var(--border,#3a3730); border-left:3px solid var(--gold,#c9a24b);
      border-radius:10px; padding:1rem; cursor:pointer; transition:border-color .15s; }
    .sin-card:hover { border-color:var(--gold,#c9a24b); }
    .sin-card.cerrado { opacity:.6; border-left-color:var(--muted,#9a948a); }
    .sin-card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem; }
    .sin-carpeta { font-size:.8rem; letter-spacing:.05em; color:var(--gold,#c9a24b); font-weight:600; }
    .sin-carpeta.big { font-size:1.05rem; }
    .sin-estado { font-size:.62rem; padding:.15rem .4rem; border-radius:4px; letter-spacing:.08em; }
    .sin-estado.a { background:rgba(201,162,75,.15); color:var(--gold,#c9a24b); }
    .sin-estado.c { background:rgba(154,148,138,.15); color:var(--muted,#9a948a); }
    .sin-card-cliente { font-size:.95rem; margin-bottom:.4rem; }
    .sin-card-meta { display:flex; flex-direction:column; gap:.15rem; font-size:.72rem; color:var(--muted,#9a948a); }
    .sin-card-foot { display:flex; justify-content:space-between; align-items:center; margin-top:.75rem; }
    .sin-docs-badge { font-size:.68rem; color:var(--muted,#9a948a); }
    .sin-del { background:none; border:none; color:var(--urgent,#c0553f); font-size:.68rem; cursor:pointer; font-family:inherit; }
    .sin-del:hover { text-decoration:underline; }
    .sin-empty { color:var(--muted,#9a948a); padding:2rem 0; text-align:center; }

    /* Ficha */
    .sin-ficha-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.5rem;
      position:sticky; top:0; background:var(--bg,#1a1712); padding:.5rem 0; z-index:5; }
    .sin-ficha-title { text-align:center; display:flex; flex-direction:column; }
    .sin-ficha-title .sub { font-size:.75rem; color:var(--muted,#9a948a); }
    .sin-section { margin-bottom:1.5rem; border:1px solid var(--border,#3a3730); border-radius:10px; padding:1rem 1.1rem; background:var(--panel,#211e18); }
    .sin-section h3 { margin:0 0 .9rem; font-size:1rem; color:var(--gold,#c9a24b); }
    .sin-grid-fields { display:grid; grid-template-columns:repeat(2,1fr); gap:.75rem 1rem; }
    .sin-field { display:flex; flex-direction:column; gap:.3rem; font-size:.72rem; color:var(--muted,#9a948a); }
    .sin-field.wide { grid-column:1 / -1; }
    .sin-field input, .sin-field select, .sin-field textarea {
      background:var(--bg,#1a1712); border:1px solid var(--border,#3a3730); color:var(--text,#e8e4da);
      padding:.45rem .6rem; border-radius:6px; font-family:inherit; font-size:.85rem; }
    .sin-field textarea { resize:vertical; }

    .sin-sino { display:inline-flex; border:1px solid var(--border,#3a3730); border-radius:6px; overflow:hidden; width:fit-content; }
    .sin-sino button { background:transparent; border:none; color:var(--muted,#9a948a); padding:.4rem .9rem; cursor:pointer; font-family:inherit; font-size:.8rem; }
    .sin-sino button.on { background:var(--gold,#c9a24b); color:#1a1712; font-weight:600; }

    /* Documentación */
    .sin-doc-note { color:var(--muted,#9a948a); font-size:.8rem; }
    .sin-docs { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:.75rem; }
    .sin-slot { border:1px dashed var(--border,#3a3730); border-radius:8px; padding:.6rem .7rem; }
    .sin-slot.filled { border-style:solid; border-color:rgba(120,180,120,.5); }
    .sin-slot-head { display:flex; align-items:center; gap:.4rem; margin-bottom:.4rem; }
    .sin-slot-head .dot { width:8px; height:8px; border-radius:50%; background:var(--border,#3a3730); }
    .sin-slot.filled .sin-slot-head .dot { background:#6db36d; }
    .sin-slot-head .lbl { font-size:.78rem; color:var(--text,#e8e4da); }
    .sin-slot-file { display:flex; align-items:center; justify-content:space-between; gap:.4rem; margin-bottom:.3rem; }
    .sin-slot-file .link { background:none; border:none; color:var(--gold,#c9a24b); font-size:.7rem; cursor:pointer;
      font-family:inherit; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px; }
    .sin-slot-file .link:hover { text-decoration:underline; }
    .sin-slot-file .x { background:none; border:none; color:var(--urgent,#c0553f); cursor:pointer; font-size:.7rem; }
    .sin-slot-up { display:inline-block; font-size:.72rem; color:var(--muted,#9a948a); cursor:pointer; padding:.2rem 0; }
    .sin-slot-up:hover { color:var(--gold,#c9a24b); }

    @media (max-width:640px) { .sin-grid-fields { grid-template-columns:1fr; } }
    `}</style>
  )
}
