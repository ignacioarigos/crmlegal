import { useState } from 'react'
import { saveCausa, deleteCausa } from '../lib/store.js'
import { uid, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

// --- COMPONENTE PRINCIPAL: CAUSAS ---
// Añadimos 'onSelect' (o como se llame en tu App.jsx la función para navegar)
export function Causas({ store, setPage }) { 
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

  const openModal = (e, id = null) => {
    e.stopPropagation(); // Evita que al tocar "Editar" se abra el detalle
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
        <button className="btn btn-primary" onClick={(e) => openModal(e)}>＋ Nueva Causa</button>
      </div>

      <div className="search-container" style={{marginBottom:'1.5rem'}}>
        <input 
          type="text" 
          className="form-control" 
          placeholder="🔍 Buscar causa o expediente..." 
          value={busqueda} 
          onChange={e => setBusqueda(e.target.value)} 
        />
      </div>

      <div className="causas-list" style={{display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))'}}>
        {filteredCausas.map(c => (
          <div 
            key={c.id} 
            className="causa-card" 
            onClick={() => setPage('causa-detail', c.id)} // <--- AQUÍ CAMBIA LA PANTALLA
            style={{
              background:'white', 
              padding:'1.2rem', 
              borderRadius:'10px', 
              border:'1px solid #eee', 
              boxShadow:'0 2px 5px rgba(0,0,0,0.05)',
              cursor: 'pointer', // Para que se note que es clickable
              transition: 'transform 0.1s'
            }}
          >
            <div style={{display:'flex', justifyBetween:'space-between', marginBottom:'.5rem', alignItems:'center'}}>
                <span className={`badge ${c.portal}`} style={{fontSize:'.65rem', padding:'2px 8px', borderRadius:'4px', background:'#f0f0f0', fontWeight:'bold'}}>{c.portal}</span>
                <small style={{color:'#888', fontFamily:'monospace', marginLeft:'auto'}}>{c.nro_expediente}</small>
            </div>
            
            <div style={{fontWeight:'bold', color:'var(--primary)', fontSize:'1.1rem', marginBottom:'.4rem'}}>{c.caratula}</div>
            <div style={{fontSize:'.85rem', color:'#666', marginBottom:'1.2rem'}}>🏛 {c.juzgado || 'Sin juzgado'}</div>
            
            <div className="causa-footer" style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #f9f9f9', paddingTop:'.8rem'}}>
                <span style={{fontSize:'.75rem', color:'var(--primary)'}}>Ver historial →</span>
                <button 
                  className="btn btn-ghost btn-xs" 
                  onClick={(e) => openModal(e, c.id)} // Usamos 'e' para el stopPropagation
                >
                  ✏ Editar
                </button>
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
          <div style={{display:'flex', justifyContent:'flex-end', gap:'.6rem', marginTop:'1rem'}}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// --- COMPONENTE SECUNDARIO: DETALLE ---
export function CausaDetail({ store, causaId, setPage }) {
  const { causas, registros } = store
  const causa = causas.find(c => c.id === causaId)
  const misRegistros = registros.filter(r => r.causa === causaId).reverse()

  if (!causa) return (
    <div style={{padding:'2rem'}}>
      <button className="btn btn-ghost" onClick={() => setPage('causas')}>← Volver</button>
      <p>Causa no encontrada.</p>
    </div>
  )

  return (
    <div className="causa-detail" style={{padding:'1rem', maxWidth:'800px', margin:'0 auto'}}>
      <button className="btn btn-ghost" onClick={() => setPage('causas')} style={{marginBottom:'1rem'}}>← Volver a la lista</button>
      
      <div style={{background:'white', padding:'1.5rem', borderRadius:'10px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', marginBottom:'2rem'}}>
        <h2 style={{margin:'0 0 .5rem 0', color:'var(--primary)'}}>{causa.caratula}</h2>
        <div style={{display:'flex', gap:'1.5rem', color:'#666', fontSize:'.9rem'}}>
            <span><strong>Expediente:</strong> {causa.nro_expediente}</span>
            <span><strong>Portal:</strong> {causa.portal}</span>
            <span><strong>Juzgado:</strong> {causa.juzgado}</span>
        </div>
      </div>
      
      <h4 style={{borderBottom:'2px solid #eee', paddingBottom:'.5rem'}}>Historial de movimientos ({misRegistros.length})</h4>
      <div className="timeline" style={{marginTop:'1.5rem'}}>
        {misRegistros.map(r => (
          <div key={r.id} style={{
            padding:'1rem', 
            borderLeft:'3px solid var(--primary)', 
            marginBottom:'1.2rem', 
            background:'white', 
            marginLeft:'1rem',
            borderRadius:'0 8px 8px 0',
            boxShadow:'2px 2px 5px rgba(0,0,0,0.02)'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'.5rem'}}>
                <small style={{fontWeight:'bold', color:'#888'}}>{fmtF(r.fecha)}</small>
                <span style={{fontSize:'.7rem', color:'#bbb'}}>{r.portal}</span>
            </div>
            <div style={{fontSize:'1rem', lineHeight:'1.4'}}>{r.novedad}</div>
            {r.estrategia && (
                <div style={{marginTop:'.8rem', padding:'.5rem', background:'var(--cream)', borderRadius:'4px', fontSize:'.9rem', color:'#555', borderLeft:'2px solid #d4a843'}}>
                    <strong>Estrategia:</strong> {r.estrategia}
                </div>
            )}
          </div>
        ))}
        {misRegistros.length === 0 && (
            <div style={{textAlign:'center', padding:'3rem', color:'#999'}}>
                <p>No hay movimientos registrados para esta causa aún.</p>
            </div>
        )}
      </div>
    </div>
  )
}

export default Causas;
