// ── TAREAS ────────────────────────────────────────────────────
import { useState } from 'react'
import { saveTarea, deleteTarea, patchTarea } from '../lib/store.js'
import { uid, dateFmt, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

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

  const getCNombre = (id) => { const c = causas.find(x=>x.id===id); return c?(c.caratula.length>35?c.caratula.substring(0,35)+'…':c.caratula):'' }

  const openModal = (id = null) => {
    setEditId(id)
    if (id) {
      const t = tareas.find(x=>x.id===id)
      setTitulo(t.titulo||''); setCausaId(t.causa||''); setCrit(t.criticidad||'normal')
      setVenc(t.vencimiento||''); setEstado(t.estado==='completada'?'en-curso':t.estado||'no-iniciada'); setNotas(t.notas||'')
    } else {
      setTitulo(''); setCausaId(''); setCrit('normal'); setVenc(''); setEstado('no-iniciada'); setNotas('')
    }
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

  const co = { urgente:0, alta:1, normal:2, baja:3 }
  const byVenc = (a,b) => { if(!a.vencimiento&&!b.vencimiento)return 0; if(!a.vencimiento)return 1; if(!b.vencimiento)return -1; return a.vencimiento.localeCompare(b.vencimiento) }
  const srt = arr => [...arr].sort((a,b)=>(co[a.criticidad]||2)-(co[b.criticidad]||2)||byVenc(a,b))

  const activos   = srt(tareas.filter(t=>t.estado!=='completada'))
  const archivados = [...tareas.filter(t=>t.estado==='completada')].reverse()

  const taskCard = (t) => {
    const critMap = { urgente:'🔴 URGENTE', alta:'🟠 ALTA', normal:'🟢 NORMAL', baja:'⚪ BAJA' }
    const estadoMap = { 'no-iniciada':'⬜ No Inic.', 'en-curso':'🔄 En Curso' }
    return (
      <div key={t.id} className={`task-strip ${t.criticidad||'normal'}`}>
        <div className="task-main">
          <div className="task-title">{t.titulo}</div>
          <div className="task-meta">
            {t.causa && <span className="tag">{getCNombre(t.causa)}</span>}
            <span>{fmtF(t.fecha)}</span>
            {t.vencimiento && <span className="task-vencimiento">Vence: {fmtF(t.vencimiento)}</span>}
            {t.notas && <span className="task-notas">{t.notas.substring(0,55)}{t.notas.length>55?'…':''}</span>}
          </div>
        </div>
        <div className="task-actions">
          <button className={`crit-btn crit-${t.criticidad||'normal'}`} onClick={()=>cycleCrit(t)}>{critMap[t.criticidad]||'NORMAL'}</button>
          <button className={`status-btn status-${t.estado||'no-iniciada'}`} onClick={()=>cycleEstado(t)}>{estadoMap[t.estado]||'No Inic.'}</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>openModal(t.id)}>✏</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar?'))deleteTarea(t.id)}}>🗑</button>
        </div>
      </div>
    )
  }

  const sections = [
    { label: '🔴 Urgentes',    items: activos.filter(t=>t.criticidad==='urgente') },
    { label: '🔄 En curso',    items: activos.filter(t=>t.criticidad!=='urgente'&&t.estado==='en-curso') },
    { label: '⬜ No iniciadas', items: activos.filter(t=>t.criticidad!=='urgente'&&t.estado==='no-iniciada') },
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Tareas <small>GESTIÓN DE PENDIENTES</small></div>
        <button className="btn btn-primary" onClick={()=>openModal()}>＋ Nueva</button>
      </div>
      <div className="tabs">
        <div className={`tab ${tab==='activas'?'active':''}`} onClick={()=>setTab('activas')}>Activas / En Curso</div>
        <div className={`tab ${tab==='archivo'?'active':''}`} onClick={()=>setTab('archivo')}>Archivo</div>
      </div>
      {tab === 'activas' && (
        <div className="task-list">
          {activos.length === 0 && <div className="empty-state"><div className="icon">🎉</div><p>¡Sin tareas pendientes!</p></div>}
          {sections.map(s => s.items.length > 0 && (
            <div key={s.label}>
              <div className="task-section-label">{s.label}</div>
              {s.items.map(taskCard)}
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
            <div className="form-group"><label>Causa</label><select className="form-control" value={causaId} onChange={e=>setCausaId(e.target.value)}><option value="">— General —</option>{causas.map(c=><option key={c.id} value={c.id}>{c.caratula.substring(0,45)}</option>)}</select></div>
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
    </div>
  )
}

export default Tareas
