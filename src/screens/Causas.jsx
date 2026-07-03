import { useState } from 'react'
import { saveCausa, deleteCausa } from '../lib/store.js'
import { uid, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

// --- COMPONENTE PRINCIPAL: CAUSAS ---
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
    (c.nro_expediente && c.nro_expediente.toLowerCase().includes(busqueda.toLowerCase()))
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
    const obj = { 
      id: editId || uid(), 
      caratula: caratula.trim(), 
      portal, 
      nro_expediente: nroExpediente, 
      juzgado, 
      estado, 
      fecha_creacion: new Date().toISOString() 
    }
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
        <input 
          type="text" 
          className="form-control" 
          placeholder="🔍 Buscar causa o expediente..." 
          value={busqueda} 
          onChange={e => setBusqueda(e.target.value)} 
        />
      </div>

      <div className="causas-list" style={{display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))'}}>
        {filteredCausas.map(c => (
          <div key={c.id} className="causa-card" style={{background:'white', padding:'1rem', borderRadius:'8px', border:'1px solid #eee', boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'.5rem'}}>
                <span className={`badge ${c.portal}`} style={{fontSize:'.7rem', padding:'2px 6px', borderRadius:'4px', background:'#eee'}}>{c.portal}</span>
                <small style={{color:'#888', fontFamily:'monospace'}}>{c.nro_expediente}</small>
            </div>
            <div style={{fontWeight:'bold', color:'var(--primary)', marginBottom:'.5rem'}}>{c.caratula}</div>
            <div style={{fontSize:'.8rem', color:'#666', marginBottom:'1rem'}}>🏛 {c.juzgado}</div>
            <div className="causa-actions" style={{display:'flex', justifyContent:'flex-end', borderTop:'1px solid #f5f5f5', pt:'.5rem'}}>
                <button className="btn btn-ghost btn-xs" onClick={() => openModal(c.id)}>✏ Editar</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={editId ? 'Editar Causa' : 'Nueva Causa'} onClose={() => setModal(false)}>
          <div className="form-group"><label>Carátula *</label><input className="form-control" value={caratula} onChange={e => setCaratula(e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label>Portal</label><select className="form-control" value={portal} onChange={e => setPortal(e.target.value)}><option>PJN</option><option>SCBA</option><option>EJE</option></select></div>
            <div className="form-group"><label>Nro Exp.</label><input className="form-control" value={nroExpediente} onChange={e => setNroExpediente(e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Juzgado</label><input className="form-control" value={juzgado} onChange={e => setJuzgado(e.target.value)} /></div>
          <div style={{display:'flex', justifyContent:'flex-end', gap:'.6rem', mt:'1rem'}}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// --- COMPONENTE SECUNDARIO: DETALLE ---
export function CausaDetail({ store, causaId }) {
  const { causas, registros } = store
  const causa = causas.find(c => c.id === causaId)
  const misRegistros = registros.filter(r => r.causa === causaId).reverse()

  if (!causa) return <div style={{padding:'2rem'}}>Causa no encontrada.</div>

  return (
    <div className="causa-detail" style={{padding:'1rem'}}>
      <h2 style={{margin:'0 0 .5rem 0'}}>{causa.caratula}</h2>
      <p style={{color:'#666', marginBottom:'2rem'}}>Expediente {causa.nro_expediente} — {causa.portal}</p>
      
      <h4>Historial de movimientos</h4>
      <div className="timeline" style={{marginTop:'1rem'}}>
        {misRegistros.map(r => (
          <div key={r.id} style={{padding:'1rem', borderLeft:'2px solid var(--primary)', marginBottom:'1rem', background:'#f9f9f9', marginLeft:'1rem'}}>
            <small style={{display:'block', color:'#888'}}>{fmtF(r.fecha)}</small>
            <div style={{marginTop:'.3rem'}}>{r.novedad}</div>
          </div>
        ))}
        {misRegistros.length === 0 && <p style={{color:'#999'}}>No hay movimientos registrados.</p>}
      </div>
    </div>
  )
}

// IMPORTANTE: Exportación por defecto para que App.jsx no falle
export default Causas;
