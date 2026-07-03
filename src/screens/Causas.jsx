// ── CAUSAS ────────────────────────────────────────────────────
import { useState } from 'react'
import { saveCausa, deleteCausa } from '../lib/store.js'
import { uid, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

export function Causas({ store }) {
  const { causas, registros } = store
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  
  // Estados del formulario
  const [caratula, setCaratula] = useState('')
  const [portal, setPortal] = useState('PJN')
  const [nroExpediente, setNroExpediente] = useState('')
  const [juzgado, setJuzgado] = useState('')
  const [estado, setEstado] = useState('activa')

  // --- LÓGICA DE FILTRADO Y STATS ---
  const filteredCausas = causas.filter(c => 
    c.caratula.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.nro_expediente?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const stats = {
    total: causas.length,
    pjn: causas.filter(c => c.portal === 'PJN').length,
    scba: causas.filter(c => c.portal === 'SCBA').length,
    eje: causas.filter(c => c.portal === 'EJE').length
  }

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

  // Función para obtener el último movimiento de esta causa
  const getUltimoMov = (id) => {
    const movs = registros.filter(r => r.causa === id)
    if (movs.length === 0) return null
    return movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Causas <small>GESTIÓN DE EXPEDIENTES</small></div>
        <button className="btn btn-primary" onClick={() => openModal()}>＋ Nueva Causa</button>
      </div>

      {/* --- PANEL DE ESTADÍSTICAS --- */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card pjn">
          <span className="stat-value">{stats.pjn}</span>
          <span className="stat-label">PJN</span>
        </div>
        <div className="stat-card scba">
          <span className="stat-value">{stats.scba}</span>
          <span className="stat-label">SCBA</span>
        </div>
        <div className="stat-card eje">
          <span className="stat-value">{stats.eje}</span>
          <span className="stat-label">EJE</span>
        </div>
      </div>

      {/* --- BUSCADOR --- */}
      <div className="search-container">
        <input 
          type="text" 
          className="form-control search-input" 
          placeholder="🔍 Buscar por carátula o expediente..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* --- LISTA DE CAUSAS --- */}
      <div className="causas-list">
        {filteredCausas.length === 0 && (
          <div className="empty-state">No se encontraron causas</div>
        )}
        
        {filteredCausas.map(c => {
          const ultimoMov = getUltimoMov(c.id)
          return (
            <div key={c.id} className={`causa-card ${c.estado}`}>
              <div className="causa-header">
                <span className={`portal-badge ${c.portal}`}>{c.portal}</span>
                <span className="exp-nro">{c.nro_expediente || 'S/N'}</span>
              </div>
              
              <div className="causa-body">
                <div className="causa-title">{c.caratula}</div>
                <div className="causa-info">🏛 {c.juzgado || 'Juzgado no definido'}</div>
                
                {ultimoMov && (
                  <div className="causa-last-mov">
                    <strong>Último mov:</strong> {fmtF(ultimoMov.fecha)} - {ultimoMov.novedad.substring(0, 60)}...
                  </div>
                )}
              </div>

              <div className="causa-actions">
                <button className="btn btn-ghost btn-xs" onClick={() => openModal(c.id)}>✏ Editar</button>
                <button className="btn btn-ghost btn-xs text-danger" onClick={() => {if(confirm('¿Eliminar?')) deleteCausa(c.id)}}>🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* --- MODAL --- */}
      {modal && (
        <Modal title={editId ? 'Editar Causa' : 'Nueva Causa'} onClose={() => setModal(false)}>
          <div className="form-group">
            <label>Carátula / Nombre del Caso *</label>
            <input className="form-control" value={caratula} onChange={e => setCaratula(e.target.value)} placeholder="Ej: Perez c/ Seguro" />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Portal</label>
              <select className="form-control" value={portal} onChange={e => setPortal(e.target.value)}>
                <option>PJN</option>
                <option>SCBA</option>
                <option>EJE</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nro Expediente</label>
              <input className="form-control" value={nroExpediente} onChange={e => setNroExpediente(e.target.value)} placeholder="12345/2023" />
            </div>
          </div>

          <div className="form-group">
            <label>Juzgado / Tribunal</label>
            <input className="form-control" value={juzgado} onChange={e => setJuzgado(e.target.value)} placeholder="Ej: Civil 45" />
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select className="form-control" value={estado} onChange={e => setEstado(e.target.value)}>
              <option value="activa">🟢 Activa</option>
              <option value="suspendida">🟡 Suspendida</option>
              <option value="archivada">⚪ Archivada</option>
            </select>
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap:'.6rem', marginTop:'1rem'}}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar Causa</button>
          </div>
        </Modal>
      )}

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stat-card {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #333;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
        }
        .stat-card.pjn { border-left-color: #2980b9; }
        .stat-card.scba { border-left-color: #27ae60; }
        .stat-card.eje { border-left-color: #f39c12; }
        .stat-value { font-size: 1.5rem; font-weight: bold; }
        .stat-label { font-size: 0.7rem; text-transform: uppercase; color: #666; }

        .search-container { margin-bottom: 1rem; }
        .search-input { padding: 0.8rem; font-size: 1rem; }

        .causas-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }
        .causa-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s;
        }
        .causa-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        
        .causa-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .portal-badge { 
          font-size: 0.65rem; 
          padding: 2px 6px; 
          border-radius: 4px; 
          font-weight: bold; 
          color: white; 
        }
        .portal-badge.PJN { background: #2980b9; }
        .portal-badge.SCBA { background: #27ae60; }
        .portal-badge.EJE { background: #f39c12; }
        
        .exp-nro { font-family: monospace; font-size: 0.8rem; color: #666; }
        .causa-title { font-weight: bold; font-size: 1rem; margin-bottom: 0.25rem; color: #2c3e50; }
        .causa-info { font-size: 0.85rem; color: #7f8c8d; margin-bottom: 0.5rem; }
        .causa-last-mov { 
          font-size: 0.75rem; 
          background: #f8f9fa; 
          padding: 0.5rem; 
          border-radius: 4px; 
          color: #555;
          margin-top: auto;
        }
        .causa-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; border-top: 1px solid #eee; pt: 0.5rem; }
        .text-danger { color: #e74c3c; }
      `}</style>
    </div>
  )
}

export default Causas
