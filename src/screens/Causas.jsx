// ── CAUSAS.JSX (CON FIX PARA EL BUILD) ────────────────────────
import { useState } from 'react'
import { saveCausa, deleteCausa } from '../lib/store.js'
import { uid, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

// --- COMPONENTE 1: LA LISTA DE CAUSAS ---
export function Causas({ store }) {
  const { causas, registros } = store
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  
  const [caratula, setCaratula] = useState('')
  const [portal, setPortal] = useState('PJN')
  const [nroExpediente, setNroExpediente] = useState('')
  const [juzgado, setJuzgado] = useState('')
  const [estado, setEstado] = useState('activa')

  const filteredCausas = causas.filter(c => 
    c.caratula.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.nro_expediente?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const openModal = (id = null) => {
    setEditId(id)
    if (id) {
      const c = causas.find(x => x.id === id)
      setCaratula(c.caratula); setPortal(c.portal); setNroExpediente(c.nro_expediente || '')
      setJuzgado(c.juzgado || ''); setEstado(c.estado || 'activa')
    } else {
      setCaratula(''); setPortal('PJN'); setNroExpediente(''); setJuzgado(''); setEstado('activa')
    }
    setModal(true)
  }

  const handleSave = async () => {
    if (!caratula.trim()) return alert('La carátula es obligatoria')
    const obj = { id: editId || uid(), caratula: caratula.trim(), portal, nro_expediente: nroExpediente, juzgado, estado, fecha_creacion: new Date().toISOString() }
    await saveCausa(obj)
    setModal(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Causas <small>GESTIÓN DE EXPEDIENTES</small></div>
        <button className="btn btn-primary" onClick={() => openModal()}>＋ Nueva Causa</button>
      </div>

      <div className="search-container" style={{marginBottom:'1rem'}}>
        <input type="text" className="form-control" placeholder="🔍 Buscar causa..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="causas-list">
        {filteredCausas.map(c => (
          <div key={c.id} className="causa-card" style={{background:'white', padding:'1rem', borderRadius:'8px', border:'1px solid #eee', marginBottom:'.5rem'}}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
                <span className={`badge ${c.portal}`}>{c.portal}</span>
                <small>{c.nro_expediente}</small>
            </div>
            <div style={{fontWeight:'bold', margin:'.5rem 0'}}>{c.caratula}</div>
            <div className="causa-actions">
                <button className="btn btn-ghost btn-xs" onClick={() => openModal(c.id)}>✏</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={editId ? 'Editar Causa' : 'Nueva Causa'} onClose={() => setModal(false)}>
          <div className="form-group"><label>Carátula</label><input className="form-control" value={caratula} onChange={e => setCaratula(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
        </Modal>
      )}
    </div>
  )
}

// --- COMPONENTE 2: EL DETALLE DE LA CAUSA (LO QUE FALTABA) ---
export function CausaDetail({ store, causaId }) {
  const { causas, registros } = store
  const causa = causas.find(c => c.id === causaId)
  const misRegistros = registros.filter(r => r.causa === causaId).reverse()

  if (!causa) return <div className="p-4">Causa no encontrada</div>

  return (
    <div className="causa-detail">
      <div className="detail-header" style={{marginBottom:'1.5rem'}}>
        <h2>{causa.caratula}</h2>
        <div style={{display:'flex', gap:'1rem', color:'#666'}}>
            <span><strong>Exp:</strong> {causa.nro_expediente}</span>
            <span><strong>Portal:</strong> {causa.portal}</span>
        </div>
      </div>

      <div className="timeline">
        <h4>Historial de Novedades</h4>
        {misRegistros.length === 0 && <p>No hay registros para esta causa.</p>}
        {misRegistros.map(r => (
          <div key={r.id} className="timeline-item" style={{padding:'1rem', borderLeft:'2px solid #ddd', marginBottom:'1rem', marginLeft:'1rem'}}>
            <div style={{fontSize:'.8rem', color:'#888'}}>{fmtF(r.fecha)}</div>
            <div style={{fontWeight:'500'}}>{r.novedad}</div>
            {r.estrategia && <div style={{fontSize:'.9rem', color:'#555', fontStyle:'italic'}}>💡 {r.estrategia}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
