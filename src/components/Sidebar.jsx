import { useState } from 'react'
import { dateFmt, MESES_CORTOS, MESES } from '../lib/supabase.js'
import { saveEvento } from '../lib/store.js'
import { uid } from '../lib/supabase.js'
import Modal from './Modal.jsx'

const NAVS = [
  { id: 'home',       icon: '⚖️', label: 'Inicio' },
  { id: 'tareas',     icon: '✅', label: 'Tareas',  badge: true },
  { id: 'registro',   icon: '📋', label: 'Registro' },
  { id: 'gastos',     icon: '💰', label: 'Gastos' },
  { id: 'causas',     icon: '📁', label: 'Causas',  badge: true },
  { id: 'cobros',     icon: '💵', label: 'Cobros' },
  { id: 'documentos', icon: '📄', label: 'Documentos' },
]

export default function Sidebar({ screen, open, navigate, store, lastSync, onSync }) {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(dateFmt(today))
  const [eventoModal, setEventoModal] = useState(false)
  const [eventoFecha, setEventoFecha] = useState(dateFmt(today))
  const [eDesc, setEDesc] = useState('')
  const [eHora, setEHora] = useState('09:00')
  const [eTipo, setETipo] = useState('audiencia')
  const [eCausa, setECausa] = useState('')

  const todayStr = dateFmt(today)

  const getDayEvents = (ds) => ({
    tareas:    store.tareas.filter(t => t.vencimiento === ds && t.estado !== 'completada'),
    eventos:   store.eventos.filter(e => e.fecha === ds),
    registros: store.registros.filter(r => r.vencimiento_fecha === ds),
  })

  const calNav = (dir) => {
    let m = calMonth + dir, y = calYear
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setCalMonth(m); setCalYear(y)
  }

  const selectDay = (ds) => { setSelected(ds); setEventoFecha(ds) }

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth, 1)
  const lastDay  = new Date(calYear, calMonth + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const totalDays = lastDay.getDate()
  const prevLast = new Date(calYear, calMonth, 0).getDate()
  const dows = ['L','M','X','J','V','S','D']

  const cells = []
  for (let i = startDow - 1; i >= 0; i--) cells.push({ n: prevLast - i, other: true })
  for (let d = 1; d <= totalDays; d++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const { tareas, eventos, registros } = getDayEvents(ds)
    cells.push({ n: d, ds, today: ds === todayStr, sel: ds === selected, hasEvent: !!eventos.length, hasTask: !!(tareas.length || registros.length) })
  }
  const rem = (startDow + totalDays) % 7 === 0 ? 0 : 7 - ((startDow + totalDays) % 7)
  for (let d = 1; d <= rem; d++) cells.push({ n: d, other: true })

  const selEvents = getDayEvents(selected)
  const allEvents = [
    ...selEvents.eventos.map(e => ({ label: `${e.hora ? e.hora + ' — ' : ''}${e.descripcion}`, cls: 'ev-' + e.tipo })),
    ...selEvents.tareas.map(t => ({ label: `✅ ${t.titulo}`, cls: 'ev-urgente' })),
    ...selEvents.registros.map(r => ({ label: `⏰ ${(r.novedad||'').substring(0,38)}`, cls: 'ev-venc' })),
  ]

  const pendientes = store.tareas.filter(t => t.estado !== 'completada').length

  const lastSyncText = () => {
    if (!lastSync) return 'Última actualización: nunca'
    const diff = Math.floor((new Date() - lastSync) / 1000)
    if (diff < 60) return `Última actualización: hace ${diff}s`
    if (diff < 3600) return `Última actualización: hace ${Math.floor(diff/60)}m`
    return `Última actualización: ${lastSync.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'})}`
  }

  const handleSaveEvento = async () => {
    if (!eDesc) return
    await saveEvento({ id: uid(), descripcion: eDesc, fecha: eventoFecha, hora: eHora, tipo: eTipo, causa: eCausa || null })
    setEventoModal(false); setEDesc('')
  }

  return (
    <nav className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-nav">
        {NAVS.map(n => (
          <div key={n.id} className={`nav-item ${screen === n.id || (screen === 'causa-detail' && n.id === 'causas') ? 'active' : ''}`}
            onClick={() => navigate(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {n.badge && n.id === 'tareas' && <span className="nav-badge">{pendientes}</span>}
            {n.badge && n.id === 'causas' && <span className="nav-badge">{store.causas.length}</span>}
          </div>
        ))}
      </div>

      <div className="sidebar-sync">
        <div className="sidebar-sync-title">Sincronización</div>
        <div className="sidebar-sync-status">{lastSyncText()}</div>
        <button className="sidebar-sync-btn" onClick={onSync}>↻ Sincronizar ahora</button>
      </div>

      <div className="sidebar-cal">
        <div className="cal-header">
          <button className="cal-nav" onClick={() => calNav(-1)}>‹</button>
          <div className="cal-month">{MESES_CORTOS[calMonth]} {calYear}</div>
          <button className="cal-nav" onClick={() => calNav(1)}>›</button>
        </div>
        <div className="cal-grid">
          {dows.map(d => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((c, i) => {
            if (c.other) return <div key={i} className="cal-day other-month">{c.n}</div>
            let cls = 'cal-day'
            if (c.today) cls += ' today'
            else if (c.sel) cls += ' selected'
            if (c.hasEvent) cls += ' has-event'
            else if (c.hasTask) cls += ' has-task'
            return <div key={i} className={cls} onClick={() => selectDay(c.ds)}>{c.n}</div>
          })}
        </div>
        <div className="cal-agenda">
          <div className="cal-agenda-title">
            {selected === todayStr ? 'HOY' : (() => { const d = new Date(selected+'T12:00:00'); return `${d.getDate()} ${MESES_CORTOS[d.getMonth()].toUpperCase()}` })()}
          </div>
          {allEvents.length === 0
            ? <div className="cal-event-empty">Sin eventos</div>
            : allEvents.map((e, i) => <div key={i} className={`cal-event ${e.cls}`}>{e.label}</div>)
          }
          <div style={{ textAlign: 'center', marginTop: '.4rem' }}>
            <button className="btn btn-ghost btn-xs" style={{ color: '#6a6058', borderColor: '#3a3830', fontSize: '.63rem' }}
              onClick={() => setEventoModal(true)}>+ Agregar</button>
          </div>
        </div>
      </div>

      {eventoModal && (
        <Modal title="Nuevo Evento" onClose={() => setEventoModal(false)}>
          <div className="form-group" style={{ marginBottom: '.9rem' }}>
            <label>Descripción *</label>
            <input className="form-control" value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Ej: Audiencia, reunión..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" className="form-control" value={eventoFecha} onChange={e => setEventoFecha(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Hora</label>
              <input type="time" className="form-control" value={eHora} onChange={e => setEHora(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <select className="form-control" value={eTipo} onChange={e => setETipo(e.target.value)}>
                <option value="audiencia">⚖️ Audiencia</option>
                <option value="vencimiento">⏰ Vencimiento</option>
                <option value="reunion">🤝 Reunión</option>
                <option value="otro">📌 Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label>Causa</label>
              <select className="form-control" value={eCausa} onChange={e => setECausa(e.target.value)}>
                <option value="">— General —</option>
                {store.causas.map(c => <option key={c.id} value={c.id}>{c.caratula.substring(0,45)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
            <button className="btn btn-ghost" onClick={() => setEventoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveEvento}>Guardar</button>
          </div>
        </Modal>
      )}
    </nav>
  )
}
