// ── TAREAS ────────────────────────────────────────────────────
import { useState } from 'react'
import { saveTarea, deleteTarea, patchTarea } from '../lib/store.js'
import { uid, dateFmt, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

// ── Helpers de fecha (locales, sin desfase UTC) ──
const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Días entre hoy y el vencimiento (negativo = vencida)
const diasHasta = (venc) => {
  if (!venc) return null
  const [y, m, d] = venc.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const [hy, hm, hd] = hoyISO().split('-').map(Number)
  const hoy = new Date(hy, hm - 1, hd)
  return Math.round((target - hoy) / 86400000)
}

// Estado de vencimiento: 'vencida' | 'hoy' | 'proxima' (<=3 días) | null
const estadoVenc = (t) => {
  const d = diasHasta(t.vencimiento)
  if (d === null) return null
  if (d < 0) return 'vencida'
  if (d === 0) return 'hoy'
  if (d <= 3) return 'proxima'
  return 'futura'
}

const labelVenc = (t) => {
  const d = diasHasta(t.vencimiento)
  if (d === null) return null
  if (d < -1) return `VENCIDA · hace ${-d} días`
  if (d === -1) return 'VENCIDA · ayer'
  if (d === 0) return '⚠ VENCE HOY'
  if (d === 1) return 'Vence mañana'
  return `Vence en ${d} días`
}

export function Tareas({ store }) {
  const { tareas, causas } = store
  const [tab, setTab] = useState('activas')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [causaId, setCausaId] = useState('')
  const [crit, setCrit] = useState('normal')
  const [venc, setVenc] = useState('')
  const [estado, setEstado] = useState('no-iniciada')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  // --- ESTADOS PARA AUTOCOMPLETE ---
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSug, setMostrarSug] = useState(false)

  const getCNombre = (id) => { const c = causas.find(x=>x.id===id); return c?(c.caratula.length>35?c.caratula.substring(0,35)+'…':c.caratula):'' }

  // Filtrado de causas en tiempo real
  const causasFiltradas = busqueda.trim() !== ''
    ? causas.filter(c => c.caratula.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 10)
    : []

  const openModal = (id = null) => {
    setEditId(id)
    if (id) {
      const t = tareas.find(x=>x.id===id)
      setTitulo(t.titulo||''); setCausaId(t.causa||''); setCrit(t.criticidad||'normal')
      setVenc(t.vencimiento||''); setEstado(t.estado==='completada'?'en-curso':t.estado||'no-iniciada'); setNotas(t.notas||'')
      const causaExistente = causas.find(c => c.id === t.causa)
      setBusqueda(causaExistente ? causaExistente.caratula : '')
    } else {
      setTitulo(''); setCausaId(''); setCrit('normal'); setVenc(''); setEstado('no-iniciada'); setNotas('')
      setBusqueda('')
    }
    setMostrarSug(false)
    setModal(true)
  }

  const handleSave = async () => {
    if (!titulo.trim()) return alert('Ingrese un título.')
    setSaving(true)
    const existing = tareas.find(x=>x.id===editId)
    const obj = { id: editId||uid(), titulo: titulo.trim(), causa: causaId||null, criticidad: venc?'urgente':crit, vencimiento: venc||null, estado, notas: notas.trim()||null, fecha: existing?.fecha||new Date().toISOString() }
    await saveTarea(obj)
    setSaving(false); setModal(false)
  }

  const cycleEstado = async (t) => {
    const o = ['no-iniciada','en-curso','completada']
    const next = o[(o.indexOf(t.estado||'no-iniciada')+1)%3]
    await patchTarea(t.id, { estado: next })
  }

  const cycleCrit = async (t) => {
    const o = ['baja','normal','alta','urgente']
    const next = o[(o.indexOf(t.criticidad||'normal')+1)%4]
    await patchTarea(t.id, { criticidad: next })
  }

  // ── Ordenamiento y agrupación ──
  const co = { urgente:0, alta:1, normal:2, baja:3 }
  const byVenc = (a,b) => { if(!a.vencimiento&&!b.vencimiento)return 0; if(!a.vencimiento)return 1; if(!b.vencimiento)return -1; return a.vencimiento.localeCompare(b.vencimiento) }
  const srt = arr => [...arr].sort((a,b)=>byVenc(a,b)||((co[a.criticidad]||2)-(co[b.criticidad]||2)))

  const activos    = tareas.filter(t=>t.estado!=='completada')
  const archivados = [...tareas.filter(t=>t.estado==='completada')].reverse()

  const vencidas   = srt(activos.filter(t=>estadoVenc(t)==='vencida'))
  const hoy        = srt(activos.filter(t=>estadoVenc(t)==='hoy'))
  const resto      = activos.filter(t=>!['vencida','hoy'].includes(estadoVenc(t)))

  const sections = [
    { key:'vencidas',  label: '🔥 Vencidas',     items: vencidas, cls:'sec-vencida' },
    { key:'hoy',       label: '📅 Vencen hoy',   items: hoy,      cls:'sec-hoy' },
    { key:'urgentes',  label: '🔴 Urgentes',     items: srt(resto.filter(t=>t.criticidad==='urgente')), cls:'' },
    { key:'encurso',   label: '🔄 En curso',     items: srt(resto.filter(t=>t.criticidad!=='urgente'&&t.estado==='en-curso')), cls:'' },
    { key:'noinic',    label: '⬜ No iniciadas', items: srt(resto.filter(t=>t.criticidad!=='urgente'&&t.estado==='no-iniciada')), cls:'' },
  ]

  // ── Impresión ──
  const handlePrint = () => {
    const critMap = { urgente:'🔴 URGENTE', alta:'🟠 ALTA', normal:'🟢 NORMAL', baja:'⚪ BAJA' }
    const estadoMap = { 'no-iniciada':'No iniciada', 'en-curso':'En curso' }
    const secColors = { 'sec-vencida':'#fbe4e4', 'sec-hoy':'#fdf3dc', '':'#f0ebe0' }

    const rows = sections.flatMap(s => {
      if (!s.items.length) return []
      return [
        `<tr><td colspan="5" style="background:${secColors[s.cls]};font-weight:700;font-size:.75rem;padding:.4rem .7rem;letter-spacing:.06em;text-transform:uppercase;color:#555">${s.label}</td></tr>`,
        ...s.items.map(t => {
          const ev = estadoVenc(t)
          const vencColor = ev==='vencida' ? '#c0392b' : ev==='hoy' ? '#b8860b' : t.vencimiento ? '#555' : '#999'
          return `
          <tr>
            <td style="font-weight:600;font-size:.85rem">${t.titulo}</td>
            <td style="font-size:.75rem;color:#666">${t.causa ? getCNombre(t.causa) : '—'}</td>
            <td style="font-size:.75rem;font-weight:700">${critMap[t.criticidad]||'NORMAL'}</td>
            <td style="font-size:.75rem">${estadoMap[t.estado]||t.estado}</td>
            <td style="font-size:.75rem;color:${vencColor};font-weight:${t.vencimiento?'700':'400'}">${t.vencimiento?`${fmtF(t.vencimiento)}${ev==='vencida'?' ⚠':''}${ev==='hoy'?' (HOY)':''}`:'—'}</td>
          </tr>
          ${t.notas?`<tr><td colspan="5" style="font-size:.72rem;color:#888;font-style:italic;padding:.1rem .7rem .4rem">↳ ${t.notas}</td></tr>`:''}
        `})
      ]
    })

    const html = `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Tareas Activas — I|A Gestión Legal</title>
      <style>
        body { font-family: 'IBM Plex Sans', Arial, sans-serif; padding: 2rem; color: #111; font-size: 14px; }
        h1 { font-family: Georgia, serif; font-size: 1.5rem; margin-bottom: .2rem; }
        .sub { font-size: .75rem; color: #888; margin-bottom: 1.5rem; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #0f0e0c; color: #d4a843; text-align: left; padding: .5rem .7rem; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; }
        td { padding: .45rem .7rem; border-bottom: 1px solid #e5e0d8; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>
      <h1>I|A — Tareas Activas</h1>
      <div class="sub">Generado el ${new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase()} · Total: ${activos.length} tareas${vencidas.length?` · ⚠ ${vencidas.length} VENCIDAS`:''}${hoy.length?` · ${hoy.length} VENCEN HOY`:''}</div>
      <table>
        <thead><tr><th>Tarea</th><th>Causa</th><th>Criticidad</th><th>Estado</th><th>Vencimiento</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      </body></html>
    `
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  // ── Card de tarea ──
  const taskCard = (t) => {
    const critMap = { urgente:'🔴 URGENTE', alta:'🟠 ALTA', normal:'🟢 NORMAL', baja:'⚪ BAJA' }
    const estadoMap = { 'no-iniciada':'⬜ No Inic.', 'en-curso':'🔄 En Curso' }
    const ev = estadoVenc(t)
    const lv = labelVenc(t)
    return (
      <div key={t.id} className={`tcard ${ev||''} crit-border-${t.criticidad||'normal'}`}>
        {lv && <div className={`tcard-venc-badge venc-${ev}`}>{lv} · {fmtF(t.vencimiento)}</div>}
        <div className="tcard-title">{t.titulo}</div>
        <div className="tcard-meta">
          {t.causa && <span className="tag">{getCNombre(t.causa)}</span>}
          {t.notas && <span className="tcard-notas">{t.notas.substring(0,80)}{t.notas.length>80?'…':''}</span>}
        </div>
        <div className="tcard-footer">
          <button className={`crit-btn crit-${t.criticidad||'normal'}`} onClick={()=>cycleCrit(t)}>{critMap[t.criticidad]||'NORMAL'}</button>
          <button className={`status-btn status-${t.estado||'no-iniciada'}`} onClick={()=>cycleEstado(t)}>{estadoMap[t.estado]||'No Inic.'}</button>
          <span className="tcard-spacer" />
          <button className="btn btn-ghost btn-xs" onClick={()=>openModal(t.id)}>✏</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar?'))deleteTarea(t.id)}}>🗑</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Tareas <small>GESTIÓN DE PENDIENTES</small></div>
        <div style={{display:'flex',gap:'.5rem'}}>
          <button className="btn btn-ghost" onClick={handlePrint}>🖨 Imprimir</button>
          <button className="btn btn-primary" onClick={()=>openModal()}>＋ Nueva</button>
        </div>
      </div>

      {/* ── Resumen de alertas ── */}
      {tab === 'activas' && (vencidas.length > 0 || hoy.length > 0) && (
        <div className="tareas-alertbar">
          {vencidas.length > 0 && <span className="alert-chip chip-vencida">🔥 {vencidas.length} vencida{vencidas.length>1?'s':''}</span>}
          {hoy.length > 0 && <span className="alert-chip chip-hoy">📅 {hoy.length} vence{hoy.length>1?'n':''} hoy</span>}
          <span className="alert-chip chip-total">{activos.length} pendientes en total</span>
        </div>
      )}

      <div className="tabs">
        <div className={`tab ${tab==='activas'?'active':''}`} onClick={()=>setTab('activas')}>Activas / En Curso</div>
        <div className={`tab ${tab==='archivo'?'active':''}`} onClick={()=>setTab('archivo')}>Archivo</div>
      </div>

      {tab === 'activas' && (
        <div>
          {activos.length === 0 && <div className="empty-state"><div className="icon">🎉</div><p>¡Sin tareas pendientes!</p></div>}
          {sections.map(s => s.items.length > 0 && (
            <div key={s.key}>
              <div className={`task-section-label ${s.cls}`}>{s.label} <span className="sec-count">({s.items.length})</span></div>
              <div className="tcard-grid">
                {s.items.map(taskCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'archivo' && (
        <div className="task-list">
          {archivados.length === 0 && <div className="empty-state"><div className="icon">📦</div><p>Archivo vacío</p></div>}
          {archivados.map(t => (
            <div key={t.id} className="archivo-strip">
              <span>✅</span>
              <div style={{flex:1}}><div className="task-title">{t.titulo}</div><div style={{fontSize:'.7rem',color:'var(--muted)',marginTop:'.15rem'}}>{t.causa?getCNombre(t.causa)+' · ':''}Completada</div></div>
              <button className="btn btn-ghost btn-xs" onClick={()=>patchTarea(t.id,{estado:'en-curso'})}>↩</button>
              <button className="btn btn-ghost btn-xs" onClick={()=>openModal(t.id)}>✏</button>
              <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar?'))deleteTarea(t.id)}}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editId?'Editar Tarea':'Nueva Tarea'} onClose={()=>setModal(false)}>
          <div className="form-row"><div className="form-group" style={{flex:2}}><label>Título *</label><input className="form-control" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Descripción de la tarea" /></div></div>

          <div className="form-row">
            {/* --- CAMPO CAUSA CON AUTOCOMPLETE --- */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Causa</label>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Escriba para buscar..."
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setMostrarSug(true)
                  if (e.target.value === '') setCausaId('')
                }}
                onFocus={() => setMostrarSug(true)}
              />

              {mostrarSug && busqueda.length > 0 && (
                <div className="autocomplete-list">
                  {causasFiltradas.length > 0 ? (
                    causasFiltradas.map(c => (
                      <div
                        key={c.id}
                        className="autocomplete-item"
                        onClick={() => {
                          setCausaId(c.id)
                          setBusqueda(c.caratula)
                          setMostrarSug(false)
                        }}
                      >
                        {c.caratula}
                      </div>
                    ))
                  ) : (
                    <div className="autocomplete-item no-res">Sin coincidencias</div>
                  )}
                </div>
              )}
              {causaId && <div style={{fontSize:'.7rem', color:'var(--primary)', marginTop:'2px'}}>✓ Seleccionada</div>}
            </div>

            <div className="form-group"><label>Criticidad</label><select className="form-control" value={crit} onChange={e=>setCrit(e.target.value)}><option value="urgente">🔴 Urgente</option><option value="alta">🟠 Alta</option><option value="normal">🟢 Normal</option><option value="baja">⚪ Baja</option></select></div>
          </div>

          <div className="form-row">
            <div className="form-group"><label>Vencimiento</label><input type="date" className="form-control" value={venc} onChange={e=>{setVenc(e.target.value);if(e.target.value)setCrit('urgente')}} /></div>
            <div className="form-group"><label>Estado</label><select className="form-control" value={estado} onChange={e=>setEstado(e.target.value)}><option value="no-iniciada">⬜ No Iniciada</option><option value="en-curso">🔄 En Curso</option></select></div>
          </div>
          <div className="form-group" style={{marginBottom:'1rem'}}><label>Notas</label><textarea className="form-control" rows="2" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Detalles..." /></div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          </div>
        </Modal>
      )}

      {/* --- ESTILOS LOCALES: CARDS, ALERTAS Y AUTOCOMPLETE --- */}
      <style>{`
        /* ── Barra de alertas ── */
        .tareas-alertbar {
          display: flex;
          gap: .5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .alert-chip {
          font-size: .72rem;
          font-weight: 700;
          letter-spacing: .04em;
          padding: .35rem .8rem;
          border-radius: 999px;
          border: 1px solid transparent;
        }
        .chip-vencida {
          background: rgba(224, 82, 82, .12);
          border-color: rgba(224, 82, 82, .5);
          color: #e05252;
        }
        .chip-hoy {
          background: rgba(212, 168, 67, .12);
          border-color: rgba(212, 168, 67, .5);
          color: #d4a843;
        }
        .chip-total {
          background: transparent;
          border-color: rgba(255,255,255,.12);
          color: var(--muted, #999);
          font-weight: 500;
        }

        /* ── Etiquetas de sección ── */
        .task-section-label.sec-vencida { color: #e05252; }
        .task-section-label.sec-hoy { color: #d4a843; }
        .sec-count { opacity: .55; font-weight: 400; }

        /* ── Grilla de cards ── */
        .tcard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: .7rem;
          margin-bottom: 1.4rem;
        }
        @media (max-width: 640px) {
          .tcard-grid { grid-template-columns: 1fr; }
        }

        /* ── Card ── */
        .tcard {
          background: var(--card, rgba(255,255,255,.03));
          border: 1px solid rgba(255,255,255,.09);
          border-left-width: 3px;
          border-radius: 8px;
          padding: .8rem .9rem .7rem;
          display: flex;
          flex-direction: column;
          gap: .45rem;
          transition: border-color .15s, transform .1s;
        }
        .tcard:hover { transform: translateY(-1px); }

        /* Borde izquierdo según criticidad (base) */
        .tcard.crit-border-urgente { border-left-color: #e05252; }
        .tcard.crit-border-alta    { border-left-color: #e8923a; }
        .tcard.crit-border-normal  { border-left-color: #6fae6f; }
        .tcard.crit-border-baja    { border-left-color: #888; }

        /* Estados de vencimiento pisan la criticidad */
        .tcard.vencida {
          border-color: rgba(224, 82, 82, .55);
          border-left-color: #e05252;
          background: linear-gradient(rgba(224,82,82,.07), rgba(224,82,82,.03));
        }
        .tcard.hoy {
          border-color: rgba(212, 168, 67, .55);
          border-left-color: #d4a843;
          background: linear-gradient(rgba(212,168,67,.08), rgba(212,168,67,.03));
        }
        .tcard.proxima { border-left-color: #d4a843; }

        /* ── Badge de vencimiento ── */
        .tcard-venc-badge {
          font-size: .68rem;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
          align-self: flex-start;
          padding: .18rem .55rem;
          border-radius: 4px;
        }
        .venc-vencida { background: rgba(224,82,82,.18); color: #ff7b7b; }
        .venc-hoy     { background: rgba(212,168,67,.2);  color: #ecc35e; animation: pulseHoy 1.6s ease-in-out infinite; }
        .venc-proxima { background: rgba(212,168,67,.1);  color: #c9a94f; }
        .venc-futura  { background: rgba(255,255,255,.06); color: var(--muted, #999); }

        @keyframes pulseHoy {
          0%, 100% { opacity: 1; }
          50% { opacity: .55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .venc-hoy { animation: none; }
        }

        .tcard-title {
          font-weight: 600;
          font-size: .9rem;
          line-height: 1.3;
        }
        .tcard-meta {
          display: flex;
          flex-direction: column;
          gap: .25rem;
          font-size: .72rem;
          color: var(--muted, #999);
        }
        .tcard-notas { font-style: italic; opacity: .85; }
        .tcard-footer {
          display: flex;
          align-items: center;
          gap: .4rem;
          margin-top: auto;
          padding-top: .3rem;
          border-top: 1px solid rgba(255,255,255,.06);
        }
        .tcard-spacer { flex: 1; }

        /* ── Autocomplete (sin cambios) ── */
        .autocomplete-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-height: 180px;
          overflow-y: auto;
        }
        .autocomplete-item {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 0.85rem;
          border-bottom: 1px solid #f0f0f0;
          color: #333;
        }
        .autocomplete-item:hover {
          background: #f0f7ff;
          color: #000;
        }
        .autocomplete-item.no-res {
          color: #999;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

export default Tareas
