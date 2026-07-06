// ── CAUSAS ────────────────────────────────────────────────────
import { useState } from 'react'
import { saveCausa, deleteCausa, saveCobro, saveGasto, saveTarea, saveRegistro, updateRegistro, deleteRegistro } from '../lib/store.js'
import { uid, dateFmt, fmtF, FUEROS_CIVILES, sumarHabiles, sumarCorridos, fechaLarga } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'
import { imprimirRecibo, nextReciboNro, fmtNro } from '../lib/recibo.js'

// normaliza acentos y mayúsculas para búsqueda por coincidencia
const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const mono  = 'IBM Plex Mono,monospace'
const serif = "'Fraunces','Playfair Display',serif"

// Color de acento por fuero (borde izquierdo de tarjetas y filas)
const FUERO_COLOR = {
  'Penal': 'var(--urgent)',
  'Laboral': 'var(--gold)',
  'Civil': 'var(--ok)',
  'Civil y Comercial': 'var(--ok)',
  'Comercial': 'var(--slate)',
}
const fueroColor = (c) => FUERO_COLOR[c.fuero] || 'rgba(128,128,128,.35)'

export function Causas({ navigate, store }) {
  const { causas, gastos, registros } = store
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

  // Búsqueda + filtros
  const [busqueda, setBusqueda] = useState('')
  const [fTribunal, setFTribunal] = useState('todos')
  const [fEstado, setFEstado] = useState('activas')

  // Vista + orden + agrupación (persistidos)
  const pget = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
  const pset = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
  const [vista, setVista]     = useState(() => pget('ia_causas_vista', 'cards'))
  const [orden, setOrden]     = useState(() => pget('ia_causas_orden', 'actividad'))
  const [agrupar, setAgrupar] = useState(() => pget('ia_causas_agrupar', 'no'))
  const setVistaP   = (v) => { setVista(v);   pset('ia_causas_vista', v) }
  const setOrdenP   = (v) => { setOrden(v);   pset('ia_causas_orden', v) }
  const setAgruparP = (v) => { setAgrupar(v); pset('ia_causas_agrupar', v) }

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

  // Archivar / desarchivar (spread del objeto completo para no pisar campos)
  const toggleArchivo = async (c) => {
    await saveCausa({ ...c, estado: (c.estado === 'archivada' ? 'activa' : 'archivada') })
  }

  // Última actividad y cantidad de movimientos por causa
  const actMap = {}
  const movMap = {}
  for (const r of (registros || [])) {
    if (!r.causa) continue
    movMap[r.causa] = (movMap[r.causa] || 0) + 1
    const f = r.fecha || ''
    if (!actMap[r.causa] || f > actMap[r.causa]) actMap[r.causa] = f
  }
  const actividad = (c) => actMap[c.id] || c.fecha || ''

  // Filtrado: estado → tribunal → texto
  const q = norm(busqueda)
  let lista = [...causas]
  if (fEstado !== 'todas') {
    const target = fEstado === 'archivadas' ? 'archivada' : 'activa'
    lista = lista.filter(c => (c.estado || 'activa') === target)
  }
  if (fTribunal !== 'todos') lista = lista.filter(c => c.tribunal === fTribunal)
  if (q) lista = lista.filter(c => norm([c.caratula, c.cliente, c.nro, c.juzgado, c.fuero].filter(Boolean).join(' ')).includes(q))

  // Ordenamiento
  if (orden === 'alfabetico') {
    lista.sort((a,b)=>(a.caratula||'').localeCompare(b.caratula||'', 'es'))
  } else if (orden === 'cliente') {
    lista.sort((a,b)=>{
      const ca=(a.cliente||'').trim(), cb=(b.cliente||'').trim()
      if(!ca&&!cb) return (a.caratula||'').localeCompare(b.caratula||'', 'es')
      if(!ca) return 1
      if(!cb) return -1
      return ca.localeCompare(cb,'es') || (a.caratula||'').localeCompare(b.caratula||'', 'es')
    })
  } else if (orden === 'recientes') {
    lista.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))
  } else {
    // última actividad (movimiento más reciente; si no hay, fecha de alta)
    lista.sort((a,b)=>actividad(b).localeCompare(actividad(a)))
  }

  // Agrupación
  let grupos = [[null, lista]]
  if (agrupar === 'fuero') {
    const ordenFueros = ['Penal','Laboral','Civil','Civil y Comercial','Comercial']
    const m = new Map()
    for (const c of lista) { const k = c.fuero || 'Sin fuero'; if(!m.has(k)) m.set(k,[]); m.get(k).push(c) }
    const keys = [...m.keys()].sort((a,b)=>{
      const ia = ordenFueros.indexOf(a), ib = ordenFueros.indexOf(b)
      return (ia===-1?99:ia)-(ib===-1?99:ib) || a.localeCompare(b,'es')
    })
    grupos = keys.map(k=>[k, m.get(k)])
  } else if (agrupar === 'tribunal') {
    const ordenTrib = ['PJN','SCBA','EJE']
    const m = new Map()
    for (const c of lista) { const k = c.tribunal || 'Sin tribunal'; if(!m.has(k)) m.set(k,[]); m.get(k).push(c) }
    const keys = [...m.keys()].sort((a,b)=>{
      const ia = ordenTrib.indexOf(a), ib = ordenTrib.indexOf(b)
      return (ia===-1?99:ia)-(ib===-1?99:ib) || a.localeCompare(b,'es')
    })
    grupos = keys.map(k=>[k, m.get(k)])
  }

  const chip = (activo) => `btn btn-sm ${activo ? 'btn-primary' : 'btn-ghost'}`

  const saldoDe = (c) => {
    const tot = gastos.filter(g=>g.causa===c.id).reduce((s,g)=>s+(g.total||0),0)
    return { tot, saldo: c.presupuesto ? c.presupuesto - tot : null }
  }

  const saldoTag = (c) => {
    const { tot, saldo } = saldoDe(c)
    if (saldo == null) return null
    return <span style={{fontSize:'.72rem',fontFamily:mono,color:saldo<0?'var(--urgent)':'var(--ok)',fontWeight:700}}>{saldo<0?'⚠ -$'+(tot-c.presupuesto).toLocaleString('es-AR'):'💰 $'+saldo.toLocaleString('es-AR')}</span>
  }

  const archTag = <span style={{marginLeft:'.5rem',fontSize:'.6rem',fontFamily:mono,color:'var(--muted)',border:'1px solid var(--muted)',borderRadius:4,padding:'0 .35rem',verticalAlign:'middle'}}>ARCHIVADA</span>

  // ── Render de una causa (fila de lista) ──
  const filaDe = (c) => {
    const archivada = (c.estado||'activa')==='archivada'
    const act = actividad(c)
    return (
      <div key={c.id} className="causa-card" style={{borderLeft:`3px solid ${fueroColor(c)}`, ...(archivada?{opacity:.62}:{})}} onClick={()=>navigate('causa-detail',c.id)}>
        <div className="causa-tribunal-badge">{c.tribunal}</div>
        <div className="causa-info">
          <div className="causa-caratula" style={{fontFamily:serif}}>{c.caratula}{archivada&&archTag}</div>
          <div className="causa-sub">{[c.fuero,c.juzgado,c.nro,c.cliente?'👤 '+c.cliente:''].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{display:'flex',gap:'.4rem',alignItems:'center'}} onClick={e=>e.stopPropagation()}>
          {act&&<span style={{fontSize:'.66rem',fontFamily:mono,color:'var(--muted)',whiteSpace:'nowrap'}} title="Última actividad">⏱ {fmtF(act)}</span>}
          {saldoTag(c)}
          <button className="btn btn-ghost btn-xs" title={archivada?'Desarchivar':'Archivar'} onClick={()=>toggleArchivo(c)}>{archivada?'↩':'🗄'}</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>openModal(c.id)}>✏</button>
          <span style={{color:'var(--muted)',fontSize:'1.1rem',cursor:'pointer'}} onClick={()=>navigate('causa-detail',c.id)}>›</span>
        </div>
      </div>
    )
  }

  // ── Render de una causa (tarjeta) ──
  const tarjetaDe = (c) => {
    const archivada = (c.estado||'activa')==='archivada'
    const act = actividad(c)
    const nMovs = movMap[c.id]||0
    return (
      <div key={c.id} className="card causa-grid-card" onClick={()=>navigate('causa-detail',c.id)}
        style={{cursor:'pointer',display:'flex',flexDirection:'column',gap:'.5rem',opacity:archivada?.62:1,borderLeft:`3px solid ${fueroColor(c)}`}}>
        {/* header: tribunal + fuero + última actividad */}
        <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
          <div className="causa-tribunal-badge">{c.tribunal}</div>
          {c.fuero&&<span style={{fontSize:'.62rem',fontFamily:mono,textTransform:'uppercase',letterSpacing:'.08em',color:fueroColor(c),fontWeight:700}}>{c.fuero}</span>}
          {archivada&&archTag}
          <span style={{marginLeft:'auto',fontSize:'.66rem',fontFamily:mono,color:'var(--muted)',whiteSpace:'nowrap'}} title="Última actividad">⏱ {act?fmtF(act):'—'}</span>
        </div>
        {/* carátula */}
        <div style={{fontFamily:serif,fontWeight:700,fontSize:'.96rem',lineHeight:1.34,letterSpacing:'-.01em',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}} title={c.caratula}>
          {c.caratula}
        </div>
        {/* datos */}
        <div style={{fontSize:'.74rem',color:'var(--muted)'}}>
          {[c.juzgado,c.nro].filter(Boolean).join(' · ')||'—'}
        </div>
        {c.cliente&&<div style={{fontSize:'.76rem'}}>👤 {c.cliente}</div>}
        {/* footer */}
        <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginTop:'auto',paddingTop:'.5rem',borderTop:'1px solid rgba(128,128,128,.18)'}} onClick={e=>e.stopPropagation()}>
          <span style={{fontSize:'.68rem',fontFamily:mono,color:'var(--muted)'}}>{nMovs} mov{nMovs===1?'':'s'}.</span>
          {saldoTag(c)}
          <span style={{marginLeft:'auto',display:'flex',gap:'.3rem'}}>
            <button className="btn btn-ghost btn-xs" title={archivada?'Desarchivar':'Archivar'} onClick={()=>toggleArchivo(c)}>{archivada?'↩':'🗄'}</button>
            <button className="btn btn-ghost btn-xs" onClick={()=>openModal(c.id)}>✏</button>
            <button className="btn btn-ghost btn-xs" onClick={()=>navigate('causa-detail',c.id)}>›</button>
          </span>
        </div>
      </div>
    )
  }

  // ── Encabezado de grupo ──
  const headerGrupo = (nombre, cant) => (
    <div style={{display:'flex',alignItems:'center',gap:'.6rem',margin:'1.15rem 0 .6rem'}}>
      <span style={{fontFamily:mono,fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.14em',color:'var(--gold)'}}>{nombre}</span>
      <span style={{fontFamily:mono,fontSize:'.66rem',color:'var(--muted)'}}>({cant})</span>
      <span style={{flex:1,height:1,background:'var(--muted)',opacity:.22}} />
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title" style={{fontFamily:serif}}>Causas <small>REGISTRO DE EXPEDIENTES</small></div>
        <button className="btn btn-primary" onClick={()=>openModal()}>＋ Nueva</button>
      </div>

      {/* Buscador */}
      <div style={{display:'flex',gap:'.6rem',alignItems:'center',flexWrap:'wrap',marginBottom:'.7rem'}}>
        <input className="form-control" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por carátula, cliente, N° de expediente…" style={{flex:1,minWidth:220,maxWidth:440}} />
        {busqueda && <button className="btn btn-ghost btn-sm" onClick={()=>setBusqueda('')}>✕ Limpiar</button>}
        {(q || fTribunal!=='todos' || fEstado!=='activas') && <span style={{fontSize:'.75rem',color:'var(--muted)',fontFamily:mono}}>{lista.length} resultado{lista.length===1?'':'s'}</span>}
      </div>

      {/* Filtros + agrupación + orden + vista */}
      <div style={{display:'flex',gap:'.4rem',alignItems:'center',flexWrap:'wrap',marginBottom:'.9rem'}}>
        {[['todos','Todos'],['PJN','PJN'],['SCBA','SCBA'],['EJE','EJE']].map(([v,l])=>(
          <button key={v} className={chip(fTribunal===v)} onClick={()=>setFTribunal(v)}>{l}</button>
        ))}
        <span style={{width:1,alignSelf:'stretch',minHeight:20,background:'var(--muted)',opacity:.25,margin:'0 .25rem'}} />
        {[['activas','Activas'],['archivadas','Archivadas'],['todas','Todas']].map(([v,l])=>(
          <button key={v} className={chip(fEstado===v)} onClick={()=>setFEstado(v)}>{l}</button>
        ))}
        <span style={{width:1,alignSelf:'stretch',minHeight:20,background:'var(--muted)',opacity:.25,margin:'0 .25rem'}} />
        <label style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em'}}>Agrupar</label>
        {[['no','No'],['fuero','Fuero'],['tribunal','Tribunal']].map(([v,l])=>(
          <button key={v} className={chip(agrupar===v)} onClick={()=>setAgruparP(v)}>{l}</button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:'.4rem',alignItems:'center'}}>
          <label style={{fontSize:'.7rem',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em'}}>Ordenar</label>
          <select className="form-control" value={orden} onChange={e=>setOrdenP(e.target.value)} style={{width:'auto',padding:'.3rem .5rem',fontSize:'.78rem'}}>
            <option value="actividad">Última actividad</option>
            <option value="recientes">Alta más reciente</option>
            <option value="alfabetico">Carátula A–Z</option>
            <option value="cliente">Cliente A–Z</option>
          </select>
          <span style={{width:1,alignSelf:'stretch',minHeight:20,background:'var(--muted)',opacity:.25,margin:'0 .1rem'}} />
          <button className={chip(vista==='lista')} title="Vista lista" onClick={()=>setVistaP('lista')}>☰</button>
          <button className={chip(vista==='cards')} title="Vista tarjetas" onClick={()=>setVistaP('cards')}>▦</button>
        </div>
      </div>

      {lista.length===0&&<div className="empty-state"><div className="icon">📁</div><p>{(q||fTribunal!=='todos'||fEstado!=='activas')?'Sin coincidencias.':'Sin causas. Creá la primera.'}</p></div>}

      {lista.length>0 && grupos.map(([nombre, items])=>(
        <div key={nombre||'__all__'}>
          {nombre && headerGrupo(nombre, items.length)}
          {vista==='lista'
            ? <div style={{display:'flex',flexDirection:'column',gap:'.55rem'}}>{items.map(filaDe)}</div>
            : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'.75rem'}}>{items.map(tarjetaDe)}</div>
          }
        </div>
      ))}

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

  // ── Cobro ──
  const [cobroModal, setCobroModal] = useState(false)
  const [cbFecha, setCbFecha] = useState(dateFmt(new Date()))
  const [cbMonto, setCbMonto] = useState('')
  const [cbConcepto, setCbConcepto] = useState('')
  const [cbMoneda, setCbMoneda] = useState('ARS')

  // ── Gasto ──
  const [gastoModal, setGastoModal] = useState(false)
  const [gTramiteId, setGTramiteId] = useState('')
  const [gCant, setGCant] = useState(1)
  const [gPrecio, setGPrecio] = useState('')
  const [gFecha, setGFecha] = useState(dateFmt(new Date()))
  const [selGastos, setSelGastos] = useState(new Set())

  // ── Nueva Tarea ──
  const [tareaModal, setTareaModal] = useState(false)
  const [tTitulo, setTTitulo] = useState('')
  const [tCrit, setTCrit] = useState('normal')
  const [tVenc, setTVenc] = useState('')
  const [tEstado, setTEstado] = useState('no-iniciada')
  const [tNotas, setTNotas] = useState('')
  const [tSaving, setTSaving] = useState(false)

  const openTareaModal = () => {
    setTTitulo(''); setTCrit('normal'); setTVenc(''); setTEstado('no-iniciada'); setTNotas('')
    setTareaModal(true)
  }

  const handleSaveTarea = async () => {
    if (!tTitulo.trim()) return alert('Ingrese un título.')
    setTSaving(true)
    await saveTarea({ id: uid(), titulo: tTitulo.trim(), causa: id, criticidad: tVenc?'urgente':tCrit, vencimiento: tVenc||null, estado: tEstado, notas: tNotas.trim()||null, fecha: new Date().toISOString() })
    setTSaving(false); setTareaModal(false)
  }

  // ── Movimiento (nuevo + edición) ──
  const [movModal, setMovModal] = useState(false)
  const [movEditId, setMovEditId] = useState(null)
  const [mPortal, setMPortal] = useState('')
  const [mNovedad, setMNovedad] = useState('')
  const [mEstrategia, setMEstrategia] = useState('')
  const [mTieneVenc, setMTieneVenc] = useState(false)
  const [mDias, setMDias] = useState('')
  const [mFechaInicio, setMFechaInicio] = useState(dateFmt(new Date()))
  const [mVencResult, setMVencResult] = useState(null)
  const [mVencTexto, setMVencTexto] = useState('')
  const [mCrearTarea, setMCrearTarea] = useState(false)
  const [mTareaTitulo, setMTareaTitulo] = useState('')
  const [mCalcMsg, setMCalcMsg] = useState('')

  const openMovModal = (regId = null) => {
    setMovEditId(regId)
    if (regId) {
      const r = registros.find(x => x.id === regId)
      setMPortal(r.portal||'')
      setMNovedad(r.novedad||'')
      setMEstrategia(r.estrategia||'')
      setMTieneVenc(r.tiene_vencimiento||false)
      setMVencResult(r.vencimiento_fecha ? { fecha: r.vencimiento_fecha, texto: r.vencimiento_texto||'' } : null)
      setMVencTexto(r.vencimiento_texto||'')
      setMDias(''); setMFechaInicio(dateFmt(new Date())); setMCalcMsg('')
      setMCrearTarea(false); setMTareaTitulo('')
    } else {
      setMPortal(''); setMNovedad(''); setMEstrategia(''); setMTieneVenc(false)
      setMDias(''); setMFechaInicio(dateFmt(new Date())); setMVencResult(null)
      setMVencTexto(''); setMCrearTarea(false); setMTareaTitulo(''); setMCalcMsg('')
    }
    setMovModal(true)
  }

  const calcVencimientoMov = async () => {
    if (!mDias || !mFechaInicio || !mPortal) return
    setMCalcMsg('⏳ Calculando...')
    try {
      const desde = new Date(mFechaInicio + 'T12:00:00')
      const vd = mPortal === 'SCBA'
        ? await sumarCorridos(desde, parseInt(mDias))
        : await sumarHabiles(desde, parseInt(mDias))
      setMVencResult({ fecha: dateFmt(vd), texto: `Vence el ${fechaLarga(vd)}` })
      setMCalcMsg('✅ Calculado')
    } catch { setMCalcMsg('⚠ Error') }
  }

  const handleSaveMovimiento = async () => {
    if (!mPortal || !mNovedad.trim()) return alert('Complete portal y novedad.')
    if (movEditId) {
      const original = registros.find(x => x.id === movEditId)
      const patch = {
        portal: mPortal,
        novedad: mNovedad.trim(),
        estrategia: mEstrategia.trim() || null,
        tiene_vencimiento: mTieneVenc,
        vencimiento_fecha: mTieneVenc && mVencResult ? mVencResult.fecha : null,
        vencimiento_texto: mTieneVenc && mVencResult ? mVencResult.texto : null,
      }
      await updateRegistro(movEditId, patch)
    } else {
      const obj = {
        id: uid(), portal: mPortal, causa: id,
        novedad: mNovedad.trim(), estrategia: mEstrategia.trim() || null,
        tiene_vencimiento: mTieneVenc,
        vencimiento_fecha: mTieneVenc && mVencResult ? mVencResult.fecha : null,
        vencimiento_texto: mTieneVenc && mVencResult ? mVencResult.texto : null,
        fecha: new Date().toISOString()
      }
      await saveRegistro(obj)
      if (mCrearTarea) {
        const tt = mTareaTitulo.trim() || mNovedad.substring(0, 80)
        await saveTarea({ id: uid(), titulo: tt, causa: id, criticidad: mTieneVenc && mVencResult ? 'urgente' : 'normal', vencimiento: mTieneVenc && mVencResult ? mVencResult.fecha : null, estado: 'no-iniciada', notas: mEstrategia.trim() || null, fecha: new Date().toISOString() })
      }
    }
    setMovModal(false)
  }

  // ── Imprimir causa ──
  const handlePrintCausa = () => {
    if (!c) return
    const movs   = registros.filter(r=>r.causa===id)
    const gList  = gastos.filter(g=>g.causa===id)
    const cbList = cobros.filter(cb=>cb.causa===id)
    const tareasCausa = (store.tareas||[]).filter(t=>t.causa===id)
    const tot    = gList.reduce((s,g)=>s+(g.total||0),0)
    const totARS = cbList.filter(cb=>!cb.moneda||cb.moneda==='ARS').reduce((s,cb)=>s+(cb.monto||0),0)
    const totUSD = cbList.filter(cb=>cb.moneda==='USD').reduce((s,cb)=>s+(cb.monto||0),0)

    const secMov = movs.length ? `
      <h2>Movimientos (${movs.length})</h2>
      ${[...movs].reverse().map(r=>`
        <div class="entry">
          <span class="badge">${r.portal}</span>
          <div class="entry-body">
            <div class="entry-main">${r.novedad}</div>
            ${r.estrategia?`<div class="entry-strat">💡 ${r.estrategia}</div>`:''}
            <div class="entry-meta">${fmtF(r.fecha)}${r.tiene_vencimiento&&r.vencimiento_texto?` &nbsp;·&nbsp; <strong style="color:#c0392b">${r.vencimiento_texto}</strong>`:''}</div>
          </div>
        </div>
      `).join('')}
    ` : '<p class="empty">Sin movimientos registrados.</p>'

    const secTareas = tareasCausa.length ? `
      <h2>Tareas (${tareasCausa.length})</h2>
      <table>
        <thead><tr><th>Tarea</th><th>Criticidad</th><th>Estado</th><th>Vencimiento</th></tr></thead>
        <tbody>${tareasCausa.map(t=>`
          <tr>
            <td>${t.titulo}${t.notas?`<br><small style="color:#888;font-style:italic">${t.notas}</small>`:''}</td>
            <td>${{urgente:'🔴 Urgente',alta:'🟠 Alta',normal:'🟢 Normal',baja:'⚪ Baja'}[t.criticidad]||t.criticidad}</td>
            <td>${{'no-iniciada':'No iniciada','en-curso':'En curso','completada':'Completada'}[t.estado]||t.estado}</td>
            <td style="color:${t.vencimiento?'#c0392b':'#999'};font-weight:${t.vencimiento?700:400}">${t.vencimiento?fmtF(t.vencimiento):'—'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    ` : ''

    const secGastos = gList.length ? `
      <h2>Gastos</h2>
      <table>
        <thead><tr><th>Trámite</th><th>Cant.</th><th>P.U.</th><th>Total</th><th>Fecha</th></tr></thead>
        <tbody>
          ${gList.map(g=>`<tr><td>${g.tramite_nombre}</td><td style="text-align:right">${g.cant}</td><td style="text-align:right">$${(g.precio_u||0).toLocaleString('es-AR')}</td><td style="text-align:right;font-weight:700">$${(g.total||0).toLocaleString('es-AR')}</td><td>${g.fecha?fmtF(g.fecha):'-'}</td></tr>`).join('')}
          <tr style="background:#f0ebe0;font-weight:700"><td colspan="3">TOTAL</td><td style="text-align:right">$${tot.toLocaleString('es-AR')}</td><td></td></tr>
        </tbody>
      </table>
    ` : ''

    const secCobros = cbList.length ? `
      <h2>Cobros</h2>
      <table>
        <thead><tr><th>Concepto</th><th>Moneda</th><th>Fecha</th><th>Monto</th></tr></thead>
        <tbody>
          ${[...cbList].reverse().map(cb=>{const isUSD=cb.moneda==='USD';return`<tr><td>${cb.concepto}</td><td>${isUSD?'USD':'ARS'}</td><td>${fmtF(cb.fecha)}</td><td style="text-align:right;font-weight:700;color:${isUSD?'#1a5276':'#1e6b4a'}">${isUSD?'U$S ':'$'}${(cb.monto||0).toLocaleString('es-AR')}</td></tr>`}).join('')}
        </tbody>
      </table>
      <p style="font-size:.8rem;color:#555;margin-top:.5rem">
        Total cobrado ARS: <strong>$${totARS.toLocaleString('es-AR')}</strong>
        ${totUSD>0?` &nbsp;·&nbsp; Total cobrado USD: <strong>U$S ${totUSD.toLocaleString('es-AR')}</strong>`:''}
      </p>
    ` : ''

    const html = `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>${c.caratula} — I|A</title>
      <style>
        body { font-family: 'IBM Plex Sans', Arial, sans-serif; padding: 2rem; color: #111; font-size: 13px; max-width: 900px; margin: 0 auto; }
        .header { border-bottom: 3px solid #b8922a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .logo { font-size: .75rem; color: #888; font-family: monospace; margin-bottom: .3rem; }
        h1 { font-family: Georgia, serif; font-size: 1.4rem; margin: 0 0 .3rem; }
        .meta { font-size: .75rem; color: #666; font-family: monospace; }
        h2 { font-family: Georgia, serif; font-size: 1rem; margin: 1.5rem 0 .6rem; border-bottom: 1px solid #ddd; padding-bottom: .3rem; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: .5rem; }
        th { background: #0f0e0c; color: #d4a843; text-align: left; padding: .4rem .6rem; font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; }
        td { padding: .4rem .6rem; border-bottom: 1px solid #e8e3da; vertical-align: top; font-size: .8rem; }
        .entry { display: flex; gap: .7rem; margin-bottom: .7rem; padding-bottom: .7rem; border-bottom: 1px solid #eee; }
        .badge { background: #0f0e0c; color: #d4a843; border-radius: 4px; padding: .2rem .5rem; font-family: monospace; font-size: .65rem; font-weight: 700; white-space: nowrap; align-self: flex-start; }
        .entry-body { flex: 1; }
        .entry-main { font-size: .83rem; font-weight: 500; margin-bottom: .2rem; }
        .entry-strat { font-size: .75rem; color: #2c3e50; font-style: italic; border-left: 2px solid #b8922a; padding-left: .4rem; margin: .25rem 0; }
        .entry-meta { font-size: .68rem; color: #888; font-family: monospace; }
        .empty { color: #aaa; font-style: italic; font-size: .8rem; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>
      <div class="header">
        <div class="logo">I|A — GESTIÓN LEGAL</div>
        <h1>${c.caratula}</h1>
        <div class="meta">
          ${[c.tribunal,c.fuero,c.juzgado,c.nro].filter(Boolean).join(' · ')}
          ${c.cliente ? ` &nbsp;·&nbsp; 👤 ${c.cliente}` : ''}
          &nbsp;·&nbsp; Impreso el ${new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})}
        </div>
      </div>
      ${secMov}
      ${secTareas}
      ${secGastos}
      ${secCobros}
      </body></html>
    `
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  if (!c) return <div className="empty-state"><p>Causa no encontrada</p></div>

  const archivada = (c.estado||'activa')==='archivada'

  const movs   = registros.filter(r=>r.causa===id)
  const gList  = gastos.filter(g=>g.causa===id)
  const cbList = cobros.filter(cb=>cb.causa===id)
  const tot    = gList.reduce((s,g)=>s+(g.total||0),0)
  const totARS = cbList.filter(cb=>!cb.moneda||cb.moneda==='ARS').reduce((s,cb)=>s+(cb.monto||0),0)
  const totUSD = cbList.filter(cb=>cb.moneda==='USD').reduce((s,cb)=>s+(cb.monto||0),0)

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

  // Archivar / desarchivar desde el detalle
  const toggleArchivo = async () => {
    await saveCausa({ ...c, estado: archivada ? 'activa' : 'archivada' })
  }

  // Recibo de un cobro (uno por fila)
  const emitirReciboCobro = async (cb) => {
    let nro = cb.recibo_nro
    if (!nro) { nro = nextReciboNro(cobros); await saveCobro({ ...cb, recibo_nro: nro }) }
    imprimirRecibo({ tipo:'cobro', nroFmt: fmtNro('REC', nro), fecha: cb.fecha, monto: cb.monto, moneda: cb.moneda||'ARS', concepto: cb.concepto, tribunal: c.tribunal })
  }

  // Selección múltiple de gastos + un solo recibo con todos los seleccionados
  const toggleGasto = (gid) => {
    setSelGastos((prev) => { const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n })
  }
  const emitirReciboGastos = async () => {
    const seleccion = gList.filter((g) => selGastos.has(g.id))
    if (!seleccion.length) return
    const nro = nextReciboNro(gastos)
    for (const g of seleccion) {
      if (g.recibo_nro !== nro) await saveGasto({ ...g, recibo_nro: nro })
    }
    imprimirRecibo({
      tipo: 'pago',
      nroFmt: fmtNro('PAG', nro),
      fecha: dateFmt(new Date()),
      moneda: 'ARS',
      tribunal: c.tribunal,
      items: seleccion.map((g) => ({ concepto: g.tramite_nombre, cantidad: g.cant, monto: g.total })),
    })
    setSelGastos(new Set())
  }

  return (
    <div>
      <div style={{marginBottom:'.9rem'}}><button className="btn btn-ghost btn-sm" onClick={()=>navigate('causas')}>← Volver</button></div>

      <div className="causa-detail-header">
        <div style={{flex:1}}>
          <div className="causa-detail-title">{c.caratula}{archivada&&<span style={{marginLeft:'.5rem',fontSize:'.6rem',fontFamily:'IBM Plex Mono,monospace',color:'var(--muted)',border:'1px solid var(--muted)',borderRadius:4,padding:'0 .35rem',verticalAlign:'middle'}}>ARCHIVADA</span>}</div>
          <div className="causa-detail-sub">{[c.tribunal,c.fuero,c.juzgado,c.nro].filter(Boolean).join(' · ')}</div>
          {c.cliente&&<div className="causa-detail-sub">👤 {c.cliente}</div>}
          {pptoBar}
        </div>
        <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
          <button className="btn btn-primary btn-sm" onClick={openTareaModal}>＋ Tarea</button>
          <button className="btn btn-primary btn-sm" style={{background:'var(--slate)',borderColor:'var(--slate)'}} onClick={()=>openMovModal()}>＋ Movimiento</button>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--paper)',borderColor:'#555'}} onClick={()=>setGastoModal(true)}>+ Gasto</button>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--paper)',borderColor:'#555'}} onClick={()=>setCobroModal(true)}>+ Cobro</button>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--paper)',borderColor:'#555'}} onClick={handlePrintCausa}>🖨</button>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--paper)',borderColor:'#555'}} onClick={toggleArchivo}>{archivada?'↩ Desarchivar':'🗄 Archivar'}</button>
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
      {movs.length===0
        ? <p style={{color:'var(--muted)',fontSize:'.83rem',marginBottom:'1.3rem'}}>Sin movimientos.</p>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:'.45rem',marginBottom:'1.3rem'}}>
            {[...movs].reverse().map(r=>(
              <div key={r.id} className="registro-entry">
                <div className="registro-portal">{r.portal}</div>
                <div className="registro-body">
                  <div className="registro-novedad">{r.novedad}</div>
                  {r.estrategia&&<div className="registro-estrategia">💡 {r.estrategia}</div>}
                  <div className="registro-meta">
                    <span>{fmtF(r.fecha)}</span>
                    {r.tiene_vencimiento&&r.vencimiento_texto&&<span className="registro-venc">{r.vencimiento_texto}</span>}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'.3rem',alignSelf:'flex-start'}}>
                  <button className="btn btn-ghost btn-xs" onClick={()=>openMovModal(r.id)}>✏</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar movimiento?'))deleteRegistro(r.id)}}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* Tareas de esta causa */}
      {(() => {
        const tareasCausa = (store.tareas||[]).filter(t=>t.causa===id)
        if (!tareasCausa.length) return null
        const co = { urgente:0, alta:1, normal:2, baja:3 }
        const sorted = [...tareasCausa].sort((a,b)=>(co[a.criticidad]||2)-(co[b.criticidad]||2))
        const critMap = { urgente:'🔴', alta:'🟠', normal:'🟢', baja:'⚪' }
        const estadoMap = { 'no-iniciada':'No iniciada', 'en-curso':'En curso', 'completada':'Completada' }
        return (
          <div style={{marginBottom:'1.3rem'}}>
            <h3 style={{fontFamily:'Playfair Display,serif',fontSize:'1.05rem',marginBottom:'.65rem'}}>Tareas</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
              {sorted.map(t=>(
                <div key={t.id} className={`task-strip ${t.criticidad||'normal'}`}>
                  <div className="task-main">
                    <div className="task-title">{critMap[t.criticidad]||'🟢'} {t.titulo}</div>
                    <div className="task-meta">
                      <span>{estadoMap[t.estado]||t.estado}</span>
                      {t.vencimiento&&<span className="task-vencimiento">Vence: {fmtF(t.vencimiento)}</span>}
                      {t.notas&&<span className="task-notas">{t.notas.substring(0,55)}{t.notas.length>55?'…':''}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Gastos */}
      <h3 style={{fontFamily:'Playfair Display,serif',fontSize:'1.05rem',marginBottom:'.65rem'}}>Gastos</h3>
      {gList.length===0?<p style={{color:'var(--muted)',fontSize:'.83rem',marginBottom:'1.3rem'}}>Sin gastos.</p>:(
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'.5rem'}}>
            <button className="btn btn-primary btn-sm" disabled={selGastos.size===0} onClick={emitirReciboGastos}>
              🧾 Emitir recibo{selGastos.size>0?` (${selGastos.size})`:''}
            </button>
          </div>
          <div className="table-wrapper" style={{marginBottom:'1.3rem'}}>
            <table>
              <thead><tr>
                <th style={{width:32,textAlign:'center'}}>
                  <input type="checkbox"
                    checked={gList.length>0 && selGastos.size===gList.length}
                    onChange={e=>setSelGastos(e.target.checked ? new Set(gList.map(g=>g.id)) : new Set())} />
                </th>
                <th>Trámite</th><th>Cant.</th><th>P.U.</th><th>Total</th><th>Fecha</th>
              </tr></thead>
              <tbody>{gList.map(g=>(
                <tr key={g.id} style={selGastos.has(g.id)?{background:'var(--cream)'}:undefined}>
                  <td style={{textAlign:'center'}}><input type="checkbox" checked={selGastos.has(g.id)} onChange={()=>toggleGasto(g.id)} /></td>
                  <td>{g.tramite_nombre}{g.recibo_nro?<span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:'.68rem',color:'var(--muted)',marginLeft:'.4rem'}}>{fmtNro('PAG',g.recibo_nro)}</span>:null}</td>
                  <td className="num">{g.cant}</td>
                  <td className="num">${(g.precio_u||0).toLocaleString('es-AR')}</td>
                  <td className="num" style={{fontWeight:700}}>${(g.total||0).toLocaleString('es-AR')}</td>
                  <td>{g.fecha?fmtF(g.fecha):'-'}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr className="tfoot-row"><td></td><td colSpan="3" style={{padding:'.6rem .9rem'}}>TOTAL</td><td className="num" style={{padding:'.6rem .9rem',fontWeight:700}}>${tot.toLocaleString('es-AR')}</td><td></td></tr></tfoot>
            </table>
          </div>
        </>
      )}

      {/* Cobros */}
      <h3 style={{fontFamily:'Playfair Display,serif',fontSize:'1.05rem',marginBottom:'.65rem'}}>Cobros</h3>
      {cbList.length===0?<p style={{color:'var(--muted)',fontSize:'.83rem'}}>Sin cobros.</p>:(
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Concepto</th><th>Moneda</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
            <tbody>{[...cbList].reverse().map(cb=>{const isUSD=cb.moneda==='USD';return(
              <tr key={cb.id}><td>{cb.concepto}{cb.recibo_nro?<span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:'.68rem',color:'var(--muted)',marginLeft:'.4rem'}}>{fmtNro('REC',cb.recibo_nro)}</span>:null}</td><td><span className={`cobro-moneda-badge ${isUSD?'usd':'ars'}`}>{isUSD?'USD':'ARS'}</span></td><td>{fmtF(cb.fecha)}</td><td className="num" style={{fontWeight:700,color:isUSD?'var(--usd)':'var(--ok)'}}>{isUSD?'U$S ':'$'}{(cb.monto||0).toLocaleString('es-AR')}</td><td><button className="btn btn-ghost btn-xs" title="Emitir recibo" onClick={()=>emitirReciboCobro(cb)}>🧾</button></td></tr>
            )})}</tbody>
          </table>
        </div>
      )}

      {/* ── Modal Nueva Tarea ── */}
      {tareaModal&&(
        <Modal title="Nueva Tarea" onClose={()=>setTareaModal(false)}>
          <div style={{marginBottom:'.8rem',padding:'.5rem .8rem',background:'var(--cream)',borderRadius:6,fontSize:'.78rem',color:'var(--muted)',fontFamily:'IBM Plex Mono,monospace'}}>
            📁 {c.caratula.substring(0,60)}{c.caratula.length>60?'…':''}
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:2}}><label>Título *</label><input className="form-control" value={tTitulo} onChange={e=>setTTitulo(e.target.value)} placeholder="Descripción de la tarea" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Criticidad</label><select className="form-control" value={tCrit} onChange={e=>setTCrit(e.target.value)}><option value="urgente">🔴 Urgente</option><option value="alta">🟠 Alta</option><option value="normal">🟢 Normal</option><option value="baja">⚪ Baja</option></select></div>
            <div className="form-group"><label>Estado</label><select className="form-control" value={tEstado} onChange={e=>setTEstado(e.target.value)}><option value="no-iniciada">⬜ No Iniciada</option><option value="en-curso">🔄 En Curso</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Vencimiento</label><input type="date" className="form-control" value={tVenc} onChange={e=>{setTVenc(e.target.value);if(e.target.value)setTCrit('urgente')}} /></div>
          </div>
          <div className="form-group" style={{marginBottom:'1rem'}}><label>Notas</label><textarea className="form-control" rows="2" value={tNotas} onChange={e=>setTNotas(e.target.value)} placeholder="Detalles..." /></div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}>
            <button className="btn btn-ghost" onClick={()=>setTareaModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveTarea} disabled={tSaving}>{tSaving?'Guardando...':'Guardar'}</button>
          </div>
        </Modal>
      )}

      {/* ── Modal Movimiento (nuevo + editar) ── */}
      {movModal&&(
        <Modal title={movEditId ? 'Editar Movimiento' : 'Nuevo Movimiento'} onClose={()=>setMovModal(false)}>
          <div style={{marginBottom:'.8rem',padding:'.5rem .8rem',background:'var(--cream)',borderRadius:6,fontSize:'.78rem',color:'var(--muted)',fontFamily:'IBM Plex Mono,monospace'}}>
            📁 {c.caratula.substring(0,60)}{c.caratula.length>60?'…':''}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Portal *</label>
              <select className="form-control" value={mPortal} onChange={e=>{setMPortal(e.target.value);setMCalcMsg('')}}>
                <option value="">— Seleccione —</option>
                <option>PJN</option><option>SCBA</option><option value="EJE">EJE (CABA)</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{marginBottom:'.9rem'}}>
            <label>Novedad / Providencia *</label>
            <textarea className="form-control" rows="3" value={mNovedad} onChange={e=>setMNovedad(e.target.value)} placeholder="Describa el movimiento..." />
          </div>
          <div className="form-group" style={{marginBottom:'.9rem'}}>
            <label>Estrategia / Respuesta</label>
            <textarea className="form-control" rows="2" value={mEstrategia} onChange={e=>setMEstrategia(e.target.value)} placeholder="¿Qué acción plantea?" />
          </div>
          <div className="card" style={{background:'var(--cream)',marginBottom:'.9rem',padding:'.9rem'}}>
            <div className="checkbox-row" style={{marginBottom:'.65rem'}}>
              <input type="checkbox" checked={mTieneVenc} onChange={e=>setMTieneVenc(e.target.checked)} />
              <label><strong>Vencimiento de plazo</strong></label>
            </div>
            {mTieneVenc&&(
              <div>
                {mVencResult&&!mCalcMsg&&(
                  <div className="vencimiento-result" style={{marginBottom:'.6rem'}}>{mVencResult.texto}</div>
                )}
                <div style={{display:'flex',alignItems:'center',gap:'.65rem',flexWrap:'wrap'}}>
                  <select className="form-control" value={mDias} onChange={e=>{setMDias(e.target.value);setMVencResult(null)}} style={{width:80}}>
                    <option value="">Días</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=><option key={n}>{n}</option>)}
                  </select>
                  <span style={{fontSize:'.78rem',color:'var(--muted)'}}>{mPortal==='SCBA'?'días corridos':'días hábiles'}</span>
                  <input type="date" className="form-control" value={mFechaInicio} onChange={e=>{setMFechaInicio(e.target.value);setMVencResult(null)}} style={{width:150}} />
                  <button className="btn btn-ghost btn-sm" onClick={calcVencimientoMov}>Recalcular</button>
                </div>
                {mCalcMsg&&<div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:'.3rem',fontFamily:'IBM Plex Mono,monospace'}}>{mCalcMsg}</div>}
                {mVencResult&&mCalcMsg&&<div className="vencimiento-result">{mVencResult.texto}</div>}
              </div>
            )}
          </div>
          {!movEditId&&(
            <div className="card" style={{background:'var(--cream)',marginBottom:'.9rem',padding:'.9rem'}}>
              <div className="checkbox-row">
                <input type="checkbox" checked={mCrearTarea} onChange={e=>setMCrearTarea(e.target.checked)} />
                <label><strong>Generar tarea a partir de este movimiento</strong></label>
              </div>
              {mCrearTarea&&(
                <div style={{marginTop:'.75rem'}}>
                  <div className="form-group">
                    <label>Título de la tarea</label>
                    <input className="form-control" value={mTareaTitulo} onChange={e=>setMTareaTitulo(e.target.value)} placeholder="Si vacío, se usa el texto de la novedad" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}>
            <button className="btn btn-ghost" onClick={()=>setMovModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveMovimiento}>Guardar</button>
          </div>
        </Modal>
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
