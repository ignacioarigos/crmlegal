import { useState } from 'react'
import { uid } from '../lib/supabase.js'
import {
  saveSiniestro, deleteSiniestro,
  uploadDoc, getDocUrl, deleteDoc,
  findAseguradora, syncAseguradora,
} from '../lib/store.js'
import { imprimirCaratula, imprimirFormulario } from '../lib/caratula.js'

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
  nro_siniestro: '', compania: '', causa_id: null, estado: 'abierto',
  
  // Detalle del hecho
  fecha_hecho: '', hora_hecho: '', lugar: '',
  
  // Lesiones
  lesiones: false, comprobantes_medicos: false, lesiones_detalle: '',
  
  // Datos del Seguro
  aseguradora: '', aseg_cuit: '', denuncia_admin: false,
  aseg_telefono: '', aseg_domicilio: '', aseg_contacto: '', aseg_mail: '',
  
  // Derivado (Estudio Liquidador)
  derivado: false,
  derivado_estudio: '', derivado_responsable: '', derivado_telefono: '', derivado_mail: '',

  // Requirente
  req_nombre: '', req_dni: '', req_telefono: '',
  req_calidad: '', // Auto - Moto - Bicicleta - Tercero - Peatón

  // Requerido
  rdo_nombre: '', rdo_vehiculo: '', rdo_telefono: '', rdo_domicilio: '',
  rdo_dni: '', rdo_dominio: '', rdo_poliza: '',
  danos_detalle: '',

  // Mediación
  mediacion: false, mediacion_fecha: '', mediacion_id: null, mediacion_nombre: '',
  
  // Vista médica
  vista_medica: false, vm_fecha: '', vm_medico_id: null, vm_dr: '', vm_domicilio: '', vm_telefono: '', vm_mail: '',
  
  // Presupuesto
  monto_presupuesto: '',
})

// ── Campos (leen/editan según `editing`) ──
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

// ══════════════════════════════════════════════════════════════
export default function Siniestros({ store }) {
  const siniestros = store.siniestros || []
  const docs = store.siniestro_docs || []
  const aseguradoras = store.aseguradoras || []
  
  // Base de datos local simulada para Mediadoras y Médicos (para vincular en tu BD después)
  const mediadoras = store.mediadoras || [{ id: 1, nombre: 'Dra. María Laura Rossi' }]
  const medicos = store.medicos || [
    { id: 1, nombre: 'Dr. Juan Pérez', direccion: 'Av. Corrientes 1234', mail: 'juan.perez@mail.com', telefono: '11-4567-8901' }
  ]

  const [view, setView] = useState('list')
  const [ficha, setFicha] = useState(null)
  const [editing, setEditing] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [saving, setSaving] = useState(false)

  // Filtros de lista
  const [estadoFilter, setEstadoFilter] = useState('abierto')
  const [q, setQ] = useState('')

  const set = (k, v) => setFicha((f) => ({ ...f, [k]: v }))

  const setAseguradora = (v) => {
    setFicha((f) => {
      const next = { ...f, aseguradora: v }
      const known = findAseguradora(v)
      if (known) {
        if (!next.aseg_telefono && known.telefono)   next.aseg_telefono  = known.telefono
        if (!next.aseg_domicilio && known.domicilio) next.aseg_domicilio = known.domicilio
        if (!next.aseg_contacto && known.contacto)   next.aseg_contacto  = known.contacto
        if (!next.aseg_mail && known.mail)           next.aseg_mail      = known.mail
        if (!next.aseg_cuit && known.cuit)           next.aseg_cuit      = known.cuit
      }
      return next
    })
  }

  // Auto-completar Médico Seleccionado
  const handleMedicoSelect = (nombre) => {
    const med = medicos.find(m => m.nombre === nombre)
    if (med) {
      setFicha(f => ({
        ...f,
        vm_dr: med.nombre,
        vm_domicilio: med.direccion,
        vm_telefono: med.telefono,
        vm_mail: med.mail,
        vm_medico_id: med.id
      }))
    } else {
      set('vm_dr', nombre)
    }
  }

  // Auto-completar Mediadora Seleccionada
  const handleMediacionSelect = (nombre) => {
    const med = mediadoras.find(m => m.nombre === nombre)
    if (med) {
      setFicha(f => ({
        ...f,
        mediacion_nombre: med.nombre,
        mediacion_id: med.id
      }))
    } else {
      set('mediacion_nombre', nombre)
    }
  }

  const abrirNuevo = () => { setFicha(blank()); setEditing(true); setView('ficha') }
  const abrirExistente = (s) => { setFicha({ ...s }); setEditing(false); setView('ficha') }
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
      if (clean.monto_presupuesto != null) {
        const n = Number(clean.monto_presupuesto)
        clean.monto_presupuesto = Number.isFinite(n) ? n : null
      }
      const saved = await saveSiniestro(clean)

      try {
        await syncAseguradora(clean.aseguradora, {
          telefono:  clean.aseg_telefono,
          domicilio: clean.aseg_domicilio,
          contacto:  clean.aseg_contacto,
          mail:      clean.aseg_mail,
          cuit:      clean.aseg_cuit,
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
          {ed ? (
            <>
              <button className="sin-btn ghost" onClick={cancelarEdicion} disabled={saving}>Cancelar</button>
              <button className="sin-btn primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <button className="sin-btn primary" onClick={entrarEdicion}>Editar</button>
          )}
        </div>
      </div>

      {!ed && <div className="sin-readbar">Modo lectura · tocá <strong>Editar</strong> para modificar los datos</div>}
      {guardado && (
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <button className="sin-btn pdf" onClick={() => imprimirCaratula(ficha)}>⬇ Carátula PDF</button>
          <button className="sin-btn pdf" onClick={() => imprimirFormulario(ficha, docCats)}>⬇ Formulario PDF</button>
        </div>
      )}

      {/* Identificación */}
      <Section title="Identificación">
        <Txt label="Nº de siniestro" value={ficha.nro_siniestro} onChange={(v) => set('nro_siniestro', v)} editing={ed} />
        <Txt label="Compañía" value={ficha.compania} onChange={(v) => set('compania', v)} editing={ed} />
      </Section>

      {/* Requirente */}
      <Section title="Requirente (cliente)">
        <Txt label="Nombre" wide value={ficha.req_nombre} onChange={(v) => set('req_nombre', v)} editing={ed} />
        <Txt label="DNI" value={ficha.req_dni} onChange={(v) => set('req_dni', v)} editing={ed} />
        <Txt label="Teléfono" value={ficha.req_telefono} onChange={(v) => set('req_telefono', v)} editing={ed} />
        
        {/* Calidad de Tercero (Selector Dropdown) */}
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

      {/* Detalle del Hecho */}
      <Section title="Detalle del Hecho">
        <Txt label="Fecha del hecho" type="date" value={ficha.fecha_hecho} onChange={(v) => set('fecha_hecho', v)} editing={ed} />
        <Txt label="Hora del hecho" type="time" value={ficha.hora_hecho} onChange={(v) => set('hora_hecho', v)} editing={ed} />
        <Txt label="Lugar del hecho" wide value={ficha.lugar} onChange={(v) => set('lugar', v)} editing={ed} />
        
        {/* Espacio reservado para Croquis */}
        <div className="sin-field wide">
          <span>Croquis del Hecho</span>
          <div className="sin-croquis-box">
            <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>[ Espacio reservado para Croquis del Accidente ]</span>
          </div>
        </div>
      </Section>

      {/* Datos del Seguro */}
      <Section title="Datos del Seguro">
        <div className="sin-row-merged wide">
          <label className="sin-field" style={{ flex: 2 }}>
            <span>Aseguradora</span>
            {ed ? (
              <>
                <input list="sin-aseg-list" value={ficha.aseguradora ?? ''} placeholder="Compañía de seguros..."
                  onChange={(e) => setAseguradora(e.target.value)} />
                <datalist id="sin-aseg-list">
                  {aseguradoras.map((a) => <option key={a.id} value={a.nombre} />)}
                </datalist>
              </>
            ) : <div className="sin-ro">{ficha.aseguradora || '—'}</div>}
          </label>
          <div style={{ flex: 1 }}>
            <Txt label="CUIT" value={ficha.aseg_cuit} onChange={(v) => set('aseg_cuit', v)} editing={ed} />
          </div>
        </div>

        <Bool label="¿Denuncia administrativa?" value={ficha.denuncia_admin} onChange={(v) => set('denuncia_admin', v)} editing={ed} />
        <Txt label="Tel. aseguradora" value={ficha.aseg_telefono} onChange={(v) => set('aseg_telefono', v)} editing={ed} />
        <Txt label="Contacto aseguradora" value={ficha.aseg_contacto} onChange={(v) => set('aseg_contacto', v)} editing={ed} />
        <Txt label="Domicilio aseguradora" wide value={ficha.aseg_domicilio} onChange={(v) => set('aseg_domicilio', v)} editing={ed} />
        <Txt label="Mail aseguradora" value={ficha.aseg_mail} onChange={(v) => set('aseg_mail', v)} editing={ed} />

        {/* Check Derivado dentro de la misma sección de Seguro */}
        <div className="sin-field wide" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
          <Bool label="¿Derivado?" value={ficha.derivado} onChange={(v) => set('derivado', v)} editing={ed} />
        </div>

        {/* Campos de Derivado si está tildado */}
        {ficha.derivado && (
          <div className="sin-derivado-block wide">
            <Txt label="Estudio Liquidador" value={ficha.derivado_estudio} onChange={(v) => set('derivado_estudio', v)} editing={ed} />
            <Txt label="Responsable" value={ficha.derivado_responsable} onChange={(v) => set('derivado_responsable', v)} editing={ed} />
            <Txt label="Teléfono" value={ficha.derivado_telefono} onChange={(v) => set('derivado_telefono', v)} editing={ed} />
            <Txt label="Mail" value={ficha.derivado_mail} onChange={(v) => set('derivado_mail', v)} editing={ed} />
          </div>
        )}
      </Section>

      {/* Lesiones */}
      <Section title="Lesiones">
        <Bool label="¿Hubo Lesiones?" value={ficha.lesiones} onChange={(v) => {
          set('lesiones', v)
          if (!v) set('comprobantes_medicos', false) // Reset automático si se destilda
        }} editing={ed} />
        
        {/* Renderizado condicional: solo habilitado si hubo lesiones */}
        {ficha.lesiones && (
          <Bool label="¿Adjunta certificados médicos?" value={ficha.comprobantes_medicos} onChange={(v) => set('comprobantes_medicos', v)} editing={ed} />
        )}

        <Area label="Detalles de Lesiones" value={ficha.lesiones_detalle} onChange={(v) => set('lesiones_detalle', v)} editing={ed} />
      </Section>

      {/* Requerido */}
      <Section title="Requerido (contraparte)">
        <Txt label="Nombre" wide value={ficha.rdo_nombre} onChange={(v) => set('rdo_nombre', v)} editing={ed} />
        <Txt label="Vehículo" value={ficha.rdo_vehiculo} onChange={(v) => set('rdo_vehiculo', v)} editing={ed} />
        <Txt label="Dominio" value={ficha.rdo_dominio} onChange={(v) => set('rdo_dominio', v)} editing={ed} />
        <Txt key="rdo_dni" label="DNI" value={ficha.rdo_dni} onChange={(v) => set('rdo_dni', v)} editing={ed} />
        <Txt label="Póliza" value={ficha.rdo_poliza} onChange={(v) => set('rdo_poliza', v)} editing={ed} />
        <Txt label="Teléfono" value={ficha.rdo_telefono} onChange={(v) => set('rdo_telefono', v)} editing={ed} />
        <Txt label="Domicilio" wide value={ficha.rdo_domicilio} onChange={(v) => set('rdo_domicilio', v)} editing={ed} />
        <Area label="Daños" value={ficha.danos_detalle} onChange={(v) => set('danos_detalle', v)} editing={ed} />
      </Section>

      {/* Mediación */}
      <Section title="Mediación">
        <Bool label="¿Mediación?" value={ficha.mediacion} onChange={(v) => set('mediacion', v)} editing={ed} />
        
        {ficha.mediacion && (
          <>
            <Txt label="Fecha de Mediación" type="date" value={ficha.mediacion_fecha} onChange={(v) => set('mediacion_fecha', v)} editing={ed} />
            
            <label className="sin-field">
              <span>Nombre de la Mediadora</span>
              {ed ? (
                <>
                  <input 
                    list="sin-mediadoras-list" 
                    value={ficha.mediacion_nombre ?? ''} 
                    placeholder="Buscá o cargá mediadora..."
                    onChange={(e) => handleMediacionSelect(e.target.value)} 
                  />
                  <datalist id="sin-mediadoras-list">
                    {mediadoras.map((m) => <option key={m.id} value={m.nombre} />)}
                  </datalist>
                </>
              ) : <div className="sin-ro">{ficha.mediacion_nombre || '—'}</div>}
            </label>
          </>
        )}
      </Section>

      {/* Vista médica */}
      <Section title="Vista médica">
        <Bool label="¿Vista médica?" value={ficha.vista_medica} onChange={(v) => set('vista_medica', v)} editing={ed} />
        
        {ficha.vista_medica && (
          <>
            <Txt label="Fecha Vista" type="date" value={ficha.vm_fecha} onChange={(v) => set('vm_fecha', v)} editing={ed} />
            
            <label className="sin-field">
              <span>Dr. / Especialista (Búsqueda)</span>
              {ed ? (
                <>
                  <input 
                    list="sin-medicos-list" 
                    value={ficha.vm_dr ?? ''} 
                    placeholder="Escribí para buscar médico..."
                    onChange={(e) => handleMedicoSelect(e.target.value)} 
                  />
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

      {/* Presupuesto (Ex Cierre) */}
      <Section title="Presupuesto">
        {ed ? (
          <label className="sin-field">
            <span>Monto del presupuesto (Reclamar)</span>
            <input 
              type="number" 
              step="0.01" 
              value={ficha.monto_presupuesto ?? ''} 
              onChange={(e) => set('monto_presupuesto', e.target.value)} 
              placeholder="Ingrese el estimado a reclamar..."
            />
          </label>
        ) : (
          <label className="sin-field">
            <span>Monto del presupuesto (Reclamar)</span>
            <div className="sin-ro">{montoFmt(ficha.monto_presupuesto)}</div>
          </label>
        )}
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

// ── Estilos (Adiciones para Croquis, Desplegables y Blocks Dinámicos) ──
function Style() {
  return (
    <style>{`
    .sin-wrap {
      --g:#c9a24b; --g-dim:#a9853a;
      --panel:#24201a; --input:#322d23; --input-b:#4a4234;
      --txt:#f0ece2; --muted:#a49a88; --ro:#e6e1d6;
      --line:#39332a; --danger:#c9603f;
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
    .sin-del { background:none; border:none; color:var(--danger); font-size:.68rem; cursor:pointer; font-family:inherit; }
    .sin-del:hover { text-decoration:underline; }
    .sin-empty { color:var(--muted); padding:2.5rem 0; text-align:center; }

    /* Ficha */
    .sin-ficha-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem;
      position:sticky; top:0; background:rgba(26,23,18,.96); backdrop-filter:blur(4px); padding:.6rem 0; z-index:5; }
    .sin-ficha-title { text-align:center; display:flex; flex-direction:column; gap:.15rem; }
    .sin-ficha-title .sub { font-size:.75rem; color:var(--muted); }
    .sin-ficha-actions { display:flex; gap:.5rem; }
    .sin-readbar { font-size:.72rem; color:var(--muted); background:var(--panel); border:1px solid var(--line);
      border-radius:8px; padding:.5rem .8rem; margin-bottom:1.25rem; text-align:center; }
    .sin-readbar strong { color:var(--g); font-weight:600; }

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
    .sin-select { cursor: pointer; color-scheme: dark; }

    /* Estructuras Extras */
    .sin-row-merged { display: flex; gap: 1rem; align-items: flex-end; }
    .sin-croquis-box { border: 1px dashed var(--input-b); background: rgba(0,0,0,0.15); border-radius: 8px; padding: 2rem; text-align: center; margin-top: 0.2rem; }
    .sin-derivado-block { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; background: rgba(201,162,75,0.03); border: 1px solid var(--line); border-radius: 8px; padding: 0.8rem; margin-top: 0.5rem; }

    /* Valor en modo lectura */
    .sin-ro { color:var(--ro); font-size:.9rem; padding:.5rem .1rem; min-height:1.2rem;
      border-bottom:1px solid var(--line); }
    .sin-ro.multi { white-space:pre-wrap; line-height:1.5; }

    .sin-sino { display:inline-flex; border:1px solid var(--input-b); border-radius:8px; overflow:hidden; width:fit-content; }
    .sin-sino button { background:var(--input); border:none; color:var(--muted); padding:.45rem 1.1rem; cursor:pointer; font-family:inherit; font-size:.82rem; }
    .sin-sino button.on { background:var(--g); color:#1c1811; font-weight:600; }

    /* Documentación */
    .sin-doc-note { color:var(--muted); font-size:.82rem; }
    .sin-docs { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.8rem; }
    .sin-slot { border:1px dashed var(--input-b); border-radius:10px; padding:.7rem .8rem; background:var(--input); transition:border-color .15s; }
    .sin-slot.filled { border-style:solid; border-color:rgba(120,180,120,.55); background:rgba(120,180,120,.06); }
    .sin-slot-head { display:flex; align-items:center; gap:.45rem; margin-bottom:.5rem; }
    .sin-slot-head .dot { width:9px; height:9px; border-radius:50%; background:var(--input-b); }
    .sin-slot.filled .sin-slot-head .dot { background:#6db36d; }
    .sin-slot-head .lbl { font-size:.8rem; color:var(--txt); }
    .sin-slot-file { display:flex; align-items:center; justify-content:space-between; gap:.4rem; margin-bottom:.35rem; }
    .sin-slot-file .link { background:none; border:none; color:var(--g); font-size:.72rem; cursor:pointer;
      font-family:inherit; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:135px; }
    .sin-slot-file .link:hover { text-decoration:underline; }
    .sin-slot-file .x { background:none; border:none; color:var(--danger); cursor:pointer; font-size:.72rem; }
    .sin-slot-up { display:inline-block; font-size:.74rem; color:var(--muted); cursor:pointer; padding:.25rem 0; }
    .sin-slot-up:hover { color:var(--g); }

    @media (max-width:640px) { .sin-grid-fields { grid-template-columns:1fr; } .sin-derivado-block { grid-template-columns: 1fr; } }
    `}</style>
  )
}
