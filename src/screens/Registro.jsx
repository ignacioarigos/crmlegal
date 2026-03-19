// ── REGISTRO ──────────────────────────────────────────────────
import { useState } from 'react'
import { saveRegistro, deleteRegistro, saveTarea } from '../lib/store.js'
import { uid, dateFmt, fmtF, fetchFeriados, sumarHabiles, sumarCorridos, fechaLarga } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

export function Registro({ store }) {
  const { registros, causas } = store
  const [tab, setTab] = useState('todos')
  const [modal, setModal] = useState(false)
  const [portal, setPortal] = useState('')
  const [causaId, setCausaId] = useState('')
  const [novedad, setNovedad] = useState('')
  const [estrategia, setEstrategia] = useState('')
  const [tieneVenc, setTieneVenc] = useState(false)
  const [dias, setDias] = useState('')
  const [fechaInicio, setFechaInicio] = useState(dateFmt(new Date()))
  const [vencResult, setVencResult] = useState(null)
  const [crearTarea, setCrearTarea] = useState(false)
  const [tareaTitulo, setTareaTitulo] = useState('')
  const [calcMsg, setCalcMsg] = useState('')

  const getCNombre = (id) => { const c = causas.find(x=>x.id===id); return c?(c.caratula.length>35?c.caratula.substring(0,35)+'…':c.caratula):'' }

  const calcVencimiento = async () => {
    if (!dias || !fechaInicio || !portal) return
    setCalcMsg('⏳ Calculando...')
    try {
      const desde = new Date(fechaInicio+'T12:00:00')
      const vd = portal === 'SCBA' ? await sumarCorridos(desde, parseInt(dias)) : await sumarHabiles(desde, parseInt(dias))
      setVencResult({ fecha: dateFmt(vd), texto: `Vence el ${fechaLarga(vd)}` })
      setCalcMsg('✅ Calculado')
    } catch { setCalcMsg('⚠ Error') }
  }

  const handleSave = async () => {
    if (!portal || !novedad.trim()) return alert('Complete portal y novedad.')
    const obj = { id: uid(), portal, causa: causaId||null, novedad: novedad.trim(), estrategia: estrategia.trim()||null, tiene_vencimiento: tieneVenc, vencimiento_fecha: tieneVenc&&vencResult?vencResult.fecha:null, vencimiento_texto: tieneVenc&&vencResult?vencResult.texto:null, fecha: new Date().toISOString() }
    await saveRegistro(obj)
    if (crearTarea) {
      const tt = tareaTitulo.trim() || novedad.substring(0,80)
      await saveTarea({ id: uid(), titulo: tt, causa: obj.causa, criticidad: tieneVenc&&vencResult?'urgente':'normal', vencimiento: tieneVenc&&vencResult?vencResult.fecha:null, estado: 'no-iniciada', notas: estrategia.trim()||null, fecha: new Date().toISOString() })
    }
    setModal(false); resetForm()
  }

  const resetForm = () => { setPortal(''); setCausaId(''); setNovedad(''); setEstrategia(''); setTieneVenc(false); setDias(''); setFechaInicio(dateFmt(new Date())); setVencResult(null); setCrearTarea(false); setTareaTitulo(''); setCalcMsg('') }

  const portales = ['todos','PJN','SCBA','EJE']
  let list = [...registros].reverse()
  if (tab !== 'todos') list = list.filter(r => r.portal === tab)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Registro <small>NOVEDADES DE PORTALES</small></div>
        <button className="btn btn-primary" onClick={()=>{resetForm();setModal(true)}}>＋ Nueva</button>
      </div>
      <div className="tabs">{portales.map(p=><div key={p} className={`tab ${tab===p?'active':''}`} onClick={()=>setTab(p)}>{p==='todos'?'Todos':p}</div>)}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'.55rem'}}>
        {list.length===0&&<div className="empty-state"><div className="icon">📋</div><p>Sin registros</p></div>}
        {list.map(r=>(
          <div key={r.id} className="registro-entry">
            <div className="registro-portal">{r.portal}</div>
            <div className="registro-body">
              <div className="registro-novedad">{r.novedad}</div>
              {r.estrategia&&<div className="registro-estrategia">💡 {r.estrategia}</div>}
              <div className="registro-meta">
                <span>{fmtF(r.fecha)}</span>
                {r.tiene_vencimiento&&r.vencimiento_texto&&<span className="registro-venc">{r.vencimiento_texto}</span>}
                {r.causa&&<span>{getCNombre(r.causa)}</span>}
              </div>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={()=>{if(confirm('¿Eliminar?'))deleteRegistro(r.id)}} style={{alignSelf:'flex-start'}}>🗑</button>
          </div>
        ))}
      </div>
      {modal&&(
        <Modal title="Nueva Novedad" onClose={()=>{setModal(false);resetForm()}}>
          <div className="form-row">
            <div className="form-group"><label>Portal *</label><select className="form-control" value={portal} onChange={e=>{setPortal(e.target.value);setCalcMsg('')}}><option value="">— Seleccione —</option><option>PJN</option><option>SCBA</option><option value="EJE">EJE (CABA)</option></select></div>
            <div className="form-group"><label>Causa</label><select className="form-control" value={causaId} onChange={e=>setCausaId(e.target.value)}><option value="">— General —</option>{causas.map(c=><option key={c.id} value={c.id}>{c.caratula.substring(0,45)}</option>)}</select></div>
          </div>
          <div className="form-group" style={{marginBottom:'.9rem'}}><label>Novedad / Providencia *</label><textarea className="form-control" rows="3" value={novedad} onChange={e=>setNovedad(e.target.value)} placeholder="Describa el movimiento..." /></div>
          <div className="form-group" style={{marginBottom:'.9rem'}}><label>Estrategia / Respuesta</label><textarea className="form-control" rows="2" value={estrategia} onChange={e=>setEstrategia(e.target.value)} placeholder="¿Qué acción plantea?" /></div>
          <div className="card" style={{background:'var(--cream)',marginBottom:'.9rem',padding:'.9rem'}}>
            <div className="checkbox-row" style={{marginBottom:'.65rem'}}><input type="checkbox" checked={tieneVenc} onChange={e=>setTieneVenc(e.target.checked)} /><label><strong>Vencimiento de plazo</strong></label></div>
            {tieneVenc&&(
              <div>
                <div style={{display:'flex',alignItems:'center',gap:'.65rem',flexWrap:'wrap'}}>
                  <select className="form-control" value={dias} onChange={e=>{setDias(e.target.value);setVencResult(null)}} style={{width:80}}><option value="">Días</option>{[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=><option key={n}>{n}</option>)}</select>
                  <span style={{fontSize:'.78rem',color:'var(--muted)'}}>{portal==='SCBA'?'días corridos':'días hábiles'}</span>
                  <input type="date" className="form-control" value={fechaInicio} onChange={e=>{setFechaInicio(e.target.value);setVencResult(null)}} style={{width:150}} />
                  <button className="btn btn-ghost btn-sm" onClick={calcVencimiento}>Calcular</button>
                </div>
                {calcMsg&&<div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:'.3rem',fontFamily:'IBM Plex Mono,monospace'}}>{calcMsg}</div>}
                {vencResult&&<div className="vencimiento-result">{vencResult.texto}</div>}
              </div>
            )}
          </div>
          <div className="card" style={{background:'var(--cream)',marginBottom:'.9rem',padding:'.9rem'}}>
            <div className="checkbox-row"><input type="checkbox" checked={crearTarea} onChange={e=>setCrearTarea(e.target.checked)} /><label><strong>Generar tarea a partir de este registro</strong></label></div>
            {crearTarea&&<div style={{marginTop:'.75rem'}}><div className="form-group"><label>Título de la tarea</label><input className="form-control" value={tareaTitulo} onChange={e=>setTareaTitulo(e.target.value)} placeholder="Si vacío, se usa el texto de la novedad" /></div></div>}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}>
            <button className="btn btn-ghost" onClick={()=>{setModal(false);resetForm()}}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Registro
