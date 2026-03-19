import { useState } from 'react'
import { saveGasto, deleteGasto, updateTramite, deleteTramite, addTramite, resetTramites } from '../lib/store.js'
import { uid, dateFmt, fmtF, TRAMITES_DEFAULT } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

export default function Gastos({ store }) {
  const { gastos, causas, tramites } = store
  const [tab, setTab] = useState('registros')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [causaId, setCausaId] = useState('')
  const [tramiteId, setTramiteId] = useState('')
  const [cant, setCant] = useState(1)
  const [precio, setPrecio] = useState('')
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [filtro, setFiltro] = useState('')
  const [editTr, setEditTr] = useState(null) // {id, nombre, precio}

  const getCNombre = (id) => { const c = causas.find(x=>x.id===id); return c?(c.caratula.length>35?c.caratula.substring(0,35)+'…':c.caratula):'' }
  const total = parseFloat(cant||0) * parseFloat(precio||0)

  const openModal = (id=null, preCausaId=null) => {
    setEditId(id)
    if (id) {
      const g = gastos.find(x=>x.id===id)
      setCausaId(g.causa||''); setTramiteId(g.tramite_id||''); setCant(g.cant||1); setPrecio(g.precio_u||''); setFecha(g.fecha||dateFmt(new Date()))
    } else {
      setCausaId(preCausaId||''); setTramiteId(''); setCant(1); setPrecio(''); setFecha(dateFmt(new Date()))
    }
    setModal(true)
  }

  const handleSave = async () => {
    if (!tramiteId) return alert('Seleccione un trámite.')
    const tr = tramites.find(t=>t.id===tramiteId)
    const obj = { id: editId||uid(), causa: causaId||null, tramite_id: tramiteId, tramite_nombre: tr?tr.nombre:'—', cant: parseFloat(cant)||1, precio_u: parseFloat(precio)||0, total, fecha: fecha||null }
    await saveGasto(obj)
    setModal(false)
  }

  let list = filtro ? gastos.filter(g=>g.causa===filtro) : gastos
  list = [...list].reverse()
  const totFiltrado = list.reduce((s,g)=>s+(g.total||0),0)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Gastos <small>PLANILLA LABORAL</small></div>
        <button className="btn btn-primary" onClick={()=>openModal()}>＋ Registrar</button>
      </div>
      <div className="tabs">
        <div className={`tab ${tab==='registros'?'active':''}`} onClick={()=>setTab('registros')}>Registros</div>
        <div className={`tab ${tab==='tramites'?'active':''}`} onClick={()=>setTab('tramites')}>Aranceles</div>
      </div>

      {tab==='registros'&&(
        <>
          <div style={{marginBottom:'.9rem',display:'flex',gap:'.6rem',alignItems:'center',flexWrap:'wrap'}}>
            <select className="form-control" value={filtro} onChange={e=>setFiltro(e.target.value)} style={{maxWidth:300,flex:1}}>
              <option value="">— Todas las causas —</option>
              {causas.map(c=><option key={c.id} value={c.id}>{c.caratula.substring(0,50)}</option>)}
            </select>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Causa</th><th>Trámite</th><th>Cant.</th><th>P.U.</th><th>Total</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {list.length===0&&<tr><td colSpan="7" style={{textAlign:'center',padding:'1.5rem',color:'var(--muted)'}}>Sin gastos</td></tr>}
                {list.map(g=>(
                  <tr key={g.id}>
                    <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{getCNombre(g.causa)}</td>
                    <td>{g.tramite_nombre}</td>
                    <td className="num">{g.cant}</td>
                    <td className="num">${(g.precio_u||0).toLocaleString('es-AR')}</td>
                    <td className="num" style={{fontWeight:700}}>${(g.total||0).toLocaleString('es-AR')}</td>
                    <td>{g.fecha?fmtF(g.fecha):'-'}</td>
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={()=>openModal(g.id)}>✏</button>
                      <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar?'))deleteGasto(g.id)}}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="tfoot-row"><td colSpan="4" style={{padding:'.6rem .9rem'}}>TOTAL</td><td className="num" style={{padding:'.6rem .9rem',fontWeight:700}}>${totFiltrado.toLocaleString('es-AR')}</td><td colSpan="2"></td></tr></tfoot>
            </table>
          </div>
        </>
      )}

      {tab==='tramites'&&(
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',gap:'.5rem'}}>
            <strong style={{fontFamily:'Playfair Display, serif',fontSize:'1.1rem'}}>Aranceles vigentes</strong>
            <div style={{display:'flex',gap:'.5rem'}}>
              <button className="btn btn-ghost btn-sm" style={{fontSize:'.72rem',color:'var(--muted)'}} onClick={()=>{if(confirm('¿Restaurar aranceles?'))resetTramites()}}>↺ Restaurar</button>
              <button className="btn btn-primary btn-sm" onClick={()=>addTramite({id:'tc'+Date.now().toString(36),nombre:'NUEVO ARANCEL',precio:0,orden:tramites.length})}>＋ Nuevo</button>
            </div>
          </div>
          {tramites.map(t=>(
            <div key={t.id} className="tramite-row">
              {editTr?.id===t.id?(
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flex:1,flexWrap:'wrap'}}>
                  <input className="form-control" value={editTr.nombre} onChange={e=>setEditTr({...editTr,nombre:e.target.value})} style={{flex:2,minWidth:180,fontSize:'.8rem',padding:'.3rem .6rem'}} />
                  <input type="number" className="form-control" value={editTr.precio} onChange={e=>setEditTr({...editTr,precio:parseFloat(e.target.value)||0})} style={{width:100,fontSize:'.8rem',padding:'.3rem .6rem'}} />
                  <button className="btn btn-primary btn-xs" onClick={()=>{updateTramite(t.id,{nombre:editTr.nombre,precio:editTr.precio});setEditTr(null)}}>✓</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setEditTr(null)}>✕</button>
                </div>
              ):(
                <>
                  <span style={{flex:1,minWidth:120,fontSize:'.83rem'}}>{t.nombre}</span>
                  <span className="tramite-price">${(t.precio||0).toLocaleString('es-AR')}</span>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setEditTr({id:t.id,nombre:t.nombre,precio:t.precio})}>✏</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar?'))deleteTramite(t.id)}}>🗑</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {modal&&(
        <Modal title={editId?'Editar Gasto':'Registrar Gasto'} onClose={()=>setModal(false)}>
          <div className="form-row"><div className="form-group"><label>Causa *</label><select className="form-control" value={causaId} onChange={e=>setCausaId(e.target.value)}><option value="">— General —</option>{causas.map(c=><option key={c.id} value={c.id}>{c.caratula.substring(0,50)}</option>)}</select></div></div>
          <div className="form-row">
            <div className="form-group" style={{flex:2}}><label>Trámite *</label><select className="form-control" value={tramiteId} onChange={e=>{setTramiteId(e.target.value);const tr=tramites.find(t=>t.id===e.target.value);if(tr)setPrecio(tr.precio)}}><option value="">— Seleccione —</option>{tramites.map(t=><option key={t.id} value={t.id}>{t.nombre} (${(t.precio||0).toLocaleString('es-AR')})</option>)}</select></div>
            <div className="form-group"><label>Cantidad</label><input type="number" className="form-control" value={cant} onChange={e=>setCant(e.target.value)} min="1" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Precio unitario ($)</label><input type="number" className="form-control" value={precio} onChange={e=>setPrecio(e.target.value)} placeholder="0" /></div>
            <div className="form-group"><label>Total</label><input className="form-control" readOnly value={total?'$'+total.toLocaleString('es-AR'):''} style={{background:'var(--cream)',fontWeight:700}} /></div>
          </div>
          <div className="form-row"><div className="form-group"><label>Fecha</label><input type="date" className="form-control" value={fecha} onChange={e=>setFecha(e.target.value)} /></div></div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
