// ── CAUSAS ────────────────────────────────────────────────────
import { useState } from 'react'
import { saveCausa, deleteCausa, saveCobro, saveGasto } from '../lib/store.js'
import { uid, dateFmt, fmtF, FUEROS_CIVILES } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

export function Causas({ navigate, store }) {
  const { causas, gastos } = store
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [caratula, setCaratula] = useState('')
  const [tribunal, setTribunal] = useState('PJN')
  const [fuero, setFuero] = useState('')
  const [juzgado, setJuzgado] = useState('')
  const [nro, setNro] = useState('')
  const [cliente, setCliente] = useState('')
  const [estadoCausa, setEstadoCausa] = useState('activa')
  const [presupuesto, setPresupuesto] = useState('')
  const [moneda, setMoneda] = useState('ARS')

  const esCivil = FUEROS_CIVILES.includes(fuero)

  const openModal = (id=null) => {
    setEditId(id)
    if (id) {
      const c = causas.find(x=>x.id===id)
      setCaratula(c.caratula||''); setTribunal(c.tribunal||'PJN'); setFuero(c.fuero||'')
      setJuzgado(c.juzgado||''); setNro(c.nro||''); setCliente(c.cliente||'')
      setEstadoCausa(c.estado||'activa'); setPresupuesto(c.presupuesto||''); setMoneda(c.moneda||'ARS')
    } else {
      setCaratula(''); setTribunal('PJN'); setFuero(''); setJuzgado(''); setNro(''); setCliente(''); setEstadoCausa('activa'); setPresupuesto(''); setMoneda('ARS')
    }
    setModal(true)
  }

  const handleSave = async () => {
    if (!caratula.trim()) return alert('Ingrese la carátula.')
    const obj = { id: editId||uid(), caratula: caratula.trim(), tribunal, fuero, juzgado: juzgado.trim()||null, nro: nro.trim()||null, cliente: cliente.trim()||null, estado: estadoCausa, presupuesto: esCivil&&presupuesto?parseFloat(presupuesto):null, moneda: esCivil?moneda:null, fecha: new Date().toISOString() }
    await saveCausa(obj)
    setModal(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Causas <small>REGISTRO DE EXPEDIENTES</small></div>
        <button className="btn btn-primary" onClick={()=>openModal()}>＋ Nueva</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'.55rem'}}>
        {causas.length===0&&<div className="empty-state"><div className="icon">📁</div><p>Sin causas. Creá la primera.</p></div>}
        {[...causas].reverse().map(c=>{
          const tot = gastos.filter(g=>g.causa===c.id).reduce((s,g)=>s+(g.total||0),0)
          const saldo = c.presupuesto?c.presupuesto-tot:null
          return (
            <div key={c.id} className="causa-card" onClick={()=>navigate('causa-detail',c.id)}>
              <div className="causa-tribunal-badge">{c.tribunal}</div>
              <div className="causa-info">
                <div className="causa-caratula">{c.caratula}</div>
                <div className="causa-sub">{[c.fuero,c.juzgado,c.nro,c.cliente?'👤 '+c.cliente:''].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{display:'flex',gap:'.4rem',alignItems:'center'}} onClick={e=>e.stopPropagation()}>
                {saldo!=null&&<span style={{fontSize:'.72rem',fontFamily:'IBM Plex Mono,monospace',color:saldo<0?'var(--urgent)':'var(--ok)',fontWeight:700}}>{saldo<0?'⚠ -$'+(tot-c.presupuesto).toLocaleString('es-AR'):'💰 $'+saldo.toLocaleString('es-AR')}</span>}
                <button className="btn btn-ghost btn-xs" onClick={()=>openModal(c.id)}>✏</button>
                <span style={{color:'var(--muted)',fontSize:'1.1rem',cursor:'pointer'}} onClick={()=>navigate('causa-detail',c.id)}>›</span>
              </div>
            </div>
          )
        })}
      </div>
      {modal&&(
        <Modal title={editId?'Editar Causa':'Nueva Causa'} onClose={()=>setModal(false)}>
          <div className="form-group" style={{marginBottom:'.9rem'}}><label>Carátula *</label><input className="form-control" value={caratula} onChange={e=>setCaratula(e.target.value)} placeholder="Ej: GARCÍA, Juan c/ EMPRESA S.A. s/ Despido" /></div>
          <div className="form-row">
            <div className="form-group"><label>Tribunal</label><select className="form-control" value={tribunal} onChange={e=>setTribunal(e.target.value)}><option value="PJN">PJN</option><option value="SCBA">SCBA</option><option value="EJE">EJE (CABA)</option></select></div>
            <div className="form-group"><label>Fuero</label><select className="form-control" value={fuero} onChange={e=>setFuero(e.target.value)}><option value="">— Seleccione —</option><option>Laboral</option><option>Civil</option><option>Civil y Comercial</option><option>Comercial</option><option>Penal</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Juzgado</label><input className="form-control" value={juzgado} onChange={e=>setJuzgado(e.target.value)} placeholder="Ej: Juzgado Nro. 5" /></div>
            <div className="form-group"><label>Nº Expediente</label><input className="form-control" value={nro} onChange={e=>setNro(e.target.value)} placeholder="Ej: 12345/2024" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Cliente</label><input className="form-control" value={cliente} onChange={e=>setCliente(e.target.value)} /></div>
            <div className="form-group"><label>Estado</label><select className="form-control" value={estadoCausa} onChange={e=>setEstadoCausa(e.target.value)}><option value="activa">Activa</option><option value="archivada">Archivada</option></select></div>
          </div>
          {esCivil&&(
            <div className="form-row">
              <div className="form-group"><label>Presupuesto</label><input type="number" className="form-control" value={presupuesto} onChange={e=>setPresupuesto(e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label>Moneda</label><select className="form-control" value={moneda} onChange={e=>setMoneda(e.target.value)}><option value="ARS">ARS $</option><option value="USD">USD U$S</option></select></div>
            </div>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem',marginTop:'.9rem'}}>
            <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── CAUSA DETAIL ──────────────────────────────────────────────
export function CausaDetail({ id, navigate, store }) {
  const { causas, registros, gastos, cobros, tramites } = store
  const c = causas.find(x=>x.id===id)
  const [cobroModal, setCobroModal] = useState(false)
  const [gastoModal, setGastoModal] = useState(false)
  const [cbFecha, setCbFecha] = useState(dateFmt(new Date()))
  const [cbMonto, setCbMonto] = useState('')
  const [cbConcepto, setCbConcepto] = useState('')
  const [cbMoneda, setCbMoneda] = useState('ARS')
  const [gTramiteId, setGTramiteId] = useState('')
  const [gCant, setGCant] = useState(1)
  const [gPrecio, setGPrecio] = useState('')
  const [gFecha, setGFecha] = useState(dateFmt(new Date()))

  if (!c) return <div className="empty-state"><p>Causa no encontrada</p></div>

  const movs    = registros.filter(r=>r.causa===id)
  const gList   = gastos.filter(g=>g.causa===id)
  const cbList  = cobros.filter(cb=>cb.causa===id)
  const tot     = gList.reduce((s,g)=>s+(g.total||0),0)
  const totARS  = cbList.filter(cb=>!cb.moneda||cb.moneda==='ARS').reduce((s,cb)=>s+(cb.monto||0),0)
  const totUSD  = cbList.filter(cb=>cb.moneda==='USD').reduce((s,cb)=>s+(cb.monto||0),0)

  let pptoBar = null
  if (c.presupuesto) {
    const saldo = c.presupuesto - tot
    const pct = Math.min((tot/c.presupuesto)*100, 100)
    const cls = pct>=100?'deficit':pct>=80?'warn':''
    pptoBar = (
      <div className="ppto-bar-wrap">
        <div className="ppto-bar-track"><div className={`ppto-bar-fill ${cls}`} style={{width:pct.toFixed(1)+'%'}} /></div>
        <div className="ppto-bar-labels">
          <span>Gastado: ${tot.toLocaleString('es-AR')} ({pct.toFixed(0)}%)</span>
          <span>{saldo<0?'⚠ Excedido: $'+(tot-c.presupuesto).toLocaleString('es-AR'):'Saldo: $'+saldo.toLocaleString('es-AR')} de {c.moneda} ${c.presupuesto.toLocaleString('es-AR')}</span>
        </div>
      </div>
    )
  }

  const handleSaveCobro = async () => {
    if (!cbFecha||!cbMonto||!cbConcepto) return alert('Completá todos los campos.')
    await saveCobro({ id: uid(), fecha: cbFecha, monto: parseFloat(cbMonto), concepto: cbConcepto, moneda: cbMoneda, causa: id })
    setCobroModal(false); setCbMonto(''); setCbConcepto(''); setCbMoneda('ARS')
  }

  const handleSaveGasto = async () => {
    if (!gTramiteId) return alert('Seleccione un trámite.')
    const tr = tramites.find(t=>t.id===gTramiteId)
    await saveGasto({ id: uid(), causa: id, tramite_id: gTramiteId, tramite_nombre: tr?tr.nombre:'—', cant: parseFloat(gCant)||1, precio_u: parseFloat(gPrecio)||0, total: (parseFloat(gCant)||1)*(parseFloat(gPrecio)||0), fecha: gFecha||null })
    setGastoModal(false); setGTramiteId(''); setGCant(1); setGPrecio('')
  }

  return (
    <div>
      <div style={{marginBottom:'.9rem'}}><button className="btn btn-ghost btn-sm" onClick={()=>navigate('causas')}>← Volver</button></div>

      <div className="causa-detail-header">
        <div style={{flex:1}}>
          <div className="causa-detail-title">{c.caratula}</div>
          <div className="causa-detail-sub">{[c.tribunal,c.fuero,c.juzgado,c.nro].filter(Boolean).join(' · ')}</div>
          {c.cliente&&<div className="causa-detail-sub">👤 {c.cliente}</div>}
          {pptoBar}
        </div>
        <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--paper)',borderColor:'#555'}} onClick={()=>setGastoModal(true)}>+ Gasto</button>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--paper)',borderColor:'#555'}} onClick={()=>setCobroModal(true)}>+ Cobro</button>
          <button className="btn btn-danger btn-sm" onClick={()=>{if(confirm('¿Eliminar causa y todos sus datos?')){deleteCausa(id);navigate('causas')}}}>Eliminar</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'.9rem',marginBottom:'1.3rem'}}>
        {[
          {v:movs.length,   l:'Movimientos', c:'var(--gold)'},
          {v:'$'+tot.toLocaleString('es-AR'), l:'Total gastos', c:'var(--gold)'},
          {v:'$'+totARS.toLocaleString('es-AR'), l:'Cobrado ARS', c:'var(--ok)'},
          {v:'U$S '+totUSD.toLocaleString('es-AR'), l:'Cobrado USD', c:'var(--usd)', bg:'var(--usd-bg)'},
        ].map((s,i)=>(
          <div key={i} className="card" style={{textAlign:'center',background:s.bg||undefined}}>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:'1.4rem',fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase'}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Movimientos */}
      <h3 style={{fontFamily:'Playfair Display,serif',fontSize:'1.05rem',marginBottom:'.65rem'}}>Movimientos</h3>
      {movs.length===0?<p style={{color:'var(--muted)',fontSize:'.83rem',marginBottom:'1.3rem'}}>Sin movimientos.</p>:(
        <div style={{display:'flex',flexDirection:'column',gap:'.45rem',marginBottom:'1.3rem'}}>
          {movs.map(r=>(
            <div key={r.id} className="registro-entry">
              <div className="registro-portal">{r.portal}</div>
              <div className="registro-body">
                <div className="registro-novedad">{r.novedad}</div>
                {r.estrategia&&<div className="registro-estrategia">💡 {r.estrategia}</div>}
                <div className="registro-meta"><span>{fmtF(r.fecha)}</span>{r.tiene_vencimiento&&r.vencimiento_texto&&<span className="registro-venc">{r.vencimiento_texto}</span>}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gastos */}
      <h3 style={{fontFamily:'Playfair Display,serif',fontSize:'1.05rem',marginBottom:'.65rem'}}>Gastos</h3>
      {gList.length===0?<p style={{color:'var(--muted)',fontSize:'.83rem',marginBottom:'1.3rem'}}>Sin gastos.</p>:(
        <div className="table-wrapper" style={{marginBottom:'1.3rem'}}>
          <table>
            <thead><tr><th>Trámite</th><th>Cant.</th><th>P.U.</th><th>Total</th><th>Fecha</th></tr></thead>
            <tbody>{gList.map(g=><tr key={g.id}><td>{g.tramite_nombre}</td><td className="num">{g.cant}</td><td className="num">${(g.precio_u||0).toLocaleString('es-AR')}</td><td className="num" style={{fontWeight:700}}>${(g.total||0).toLocaleString('es-AR')}</td><td>{g.fecha?fmtF(g.fecha):'-'}</td></tr>)}</tbody>
            <tfoot><tr className="tfoot-row"><td colSpan="3" style={{padding:'.6rem .9rem'}}>TOTAL</td><td className="num" style={{padding:'.6rem .9rem',fontWeight:700}}>${tot.toLocaleString('es-AR')}</td><td></td></tr></tfoot>
          </table>
        </div>
      )}

      {/* Cobros */}
      <h3 style={{fontFamily:'Playfair Display,serif',fontSize:'1.05rem',marginBottom:'.65rem'}}>Cobros</h3>
      {cbList.length===0?<p style={{color:'var(--muted)',fontSize:'.83rem'}}>Sin cobros.</p>:(
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Concepto</th><th>Moneda</th><th>Fecha</th><th>Monto</th></tr></thead>
            <tbody>{[...cbList].reverse().map(cb=>{const isUSD=cb.moneda==='USD';return(
              <tr key={cb.id}><td>{cb.concepto}</td><td><span className={`cobro-moneda-badge ${isUSD?'usd':'ars'}`}>{isUSD?'USD':'ARS'}</span></td><td>{fmtF(cb.fecha)}</td><td className="num" style={{fontWeight:700,color:isUSD?'var(--usd)':'var(--ok)'}}>{isUSD?'U$S ':'$'}{(cb.monto||0).toLocaleString('es-AR')}</td></tr>
            )})}</tbody>
          </table>
        </div>
      )}

      {/* Modal cobro */}
      {cobroModal&&(
        <Modal title="Registrar Cobro" onClose={()=>setCobroModal(false)} maxWidth="480px">
          <div className="form-row">
            <div className="form-group"><label>Fecha</label><input type="date" className="form-control" value={cbFecha} onChange={e=>setCbFecha(e.target.value)} /></div>
            <div className="form-group"><label>Moneda</label><div className="moneda-toggle"><button type="button" className={`btn btn-sm ${cbMoneda==='ARS'?'btn-primary':'btn-ghost'}`} onClick={()=>setCbMoneda('ARS')}>$ ARS</button><button type="button" className={`btn btn-sm ${cbMoneda==='USD'?'btn-info':'btn-ghost'}`} style={cbMoneda!=='USD'?{borderColor:'var(--usd)',color:'var(--usd)'}:{}} onClick={()=>setCbMoneda('USD')}>U$S USD</button></div></div>
          </div>
          <div className="form-group" style={{marginBottom:'.9rem'}}><label>{cbMoneda==='USD'?'Monto (U$S)':'Monto ($)'}</label><input type="number" className="form-control" value={cbMonto} onChange={e=>setCbMonto(e.target.value)} /></div>
          <div className="form-group" style={{marginBottom:'1rem'}}><label>Concepto</label><input className="form-control" value={cbConcepto} onChange={e=>setCbConcepto(e.target.value)} placeholder="Ej: Honorarios..." /></div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}><button className="btn btn-ghost" onClick={()=>setCobroModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSaveCobro}>Guardar</button></div>
        </Modal>
      )}

      {/* Modal gasto */}
      {gastoModal&&(
        <Modal title="Registrar Gasto" onClose={()=>setGastoModal(false)} maxWidth="480px">
          <div className="form-row">
            <div className="form-group" style={{flex:2}}><label>Trámite *</label><select className="form-control" value={gTramiteId} onChange={e=>{setGTramiteId(e.target.value);const tr=tramites.find(t=>t.id===e.target.value);if(tr)setGPrecio(tr.precio)}}><option value="">— Seleccione —</option>{tramites.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
            <div className="form-group"><label>Cantidad</label><input type="number" className="form-control" value={gCant} onChange={e=>setGCant(e.target.value)} min="1" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Precio unitario ($)</label><input type="number" className="form-control" value={gPrecio} onChange={e=>setGPrecio(e.target.value)} /></div>
            <div className="form-group"><label>Total</label><input className="form-control" readOnly value={gPrecio&&gCant?'$'+((parseFloat(gCant)||1)*(parseFloat(gPrecio)||0)).toLocaleString('es-AR'):''} style={{background:'var(--cream)',fontWeight:700}} /></div>
          </div>
          <div className="form-row"><div className="form-group"><label>Fecha</label><input type="date" className="form-control" value={gFecha} onChange={e=>setGFecha(e.target.value)} /></div></div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}><button className="btn btn-ghost" onClick={()=>setGastoModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleSaveGasto}>Guardar</button></div>
        </Modal>
      )}
    </div>
  )
}

export default Causas
