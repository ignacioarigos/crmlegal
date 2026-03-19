import { useState } from 'react'
import { saveCobro, deleteCobro } from '../lib/store.js'
import { uid, dateFmt, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

export default function Cobros({ store }) {
  const { cobros, causas } = store
  const [tab, setTab] = useState('todos')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [moneda, setMoneda] = useState('ARS')
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [causa, setCausa] = useState('')

  const now = new Date()
  const mes   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const anio  = String(now.getFullYear())
  const mesNombre = now.toLocaleDateString('es-AR',{month:'long',year:'numeric'}).toUpperCase()

  const arsM  = cobros.filter(c=>c.fecha?.startsWith(mes)&&(!c.moneda||c.moneda==='ARS')).reduce((s,c)=>s+(c.monto||0),0)
  const arsA  = cobros.filter(c=>c.fecha?.startsWith(anio)&&(!c.moneda||c.moneda==='ARS')).reduce((s,c)=>s+(c.monto||0),0)
  const usdM  = cobros.filter(c=>c.fecha?.startsWith(mes)&&c.moneda==='USD').reduce((s,c)=>s+(c.monto||0),0)
  const usdA  = cobros.filter(c=>c.fecha?.startsWith(anio)&&c.moneda==='USD').reduce((s,c)=>s+(c.monto||0),0)

  const getCNombre = (id) => { const c = causas.find(x=>x.id===id); return c ? (c.caratula.length>35?c.caratula.substring(0,35)+'…':c.caratula) : '' }

  const openModal = (id = null) => {
    setEditId(id)
    if (id) {
      const c = cobros.find(x=>x.id===id)
      setMoneda(c.moneda||'ARS'); setFecha(c.fecha||'')
      setMonto(c.monto||''); setConcepto(c.concepto||''); setCausa(c.causa||'')
    } else {
      setMoneda('ARS'); setFecha(dateFmt(new Date())); setMonto(''); setConcepto(''); setCausa('')
    }
    setModal(true)
  }

  const handleSave = async () => {
    if (!fecha || !monto || !concepto) return alert('Completá fecha, monto y concepto.')
    const obj = { id: editId||uid(), fecha, monto: parseFloat(monto), concepto, moneda, causa: causa||null }
    await saveCobro(obj)
    setModal(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar cobro?')) return
    await deleteCobro(id)
  }

  let list = [...cobros].sort((a,b)=>b.fecha.localeCompare(a.fecha))
  if (tab === 'ARS') list = list.filter(c=>!c.moneda||c.moneda==='ARS')
  if (tab === 'USD') list = list.filter(c=>c.moneda==='USD')

  // Agrupar por mes
  const grupos = {}
  list.forEach(c => {
    const ym = c.fecha?.substring(0,7)||'0000-00'
    if (!grupos[ym]) grupos[ym] = []
    grupos[ym].push(c)
  })

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Cobros <small>INGRESOS DEL ESTUDIO — ARS Y USD</small></div>
        <button className="btn btn-primary" onClick={() => openModal()}>＋ Registrar</button>
      </div>

      {/* Resumen 4 tarjetas */}
      <div className="cobro-resumen">
        <div className="cobro-resumen-card ars-card">
          <div className="cobro-resumen-num">${arsM.toLocaleString('es-AR')}</div>
          <div className="cobro-resumen-label">ARS — {mesNombre}</div>
        </div>
        <div className="cobro-resumen-card ars-card">
          <div className="cobro-resumen-num">${arsA.toLocaleString('es-AR')}</div>
          <div className="cobro-resumen-label">ARS — Año {anio}</div>
        </div>
        <div className="cobro-resumen-card usd-card">
          <div className="cobro-resumen-num">U$S {usdM.toLocaleString('es-AR')}</div>
          <div className="cobro-resumen-label">USD — {mesNombre}</div>
        </div>
        <div className="cobro-resumen-card usd-card">
          <div className="cobro-resumen-num">U$S {usdA.toLocaleString('es-AR')}</div>
          <div className="cobro-resumen-label">USD — Año {anio}</div>
        </div>
      </div>

      {/* Tabs filtro */}
      <div className="tabs">
        {['todos','ARS','USD'].map(t => (
          <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t === 'todos' ? 'Todos' : t === 'ARS' ? '$ Solo ARS' : 'U$S Solo USD'}
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="task-list">
        {Object.keys(grupos).length === 0 && (
          <div className="empty-state"><div className="icon">💵</div><p>Sin cobros registrados</p></div>
        )}
        {Object.entries(grupos).map(([ym, items]) => {
          const [y,m] = ym.split('-')
          const label = new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}).toUpperCase()
          const sARS = items.filter(c=>!c.moneda||c.moneda==='ARS').reduce((s,c)=>s+(c.monto||0),0)
          const sUSD = items.filter(c=>c.moneda==='USD').reduce((s,c)=>s+(c.monto||0),0)
          return (
            <div key={ym}>
              <div className="cobro-mes-label">
                {label}
                {sARS > 0 && <> — ${sARS.toLocaleString('es-AR')} ARS</>}
                {sUSD > 0 && <> {sARS>0?'·':''} U$S {sUSD.toLocaleString('es-AR')} USD</>}
              </div>
              {items.map(c => {
                const isUSD = c.moneda === 'USD'
                return (
                  <div key={c.id} className={`cobro-strip ${isUSD?'usd':''}`} style={{marginBottom:'.45rem'}}>
                    <span className={`cobro-moneda-badge ${isUSD?'usd':'ars'}`}>{isUSD?'USD':'ARS'}</span>
                    <div style={{flex:1,minWidth:140}}>
                      <div style={{fontWeight:600,fontSize:'.88rem'}}>{c.concepto}</div>
                      <div style={{fontSize:'.72rem',color:'var(--muted)',marginTop:'.2rem',fontFamily:'IBM Plex Mono, monospace'}}>
                        {fmtF(c.fecha)}{c.causa ? ' · ' + getCNombre(c.causa) : ''}
                      </div>
                    </div>
                    <div className={`cobro-monto ${isUSD?'usd':''}`}>
                      {isUSD ? 'U$S ' : '$'}{(c.monto||0).toLocaleString('es-AR')}
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={() => openModal(c.id)}>✏</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(c.id)}>🗑</button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <Modal title={editId ? 'Editar Cobro' : 'Registrar Cobro'} onClose={() => setModal(false)} maxWidth="500px">
          <div className="form-row">
            <div className="form-group">
              <label>Fecha *</label>
              <input type="date" className="form-control" value={fecha} onChange={e=>setFecha(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Moneda</label>
              <div className="moneda-toggle">
                <button type="button" className={`btn btn-sm ${moneda==='ARS'?'btn-primary':'btn-ghost'}`}
                  onClick={()=>setMoneda('ARS')}>$ ARS</button>
                <button type="button" className={`btn btn-sm ${moneda==='USD'?'btn-info':'btn-ghost'}`}
                  style={moneda!=='USD'?{borderColor:'var(--usd)',color:'var(--usd)'}:{}}
                  onClick={()=>setMoneda('USD')}>U$S USD</button>
              </div>
            </div>
          </div>
          <div className="form-group" style={{marginBottom:'.9rem'}}>
            <label>{moneda === 'USD' ? 'Monto (U$S) *' : 'Monto ($) *'}</label>
            <input type="number" className="form-control" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{marginBottom:'.9rem'}}>
            <label>Concepto *</label>
            <input className="form-control" value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Ej: Honorarios, consulta, cuota..." />
          </div>
          <div className="form-group" style={{marginBottom:'1rem'}}>
            <label>Causa (opcional)</label>
            <select className="form-control" value={causa} onChange={e=>setCausa(e.target.value)}>
              <option value="">— General —</option>
              {causas.map(c => <option key={c.id} value={c.id}>{c.caratula.substring(0,50)}</option>)}
            </select>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:'.6rem'}}>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
