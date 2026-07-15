import { useState } from 'react'
import { uid, dateFmt } from '../lib/supabase.js'
import {
  saveSiniestro, deleteSiniestro,
  uploadDoc, getDocUrl, deleteDoc,
  findAseguradora, syncAseguradora,
  saveNovedad, deleteNovedad,
  saveOferta, deleteOferta, aceptarOferta,
  saveTarea, saveCobro,
} from '../lib/store.js'
import { imprimirCaratula, imprimirFormulario } from '../lib/caratula.js'
import Modal from '../components/Modal.jsx'

// ── Documentación inicial (checklist del formulario) ──
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

// ── Documentación de cierre ──
const DOC_CIERRE = [
  { key: 'CONVENIO',    label: 'Convenio / Acuerdo' },
  { key: 'FACTURA',     label: 'Factura' },
  { key: 'CBU_ESTUDIO', label: 'CBU estudio' },
  { key: 'CBU_CLIENTE', label: 'CBU cliente' },
  { key: 'CONST_CUIT',  label: 'Constancia CUIT' },
  { key: 'CONST_IIGG',  label: 'Constancia IIGG' },
  { key: 'FORM_EXTRA',  label: 'Formulario extra', multi: true },
]

// Solo si hubo mediación
const DOC_MEDIACION = [
  { key: 'MED_FACTURA', label: 'Factura mediadora' },
  { key: 'MED_CUIT',    label: 'CUIT mediadora' },
  { key: 'MED_CBU',     label: 'CBU mediadora' },
]

// ── Helpers ──
const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const carpetaFmt = (n) => (n == null ? '—' : String(n).padStart(3, '0'))

const fechaFmt = (s) => {
  if (!s) return '—'
  const [y, m, d] = s.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const montoFmt = (v) => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? '$ ' + n.toLocaleString('es-AR') : '—'
}

const blank = () => ({
  id: uid(),
  carpeta_nro: null,
  nro_siniestro: '', estado: 'abierto',
  fecha_hecho: '', hora_hecho: '', lugar: '',
  lesiones: false, comprobantes_medicos: false, lesiones_detalle: '',
  aseguradora: '', aseg_cuit: '', denuncia_admin: false,
  aseg_telefono: '', aseg_domicilio: '', aseg_contacto: '', aseg_mail: '',
  derivado: false,
  derivado_estudio: '', derivado_responsable: '', derivado_telefono: '', derivado_mail: '',
  req_nombre: '', req_dni: '', req_telefono: '',
  req_calidad: '',
  rdo_nombre: '', rdo_vehiculo: '', rdo_telefono: '', rdo_domicilio: '',
  rdo_dni: '', rdo_dominio: '', rdo_poliza: '',
  danos_detalle: '',
  mediacion: false, mediacion_fecha: '', mediacion_id: null, mediacion_nombre: '',
  vista_medica: false, vm_fecha: '', vm_medico_id: null, vm_dr: '', vm_domicilio: '', vm_telefono: '', vm_mail: '',
  monto_presupuesto: '',
  hon_pct: 20, cobro_id: null,
  fecha_pago: '', monto_pago: '',
})

// ── Campos ──
function Txt({ label, value, onChange, editing, type = 'text', wide, placeholder }) {
  const shown = type === 'date' ? fechaFmt(value) : (value || '—')
  return (
    <label className={'sin-field' + (wide ? ' wide' : '')}>
      <span>{label}</span>
      {editing
        ? <input type={type} value={value ?? ''} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} />
        : <div className="sin-ro">{shown}</div>}
    </label>
  )
}

function Area({ label, value, onChange, editing }) {
  return (
    <label className="sin-field wide">
      <span>{label}</span>
      {editing
        ? <textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        : <div className="sin-ro multi">{value || '—'}</div>}
    </label>
  )
}

function Bool({ label, value, onChange, editing }) {
  return (
    <label className="sin-field">
      <span>{label}</span>
      {editing
        ? <div className="sin-sino">
            <button type="button" className={value ? 'on' : ''} onClick={() => onChange(true)}>Sí</button>
            <button type="button" className={!value ? 'on' : ''} onClick={() => onChange(false)}>No</button>
          </div>
        : <div className="sin-ro">{value ? 'Sí' : 'No'}</div>}
    </label>
  )
}

function Eco({ label, value, nota }) {
  return (
    <label className="sin-field">
      <span>{label}{nota && <em className="sin-eco-nota"> · {nota}</em>}</span>
      <div className="sin-ro eco">{value || '—'}</div>
    </label>
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

// ══════════════════════════════════════════════════════════════
export default function Siniestros({ store }) {
  const siniestros = store.siniestros || []
  const docs = store.siniestro_docs || []
  const aseguradoras = store.aseguradoras || []
  const novedades = store.siniestro_novedades || []
  const ofertas = store.siniestro_ofertas || []

  // TODO: pasar a tablas propias (crm_mediadoras / crm_medicos)
  const mediadoras = store.mediadoras || [{ id: 1, nombre: 'Dra. María Laura Rossi' }]
  const medicos = store.medicos || [
    { id: 1, nombre: 'Dr. Juan Pérez', direccion: 'Av. Corrientes 1234', mail: 'juan.perez@mail.com', telefono: '11-4567-8901' }
  ]

  const [view, setView] = useState('list')
  const [tab, setTab] = useState('ficha')
  const [ficha, setFicha] = useState(null)
  const [editing, setEditing] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [saving, setSaving] = useState(false)

  const [estadoFilter, setEstadoFilter] = useState('abierto')
  const [q, setQ] = useState('')

  const set = (k, v) => setFicha((f) => ({ ...f, [k]: v }))

  const setAseguradora = (v) => {
    setFicha((f) => {
      const next = { ...f, aseguradora: v }
      const known = findAseguradora(v)
      if (known) {
        if (!next.aseg_cuit && known.cuit)           next.aseg_cuit      = known.cuit
        if (!next.aseg_telefono && known.telefono)   next.aseg_telefono  = known.telefono
        if (!next.aseg_domicilio && known.domicilio) next.aseg_domicilio = known.domicilio
        if (!next.aseg_contacto && known.contacto)   next.aseg_contacto  = known.contacto
        if (!next.aseg_mail && known.mail)           next.aseg_mail      = known.mail
      }
      return next
    })
  }

  const handleMedicoSelect = (nombre) => {
    const med = medicos.find(m => m.nombre === nombre)
    if (med) {
      setFicha(f => ({
        ...f, vm_dr: med.nombre, vm_domicilio: med.direccion,
        vm_telefono: med.telefono, vm_mail: med.mail, vm_medico_id: String(med.id),
      }))
    } else { set('vm_dr', nombre) }
  }

  const handleMediacionSelect = (nombre) => {
    const med = mediadoras.find(m => m.nombre === nombre)
    if (med) setFicha(f => ({ ...f, mediacion_nombre: med.nombre, mediacion_id: String(med.id) }))
    else set('mediacion_nombre', nombre)
  }

  const abrirNuevo = () => { setFicha(blank()); setEditing(true); setTab('ficha'); setView('ficha') }
  const abrirExistente = (s) => { setFicha({ ...s }); setEditing(false); setTab('ficha'); setView('ficha') }
  const volver = () => { setView('list'); setFicha(null); setEditing(false) }

  const entrarEdicion = () => { setSnapshot({ ...ficha }); setEditing(true) }
  const cancelarEdicion = () => {
    if (snapshot) { setFicha(snapshot); setEditing(false); setSnapshot(null) }
    else volver()
  }

  const guardar = async () => {
    setSaving(true)
    try {
      const clean = Object.fromEntries(
        Object.entries(ficha).map(([k, v]) => [k, v === '' ? null : v])
      )
      for (const k of ['monto_presupuesto', 'monto_pago', 'hon_pct']) {
        if (clean[k] != null) {
          const n = Number(clean[k])
          clean[k] = Number.isFinite(n) ? n : null
        }
      }
      const saved = await saveSiniestro(clean)

      try {
        await syncAseguradora(clean.aseguradora, {
          cuit: clean.aseg_cuit, telefono: clean.aseg_telefono,
          domicilio: clean.aseg_domicilio, contacto: clean.aseg_contacto, mail: clean.aseg_mail,
        })
      } catch {}

      setFicha((f) => ({ ...f, carpeta_nro: saved.carpeta_nro }))
      setEditing(false)
      setSnapshot(null)
    } catch (e) {
      alert('Error al guardar: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (s) => {
    if (!confirm(`¿Eliminar el siniestro CARPETA ${carpetaFmt(s.carpeta_nro)}? Se borran también sus documentos, novedades y ofertas.`)) return
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
          carpetaFmt(s.carpeta_nro), s.nro_siniestro, s.aseguradora,
          s.req_nombre, s.rdo_nombre, s.rdo_dominio,
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
              <button key={k} className={'sin-chip' + (estadoFilter === k ? ' on' : '')}
                onClick={() => setEstadoFilter(k)}>{lbl} <em>{count(k)}</em></button>
            ))}
          </div>
          <input className="sin-search" placeholder="Buscar por carpeta, cliente, compañía, dominio…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {filtradas.length === 0 ? (
          <div className="sin-empty">No hay siniestros para este filtro.</div>
        ) : (
          <div className="sin-grid">
            {filtradas.map((s) => {
              const n = docs.filter((d) => d.siniestro_id === s.id).length
              const nv = novedades.filter((x) => x.siniestro_id === s.id).length
              const cerrado = (s.estado || 'abierto') === 'cerrado'
              return (
                <div key={s.id} className={'sin-card' + (cerrado ? ' cerrado' : '')} onClick={() => abrirExistente(s)}>
                  <div className="sin-card-top">
                    <span className="sin-carpeta">CARPETA {carpetaFmt(s.carpeta_nro)}</span>
                    <span className={'sin-estado ' + (cerrado ? 'c' : 'a')}>{cerrado ? 'CERRADO' : 'ACTIVO'}</span>
                  </div>
                  <div className="sin-card-cliente">{s.req_nombre || 'Sin requirente'}</div>
                  <div className="sin-card-meta">
                    {s.aseguradora && <span>{s.aseguradora}</span>}
                    <span>Hecho: {fechaFmt(s.fecha_hecho)}</span>
                    {s.rdo_dominio && <span>Dominio: {s.rdo_dominio}</span>}
                  </div>
                  <div className="sin-card-foot">
                    <span className="sin-docs-badge">{n} doc{n === 1 ? '' : 's'} · {nv} nov.</span>
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
  const ed = editing
  const docCats = docs.filter((d) => d.siniestro_id === ficha.id).map((d) => d.categoria)

  return (
    <div className="sin-wrap">
      <Style />
      <div className="sin-ficha-head">
        <button className="sin-btn ghost" onClick={volver}>← Volver</button>
        <div className="sin-ficha-title">
          <span className="sin-carpeta big">CARPETA {carpetaFmt(ficha.carpeta_nro)}</span>
          {ficha.req_nombre && <span className="sub">{ficha.req_nombre}</span>}
        </div>
        <div className="sin-ficha-actions">
          {tab === 'ficha' ? (ed ? (
            <>
              <button className="sin-btn ghost" onClick={cancelarEdicion} disabled={saving}>Cancelar</button>
              <button className="sin-btn primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <button className="sin-btn primary" onClick={entrarEdicion}>Editar</button>
          )) : <span style={{ width: 1 }} />}
        </div>
      </div>

      {/* Pestañas */}
      <div className="sin-tabs">
        {[['ficha', 'Ficha'], ['seguimiento', 'Seguimiento'], ['cierre', 'Cierre']].map(([k, lbl]) => {
          const dis = !guardado && k !== 'ficha'
          return (
            <button key={k} className={'sin-tab' + (tab === k ? ' on' : '')} disabled={dis}
              title={dis ? 'Guardá el siniestro primero' : ''}
              onClick={() => !dis && setTab(k)}>{lbl}</button>
          )
        })}
      </div>

      {tab === 'ficha' && (
        <FichaTab
          ficha={ficha} ed={ed} set={set} guardado={guardado} cerrado={cerrado}
          docs={docs} docCats={docCats} aseguradoras={aseguradoras}
          mediadoras={mediadoras} medicos={medicos}
          setAseguradora={setAseguradora}
          handleMedicoSelect={handleMedicoSelect} handleMediacionSelect={handleMediacionSelect}
        />
      )}

      {tab === 'seguimiento' && guardado && (
        <SeguimientoTab siniestro={ficha} novedades={novedades.filter(n => n.siniestro_id === ficha.id)} />
      )}

      {tab === 'cierre' && guardado && (
        <CierreTab
          siniestro={siniestros.find(s => s.id === ficha.id) || ficha}
          ofertas={ofertas.filter(o => o.siniestro_id === ficha.id)}
          docs={docs} cobros={store.cobros || []}
        />
      )}
    </div>
  )
}

// ══════════════════ PESTAÑA: FICHA ══════════════════
function FichaTab({ ficha, ed, set, guardado, cerrado, docs, docCats, aseguradoras, mediadoras, medicos, setAseguradora, handleMedicoSelect, handleMediacionSelect }) {
  return (
    <>
      {!ed && <div className="sin-readbar">Modo lectura · tocá <strong>Editar</strong> para modificar los datos</div>}
      {guardado && (
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <button className="sin-btn pdf" onClick={() => imprimirCaratula(ficha)}>⬇ Carátula PDF</button>
          <button className="sin-btn pdf" onClick={() => imprimirFormulario(ficha, docCats)}>⬇ Formulario PDF</button>
        </div>
      )}

      <Section title="Identificación">
        <Txt label="Nº de siniestro" value={ficha.nro_siniestro} onChange={(v) => set('nro_siniestro', v)} editing={ed} />
        <Txt label="CUIT de la compañía" value={ficha.aseg_cuit} onChange={(v) => set('aseg_cuit', v)} editing={ed} />
        <label className="sin-field wide">
          <span>Compañía de Seguros</span>
          {ed ? (
            <>
              <input list="sin-aseg-list" value={ficha.aseguradora ?? ''}
                placeholder="Escribí parte del nombre (ej: SANCOR, GALICIA, LA CAJA…)"
                onChange={(e) => setAseguradora(e.target.value)} />
              <datalist id="sin-aseg-list">
                {aseguradoras.map((a) => <option key={a.id} value={a.nombre} />)}
              </datalist>
              <em className="sin-hint">Padrón SSN · al elegirla se completan CUIT y contactos guardados</em>
            </>
          ) : <div className="sin-ro">{ficha.aseguradora || '—'}</div>}
        </label>
      </Section>

      <Section title="Requirente (cliente)">
        <Txt label="Nombre" wide value={ficha.req_nombre} onChange={(v) => set('req_nombre', v)} editing={ed} />
        <Txt label="DNI" value={ficha.req_dni} onChange={(v) => set('req_dni', v)} editing={ed} />
        <Txt label="Teléfono" value={ficha.req_telefono} onChange={(v) => set('req_telefono', v)} editing={ed} />
        <label className="sin-field">
          <span>Calidad de Tercero</span>
          {ed ? (
            <select className="sin-select" value={ficha.req_calidad ?? ''} onChange={(e) => set('req_calidad', e.target.value)}>
              <option value="">Seleccione...</option>
              <option value="Auto">Auto</option>
              <option value="Moto">Moto</option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Tercero">Tercero</option>
              <option value="Peatón">Peatón</option>
            </select>
          ) : <div className="sin-ro">{ficha.req_calidad || '—'}</div>}
        </label>
      </Section>

      <Section title="Detalle del Hecho">
        <Txt label="Fecha del hecho" type="date" value={ficha.fecha_hecho} onChange={(v) => set('fecha_hecho', v)} editing={ed} />
        <Txt label="Hora del hecho" type="time" value={ficha.hora_hecho} onChange={(v) => set('hora_hecho', v)} editing={ed} />
        <Txt label="Lugar del hecho" wide value={ficha.lugar} onChange={(v) => set('lugar', v)} editing={ed} />
        <div className="sin-field wide">
          <span>Croquis del Hecho</span>
          <div className="sin-croquis-box">
            <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>[ Espacio reservado para Croquis del Accidente ]</span>
          </div>
        </div>
      </Section>

      <Section title="Datos del Seguro">
        <Eco label="Compañía de Seguros" value={ficha.aseguradora} nota="cargada en Identificación" />
        <Eco label="CUIT" value={ficha.aseg_cuit} />
        <Bool label="¿Denuncia administrativa?" value={ficha.denuncia_admin} onChange={(v) => set('denuncia_admin', v)} editing={ed} />
        <Txt label="Tel. aseguradora" value={ficha.aseg_telefono} onChange={(v) => set('aseg_telefono', v)} editing={ed} />
        <Txt label="Contacto aseguradora" value={ficha.aseg_contacto} onChange={(v) => set('aseg_contacto', v)} editing={ed} />
        <Txt label="Domicilio aseguradora" wide value={ficha.aseg_domicilio} onChange={(v) => set('aseg_domicilio', v)} editing={ed} />
        <Txt label="Mail aseguradora" value={ficha.aseg_mail} onChange={(v) => set('aseg_mail', v)} editing={ed} />

        <div className="sin-field wide" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
          <Bool label="¿Derivado?" value={ficha.derivado} onChange={(v) => set('derivado', v)} editing={ed} />
        </div>

        {ficha.derivado && (
          <div className="sin-derivado-block wide">
            <Txt label="Estudio Liquidador" value={ficha.derivado_estudio} onChange={(v) => set('derivado_estudio', v)} editing={ed} />
            <Txt label="Responsable" value={ficha.derivado_responsable} onChange={(v) => set('derivado_responsable', v)} editing={ed} />
            <Txt label="Teléfono" value={ficha.derivado_telefono} onChange={(v) => set('derivado_telefono', v)} editing={ed} />
            <Txt label="Mail" value={ficha.derivado_mail} onChange={(v) => set('derivado_mail', v)} editing={ed} />
          </div>
        )}
      </Section>

      <Section title="Lesiones">
        <Bool label="¿Hubo Lesiones?" value={ficha.lesiones} onChange={(v) => {
          set('lesiones', v); if (!v) set('comprobantes_medicos', false)
        }} editing={ed} />
        {ficha.lesiones && (
          <Bool label="¿Adjunta certificados médicos?" value={ficha.comprobantes_medicos} onChange={(v) => set('comprobantes_medicos', v)} editing={ed} />
        )}
        <Area label="Detalles de Lesiones" value={ficha.lesiones_detalle} onChange={(v) => set('lesiones_detalle', v)} editing={ed} />
      </Section>

      <Section title="Requerido (contraparte)">
        <Txt label="Nombre" wide value={ficha.rdo_nombre} onChange={(v) => set('rdo_nombre', v)} editing={ed} />
        <Txt label="Vehículo" value={ficha.rdo_vehiculo} onChange={(v) => set('rdo_vehiculo', v)} editing={ed} />
        <Txt label="Dominio" value={ficha.rdo_dominio} onChange={(v) => set('rdo_dominio', v)} editing={ed} />
        <Txt label="DNI" value={ficha.rdo_dni} onChange={(v) => set('rdo_dni', v)} editing={ed} />
        <Txt label="Póliza" value={ficha.rdo_poliza} onChange={(v) => set('rdo_poliza', v)} editing={ed} />
        <Txt label="Teléfono" value={ficha.rdo_telefono} onChange={(v) => set('rdo_telefono', v)} editing={ed} />
        <Txt label="Domicilio" wide value={ficha.rdo_domicilio} onChange={(v) => set('rdo_domicilio', v)} editing={ed} />
        <Area label="Daños" value={ficha.danos_detalle} onChange={(v) => set('danos_detalle', v)} editing={ed} />
      </Section>

      <Section title="Mediación">
        <Bool label="¿Mediación?" value={ficha.mediacion} onChange={(v) => set('mediacion', v)} editing={ed} />
        {ficha.mediacion && (
          <>
            <Txt label="Fecha de Mediación" type="date" value={ficha.mediacion_fecha} onChange={(v) => set('mediacion_fecha', v)} editing={ed} />
            <label className="sin-field">
              <span>Nombre de la Mediadora</span>
              {ed ? (
                <>
                  <input list="sin-mediadoras-list" value={ficha.mediacion_nombre ?? ''}
                    placeholder="Buscá o cargá mediadora..."
                    onChange={(e) => handleMediacionSelect(e.target.value)} />
                  <datalist id="sin-mediadoras-list">
                    {mediadoras.map((m) => <option key={m.id} value={m.nombre} />)}
                  </datalist>
                </>
              ) : <div className="sin-ro">{ficha.mediacion_nombre || '—'}</div>}
            </label>
          </>
        )}
      </Section>

      <Section title="Vista médica">
        <Bool label="¿Vista médica?" value={ficha.vista_medica} onChange={(v) => set('vista_medica', v)} editing={ed} />
        {ficha.vista_medica && (
          <>
            <Txt label="Fecha Vista" type="date" value={ficha.vm_fecha} onChange={(v) => set('vm_fecha', v)} editing={ed} />
            <label className="sin-field">
              <span>Dr. / Especialista</span>
              {ed ? (
                <>
                  <input list="sin-medicos-list" value={ficha.vm_dr ?? ''}
                    placeholder="Escribí para buscar médico..."
                    onChange={(e) => handleMedicoSelect(e.target.value)} />
                  <datalist id="sin-medicos-list">
                    {medicos.map((m) => <option key={m.id} value={m.nombre} />)}
                  </datalist>
                </>
              ) : <div className="sin-ro">{ficha.vm_dr || '—'}</div>}
            </label>
            <Txt label="Teléfono" value={ficha.vm_telefono} onChange={(v) => set('vm_telefono', v)} editing={ed} />
            <Txt label="Mail" value={ficha.vm_mail} onChange={(v) => set('vm_mail', v)} editing={ed} />
            <Txt label="Domicilio" wide value={ficha.vm_domicilio} onChange={(v) => set('vm_domicilio', v)} editing={ed} />
          </>
        )}
      </Section>

      <Section title="Presupuesto">
        {ed ? (
          <label className="sin-field">
            <span>Monto del presupuesto (Reclamar)</span>
            <input type="number" step="0.01" value={ficha.monto_presupuesto ?? ''}
              onChange={(e) => set('monto_presupuesto', e.target.value)}
              placeholder="Ingrese el estimado a reclamar..." />
          </label>
        ) : (
          <label className="sin-field">
            <span>Monto del presupuesto (Reclamar)</span>
            <div className="sin-ro">{montoFmt(ficha.monto_presupuesto)}</div>
          </label>
        )}
      </Section>

      <Section title="Estado">
        <Bool label="¿Cerrado?" value={cerrado} onChange={(v) => set('estado', v ? 'cerrado' : 'abierto')} editing={ed} />
      </Section>

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
    </>
  )
}

// ══════════════════ PESTAÑA: SEGUIMIENTO ══════════════════
function SeguimientoTab({ siniestro, novedades }) {
  const [modal, setModal] = useState(false)
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [novedad, setNovedad] = useState('')
  const [accion, setAccion] = useState('')
  const [crearTarea, setCrearTarea] = useState(false)
  const [tareaTitulo, setTareaTitulo] = useState('')
  const [tareaVenc, setTareaVenc] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setFecha(dateFmt(new Date())); setNovedad(''); setAccion('')
    setCrearTarea(false); setTareaTitulo(''); setTareaVenc('')
  }

  const handleSave = async () => {
    if (!novedad.trim()) return alert('Escribí la novedad.')
    setBusy(true)
    try {
      const obj = {
        id: uid(), siniestro_id: siniestro.id, fecha,
        novedad: novedad.trim(), accion: accion.trim() || null, tarea_id: null,
      }
      if (crearTarea) {
        const tid = uid()
        const base = tareaTitulo.trim() || novedad.trim().substring(0, 80)
        await saveTarea({
          id: tid,
          titulo: `[C-${carpetaFmt(siniestro.carpeta_nro)}] ${base}`,
          causa: null,
          criticidad: tareaVenc ? 'urgente' : 'normal',
          vencimiento: tareaVenc || null,
          estado: 'no-iniciada',
          notas: accion.trim() || null,
          fecha: new Date().toISOString(),
        })
        obj.tarea_id = tid
      }
      await saveNovedad(obj)
      setModal(false); reset()
    } catch (e) {
      alert('Error al guardar: ' + (e.message || e))
    } finally { setBusy(false) }
  }

  const borrar = async (n) => {
    if (!confirm('¿Eliminar esta novedad?')) return
    await deleteNovedad(n.id)
  }

  const list = [...novedades].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

  return (
    <>
      <div className="sin-sub-head">
        <div className="sin-sub-title">Bitácora del siniestro <em>{list.length} novedad{list.length === 1 ? '' : 'es'}</em></div>
        <button className="sin-btn primary" onClick={() => { reset(); setModal(true) }}>＋ Nueva novedad</button>
      </div>

      {list.length === 0 ? (
        <div className="sin-empty">Todavía no hay novedades. Registrá llamados, mails y presentaciones.</div>
      ) : (
        <div className="sin-timeline">
          {list.map((n) => (
            <div key={n.id} className="sin-nov">
              <div className="sin-nov-fecha">{fechaFmt(n.fecha)}</div>
              <div className="sin-nov-body">
                <div className="sin-nov-txt">{n.novedad}</div>
                {n.accion && <div className="sin-nov-accion">→ {n.accion}</div>}
                {n.tarea_id && <div className="sin-nov-tarea">✓ generó tarea</div>}
              </div>
              <button className="sin-del" onClick={() => borrar(n)}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Nueva Novedad" onClose={() => { setModal(false); reset() }} maxWidth="520px">
          <div className="form-group" style={{ marginBottom: '.9rem' }}>
            <label>Fecha</label>
            <input type="date" className="form-control" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: '.9rem' }}>
            <label>Novedad *</label>
            <textarea className="form-control" rows="3" value={novedad} onChange={e => setNovedad(e.target.value)}
              placeholder="Ej: Llamé a la compañía, me derivan al liquidador..." />
          </div>
          <div className="form-group" style={{ marginBottom: '.9rem' }}>
            <label>Acción</label>
            <textarea className="form-control" rows="2" value={accion} onChange={e => setAccion(e.target.value)}
              placeholder="¿Qué corresponde hacer?" />
          </div>

          <div className="card" style={{ background: 'var(--cream)', marginBottom: '.9rem', padding: '.9rem' }}>
            <div className="checkbox-row">
              <input type="checkbox" checked={crearTarea} onChange={e => setCrearTarea(e.target.checked)} />
              <label><strong>Generar tarea a partir de esta novedad</strong></label>
            </div>
            {crearTarea && (
              <div style={{ marginTop: '.75rem' }}>
                <div className="form-group" style={{ marginBottom: '.6rem' }}>
                  <label>Título de la tarea</label>
                  <input className="form-control" value={tareaTitulo} onChange={e => setTareaTitulo(e.target.value)}
                    placeholder="Si vacío, se usa el texto de la novedad" />
                </div>
                <div className="form-group">
                  <label>Vencimiento (opcional)</label>
                  <input type="date" className="form-control" value={tareaVenc} onChange={e => setTareaVenc(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
            <button className="btn btn-ghost" onClick={() => { setModal(false); reset() }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ══════════════════ PESTAÑA: CIERRE ══════════════════
function CierreTab({ siniestro, ofertas, docs, cobros }) {
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [tipo, setTipo] = useState('oferta')
  const [monto, setMonto] = useState('')
  const [honPctCia, setHonPctCia] = useState('')
  const [nota, setNota] = useState('')
  const [honPct, setHonPct] = useState(siniestro.hon_pct ?? 20)
  const [busy, setBusy] = useState(false)

  const list = [...ofertas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  const aceptada = list.find(o => o.aceptada)

  // ── Cálculo ──
  const acordado   = aceptada ? Number(aceptada.monto) || 0 : 0
  const pctCia     = aceptada ? Number(aceptada.hon_pct_cia) || 0 : 0
  const pctCli     = Number(honPct) || 0
  const honCia     = acordado * pctCia / 100
  const honCliente = acordado * pctCli / 100
  const netoCliente = acordado - honCliente
  const totalPercibido = honCia + honCliente

  const agregar = async () => {
    if (!monto) return alert('Poné el monto.')
    setBusy(true)
    try {
      await saveOferta({
        id: uid(), siniestro_id: siniestro.id, fecha,
        tipo, monto: Number(monto),
        hon_pct_cia: honPctCia === '' ? null : Number(honPctCia),
        nota: nota.trim() || null, aceptada: false,
      })
      setMonto(''); setHonPctCia(''); setNota('')
    } catch (e) { alert('Error: ' + (e.message || e)) }
    finally { setBusy(false) }
  }

  const marcarAceptada = async (o) => {
    await aceptarOferta(siniestro.id, o.aceptada ? null : o.id)
  }

  const borrar = async (o) => {
    if (!confirm('¿Eliminar esta oferta?')) return
    await deleteOferta(o.id)
  }

  const guardarPct = async () => {
    const n = Number(honPct)
    if (!Number.isFinite(n)) return
    if (n === siniestro.hon_pct) return
    await saveSiniestro({ ...siniestro, hon_pct: n })
  }

  const cobroExistente = siniestro.cobro_id ? cobros.find(c => c.id === siniestro.cobro_id) : null

  const registrarCobro = async () => {
    if (!aceptada) return alert('Marcá primero cuál oferta se aceptó.')
    if (cobroExistente) return alert('Esta carpeta ya tiene un cobro registrado.')
    if (totalPercibido <= 0) return alert('El total a percibir es cero. Revisá los porcentajes.')
    if (!confirm(`Registrar en Cobros $ ${totalPercibido.toLocaleString('es-AR')} (honorarios de la carpeta ${carpetaFmt(siniestro.carpeta_nro)})?`)) return
    setBusy(true)
    try {
      const cobro = {
        id: uid(),
        fecha: dateFmt(new Date()),
        monto: Math.round(totalPercibido * 100) / 100,
        concepto: `Honorarios — Carpeta ${carpetaFmt(siniestro.carpeta_nro)} — ${siniestro.req_nombre || 's/requirente'}`,
        moneda: 'ARS',
        causa: null,
      }
      await saveCobro(cobro)
      await saveSiniestro({ ...siniestro, cobro_id: cobro.id })
    } catch (e) { alert('Error: ' + (e.message || e)) }
    finally { setBusy(false) }
  }

  const cats = [...DOC_CIERRE, ...(siniestro.mediacion ? DOC_MEDIACION : [])]

  return (
    <>
      {/* ── Negociación ── */}
      <div className="sin-section">
        <h3>Negociación</h3>

        <div className="sin-oferta-form">
          <label className="sin-field"><span>Fecha</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
          <label className="sin-field"><span>Tipo</span>
            <select className="sin-select" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="oferta">Oferta (compañía)</option>
              <option value="contraoferta">Contraoferta (nuestra)</option>
            </select></label>
          <label className="sin-field"><span>Monto</span>
            <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" /></label>
          <label className="sin-field"><span>Honorarios cía %</span>
            <input type="number" step="0.01" value={honPctCia} onChange={e => setHonPctCia(e.target.value)} placeholder="ej: 13" /></label>
          <label className="sin-field wide"><span>Nota</span>
            <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" /></label>
          <div className="sin-field">
            <span>&nbsp;</span>
            <button className="sin-btn primary" onClick={agregar} disabled={busy}>＋ Agregar</button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="sin-doc-note" style={{ marginTop: '1rem' }}>Sin ofertas registradas todavía.</div>
        ) : (
          <div className="sin-ofertas">
            {list.map((o) => (
              <div key={o.id} className={'sin-oferta' + (o.aceptada ? ' ok' : '')}>
                <span className={'sin-oferta-tipo ' + o.tipo}>{o.tipo === 'oferta' ? 'CÍA' : 'NOS'}</span>
                <span className="sin-oferta-fecha">{fechaFmt(o.fecha)}</span>
                <span className="sin-oferta-monto">{montoFmt(o.monto)}</span>
                <span className="sin-oferta-pct">{o.hon_pct_cia != null ? o.hon_pct_cia + '% hon.' : '—'}</span>
                <span className="sin-oferta-nota">{o.nota || ''}</span>
                <button className={'sin-oferta-acc' + (o.aceptada ? ' on' : '')} onClick={() => marcarAceptada(o)}>
                  {o.aceptada ? '✓ Aceptada' : 'Marcar aceptada'}
                </button>
                <button className="sin-del" onClick={() => borrar(o)}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Liquidación ── */}
      <div className="sin-section">
        <h3>Liquidación</h3>
        {!aceptada ? (
          <div className="sin-doc-note">Marcá una oferta como aceptada para ver el cálculo.</div>
        ) : (
          <>
            <div className="sin-grid-fields" style={{ marginBottom: '1rem' }}>
              <label className="sin-field">
                <span>Honorarios al cliente %</span>
                <input type="number" step="0.01" value={honPct}
                  onChange={e => setHonPct(e.target.value)} onBlur={guardarPct} />
                <em className="sin-hint">Se guarda solo al salir del campo</em>
              </label>
              <label className="sin-field">
                <span>Honorarios compañía %</span>
                <div className="sin-ro eco">{pctCia ? pctCia + ' %' : '—'} <em className="sin-eco-nota">de la oferta aceptada</em></div>
              </label>
            </div>

            <table className="sin-liq">
              <tbody>
                <tr><td>Monto acordado</td><td>{montoFmt(acordado)}</td></tr>
                <tr><td>Honorarios cliente ({pctCli}%)</td><td className="g">{montoFmt(honCliente)}</td></tr>
                <tr><td>Honorarios compañía ({pctCia}%)</td><td className="g">{montoFmt(honCia)}</td></tr>
                <tr className="sep"><td>Neto al cliente</td><td>{montoFmt(netoCliente)}</td></tr>
                <tr className="tot"><td>Total que percibís</td><td>{montoFmt(totalPercibido)}</td></tr>
              </tbody>
            </table>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap' }}>
              <button className="sin-btn primary" onClick={registrarCobro} disabled={busy || !!cobroExistente}>
                {cobroExistente ? '✓ Cobro registrado' : '💵 Registrar cobro'}
              </button>
              {cobroExistente && (
                <span className="sin-hint">{montoFmt(cobroExistente.monto)} el {fechaFmt(cobroExistente.fecha)} · lo ves en Cobros</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Documentación de cierre ── */}
      <div className="sin-section">
        <h3>Documentación de cierre</h3>
        <div className="sin-docs">
          {cats.map((cat) => (
            <DocSlot key={cat.key} cat={cat} siniestroId={siniestro.id} docs={docs} />
          ))}
        </div>
        {!siniestro.mediacion && (
          <div className="sin-hint" style={{ marginTop: '.8rem', display: 'block' }}>
            Los documentos de mediación aparecen si tildás “Mediación” en la Ficha.
          </div>
        )}
      </div>
    </>
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

// ── Estilos ──
function Style() {
  return (
    <style>{`
    .sin-wrap {
      --g:#c9a24b; --g-dim:#a9853a;
      --panel:#24201a; --input:#322d23; --input-b:#4a4234;
      --txt:#f0ece2; --muted:#a49a88; --ro:#e6e1d6;
      --line:#39332a; --danger:#c9603f; --ok:#6db36d;
      padding:1.25rem 1.5rem 4rem; font-family:'IBM Plex Mono', monospace; color:var(--txt);
      max-width:960px; margin:0 auto;
    }
    .sin-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; }
    .sin-head h1 { font-family:'Fraunces', serif; font-size:1.7rem; margin:0; color:var(--g); }

    .sin-btn { border:1px solid var(--input-b); background:transparent; color:var(--txt);
      padding:.55rem 1rem; border-radius:8px; cursor:pointer; font-family:inherit; font-size:.82rem; transition:all .15s; }
    .sin-btn:hover { border-color:var(--g); }
    .sin-btn.primary { background:var(--g); color:#1c1811; border-color:var(--g); font-weight:600; }
    .sin-btn.primary:hover { background:var(--g-dim); }
    .sin-btn:disabled { opacity:.5; cursor:default; }
    .sin-btn.pdf { border-color:var(--g); color:var(--g); background:rgba(201,162,75,.06); font-weight:600; }
    .sin-btn.pdf:hover { background:var(--g); color:#1c1811; }

    .sin-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap; }
    .sin-chips { display:flex; gap:.5rem; }
    .sin-chip { border:1px solid var(--input-b); background:transparent; color:var(--muted);
      padding:.4rem .85rem; border-radius:20px; cursor:pointer; font-family:inherit; font-size:.78rem; transition:all .15s; }
    .sin-chip:hover { color:var(--txt); }
    .sin-chip.on { border-color:var(--g); color:var(--g); background:rgba(201,162,75,.08); }
    .sin-chip em { font-style:normal; opacity:.55; margin-left:.3rem; }
    .sin-search { flex:1; min-width:240px; background:var(--input); border:1px solid var(--input-b);
      color:var(--txt); padding:.55rem .8rem; border-radius:8px; font-family:inherit; font-size:.82rem; }
    .sin-search::placeholder { color:var(--muted); }
    .sin-search:focus { outline:none; border-color:var(--g); box-shadow:0 0 0 3px rgba(201,162,75,.15); }

    /* Cards de lista */
    .sin-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; }
    .sin-card { background:var(--panel); border:1px solid var(--line); border-left:3px solid var(--g);
      border-radius:10px; padding:1rem 1.1rem; cursor:pointer; transition:border-color .15s, transform .15s; }
    .sin-card:hover { border-color:var(--g); transform:translateY(-2px); }
    .sin-card.cerrado { opacity:.55; border-left-color:var(--muted); }
    .sin-card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem; }
    .sin-carpeta { font-size:.8rem; letter-spacing:.05em; color:var(--g); font-weight:600; }
    .sin-carpeta.big { font-size:1.1rem; }
    .sin-estado { font-size:.62rem; padding:.2rem .45rem; border-radius:4px; letter-spacing:.08em; }
    .sin-estado.a { background:rgba(201,162,75,.16); color:var(--g); }
    .sin-estado.c { background:rgba(164,154,136,.16); color:var(--muted); }
    .sin-card-cliente { font-size:.98rem; margin-bottom:.45rem; }
    .sin-card-meta { display:flex; flex-direction:column; gap:.18rem; font-size:.72rem; color:var(--muted); }
    .sin-card-foot { display:flex; justify-content:space-between; align-items:center; margin-top:.8rem; }
    .sin-docs-badge { font-size:.68rem; color:var(--muted); }
    .sin-del { background:none; border:none; color:var(--danger); font-size:.7rem; cursor:pointer; font-family:inherit; }
    .sin-del:hover { text-decoration:underline; }
    .sin-empty { color:var(--muted); padding:2.5rem 0; text-align:center; }

    /* Ficha */
    .sin-ficha-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:.8rem;
      position:sticky; top:0; background:rgba(26,23,18,.96); backdrop-filter:blur(4px); padding:.6rem 0; z-index:5; }
    .sin-ficha-title { text-align:center; display:flex; flex-direction:column; gap:.15rem; }
    .sin-ficha-title .sub { font-size:.75rem; color:var(--muted); }
    .sin-ficha-actions { display:flex; gap:.5rem; }
    .sin-readbar { font-size:.72rem; color:var(--muted); background:var(--panel); border:1px solid var(--line);
      border-radius:8px; padding:.5rem .8rem; margin-bottom:1.25rem; text-align:center; }
    .sin-readbar strong { color:var(--g); font-weight:600; }

    /* Pestañas */
    .sin-tabs { display:flex; gap:.3rem; border-bottom:1px solid var(--line); margin-bottom:1.25rem; }
    .sin-tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--muted);
      padding:.6rem 1.1rem; cursor:pointer; font-family:inherit; font-size:.82rem; transition:all .15s; }
    .sin-tab:hover:not(:disabled) { color:var(--txt); }
    .sin-tab.on { color:var(--g); border-bottom-color:var(--g); font-weight:600; }
    .sin-tab:disabled { opacity:.35; cursor:default; }

    .sin-sub-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:.6rem; }
    .sin-sub-title { font-family:'Fraunces', serif; font-size:1rem; color:var(--g); }
    .sin-sub-title em { font-style:normal; font-family:'IBM Plex Mono', monospace; font-size:.72rem; color:var(--muted); margin-left:.5rem; }

    .sin-section { margin-bottom:1.1rem; border:1px solid var(--line); border-radius:12px; padding:1.1rem 1.2rem; background:var(--panel); }
    .sin-section h3 { margin:0 0 1rem; font-size:.9rem; color:var(--g); font-family:'Fraunces', serif;
      text-transform:uppercase; letter-spacing:.06em; padding-bottom:.55rem; border-bottom:1px solid var(--line); }
    .sin-grid-fields { display:grid; grid-template-columns:repeat(2,1fr); gap:.9rem 1.1rem; }

    .sin-field { display:flex; flex-direction:column; gap:.35rem; font-size:.7rem; }
    .sin-field.wide { grid-column:1 / -1; }
    .sin-field > span { color:var(--muted); text-transform:uppercase; letter-spacing:.05em; font-size:.66rem; }
    .sin-field input, .sin-field textarea, .sin-select {
      background:var(--input); border:1px solid var(--input-b); color:var(--txt);
      padding:.55rem .7rem; border-radius:8px; font-family:inherit; font-size:.9rem; transition:border-color .15s, box-shadow .15s; }
    .sin-field input:focus, .sin-field textarea:focus, .sin-select:focus {
      outline:none; border-color:var(--g); box-shadow:0 0 0 3px rgba(201,162,75,.15); }
    .sin-field textarea { resize:vertical; line-height:1.5; }
    .sin-select { cursor:pointer; color-scheme:dark; }
    .sin-hint { font-style:normal; font-size:.62rem; color:var(--muted); opacity:.75; margin-top:.15rem; }
    .sin-eco-nota { font-style:normal; opacity:.6; text-transform:none; letter-spacing:0; }

    .sin-croquis-box { border:1px dashed var(--input-b); background:rgba(0,0,0,0.15); border-radius:8px; padding:2rem; text-align:center; margin-top:0.2rem; }
    .sin-derivado-block { display:grid; grid-template-columns:repeat(2, 1fr); gap:0.8rem; background:rgba(201,162,75,0.03); border:1px solid var(--line); border-radius:8px; padding:0.8rem; margin-top:0.5rem; }

    .sin-ro { color:var(--ro); font-size:.9rem; padding:.5rem .1rem; min-height:1.2rem; border-bottom:1px solid var(--line); }
    .sin-ro.multi { white-space:pre-wrap; line-height:1.5; }
    .sin-ro.eco { color:var(--g); border-bottom-style:dotted; }

    .sin-sino { display:inline-flex; border:1px solid var(--input-b); border-radius:8px; overflow:hidden; width:fit-content; }
    .sin-sino button { background:var(--input); border:none; color:var(--muted); padding:.45rem 1.1rem; cursor:pointer; font-family:inherit; font-size:.82rem; }
    .sin-sino button.on { background:var(--g); color:#1c1811; font-weight:600; }

    /* Timeline de novedades */
    .sin-timeline { display:flex; flex-direction:column; gap:.55rem; }
    .sin-nov { display:flex; gap:.9rem; align-items:flex-start; background:var(--panel);
      border:1px solid var(--line); border-left:3px solid var(--g); border-radius:10px; padding:.8rem 1rem; }
    .sin-nov-fecha { font-size:.7rem; color:var(--g); min-width:76px; padding-top:.15rem; }
    .sin-nov-body { flex:1; }
    .sin-nov-txt { font-size:.88rem; line-height:1.5; white-space:pre-wrap; }
    .sin-nov-accion { font-size:.75rem; color:var(--muted); margin-top:.35rem; white-space:pre-wrap; }
    .sin-nov-tarea { font-size:.66rem; color:var(--ok); margin-top:.35rem; }

    /* Ofertas */
    .sin-oferta-form { display:grid; grid-template-columns:repeat(4,1fr); gap:.7rem .9rem; align-items:end; }
    .sin-ofertas { display:flex; flex-direction:column; gap:.4rem; margin-top:1.1rem; }
    .sin-oferta { display:flex; align-items:center; gap:.7rem; background:var(--input);
      border:1px solid var(--input-b); border-radius:8px; padding:.5rem .7rem; font-size:.78rem; flex-wrap:wrap; }
    .sin-oferta.ok { border-color:var(--ok); background:rgba(120,180,120,.08); }
    .sin-oferta-tipo { font-size:.6rem; padding:.15rem .4rem; border-radius:4px; letter-spacing:.06em; font-weight:600; }
    .sin-oferta-tipo.oferta { background:rgba(201,162,75,.18); color:var(--g); }
    .sin-oferta-tipo.contraoferta { background:rgba(140,170,200,.18); color:#8cb0c8; }
    .sin-oferta-fecha { color:var(--muted); font-size:.72rem; }
    .sin-oferta-monto { font-weight:600; font-size:.86rem; }
    .sin-oferta-pct { color:var(--muted); font-size:.72rem; }
    .sin-oferta-nota { flex:1; color:var(--muted); font-size:.72rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sin-oferta-acc { background:none; border:1px solid var(--input-b); color:var(--muted); border-radius:6px;
      padding:.25rem .6rem; font-size:.66rem; cursor:pointer; font-family:inherit; }
    .sin-oferta-acc:hover { border-color:var(--ok); color:var(--ok); }
    .sin-oferta-acc.on { border-color:var(--ok); color:var(--ok); background:rgba(120,180,120,.12); }

    /* Liquidación */
    .sin-liq { width:100%; border-collapse:collapse; font-size:.86rem; }
    .sin-liq td { padding:.55rem .3rem; border-bottom:1px solid var(--line); }
    .sin-liq td:last-child { text-align:right; font-weight:600; }
    .sin-liq td.g { color:var(--g); }
    .sin-liq tr.sep td { border-top:1px solid var(--input-b); }
    .sin-liq tr.tot td { font-size:1rem; color:var(--g); font-weight:700; border-bottom:none; padding-top:.8rem; }

    /* Documentación */
    .sin-doc-note { color:var(--muted); font-size:.82rem; }
    .sin-docs { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.8rem; }
    .sin-slot { border:1px dashed var(--input-b); border-radius:10px; padding:.7rem .8rem; background:var(--input); transition:border-color .15s; }
    .sin-slot.filled { border-style:solid; border-color:rgba(120,180,120,.55); background:rgba(120,180,120,.06); }
    .sin-slot-head { display:flex; align-items:center; gap:.45rem; margin-bottom:.5rem; }
    .sin-slot-head .dot { width:9px; height:9px; border-radius:50%; background:var(--input-b); }
    .sin-slot.filled .sin-slot-head .dot { background:var(--ok); }
    .sin-slot-head .lbl { font-size:.8rem; color:var(--txt); }
    .sin-slot-file { display:flex; align-items:center; justify-content:space-between; gap:.4rem; margin-bottom:.35rem; }
    .sin-slot-file .link { background:none; border:none; color:var(--g); font-size:.72rem; cursor:pointer;
      font-family:inherit; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:135px; }
    .sin-slot-file .link:hover { text-decoration:underline; }
    .sin-slot-file .x { background:none; border:none; color:var(--danger); cursor:pointer; font-size:.72rem; }
    .sin-slot-up { display:inline-block; font-size:.74rem; color:var(--muted); cursor:pointer; padding:.25rem 0; }
    .sin-slot-up:hover { color:var(--g); }

    @media (max-width:640px) {
      .sin-grid-fields { grid-template-columns:1fr; }
      .sin-derivado-block { grid-template-columns:1fr; }
      .sin-oferta-form { grid-template-columns:repeat(2,1fr); }
    }
    `}</style>
  )
}
