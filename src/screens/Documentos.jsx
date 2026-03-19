import { useState } from 'react'
import { dateFmt, fmtF } from '../lib/supabase.js'
import Modal from '../components/Modal.jsx'

const PLANTILLAS = {
  nota_simple:        { nombre: 'Nota simple',           icon: '📝', desc: 'Nota dirigida a tribunal o contraparte',        prompt: 'Redactá una nota simple formal dirigida al tribunal o contraparte indicada. Formato carta con encabezado, cuerpo y cierre profesional.' },
  escrito_inicio:     { nombre: 'Escrito de inicio',     icon: '⚖️', desc: 'Demanda o presentación inicial',                prompt: 'Redactá un escrito judicial de inicio (demanda o presentación inicial). Incluí encabezado con datos del juzgado, nombre del profesional, carátula, y desarrollo formal del pedido.' },
  contrato_honorarios:{ nombre: 'Contrato de honorarios',icon: '📋', desc: 'Acuerdo de honorarios profesionales',           prompt: 'Redactá un contrato de honorarios profesionales entre el abogado Ignacio Arigós y el cliente. Incluí partes, objeto, monto o forma de cálculo, condiciones de pago y firma.' },
  poder_judicial:     { nombre: 'Poder judicial',        icon: '🔏', desc: 'Poder para actuar en juicio',                   prompt: 'Redactá un poder judicial para actuar en juicio. Incluí otorgante, apoderado (Dr. Ignacio Arigós), facultades otorgadas y cláusula de aceptación.' },
  carta_documento:    { nombre: 'Carta documento',       icon: '✉️', desc: 'Comunicación formal fehaciente',                prompt: 'Redactá una carta documento con formato fehaciente. Incluí remitente, destinatario, objeto de la intimación/comunicación y plazo si corresponde.' },
  informe_causa:      { nombre: 'Informe de causa',      icon: '📊', desc: 'Resumen del estado del expediente',             prompt: 'Redactá un informe sobre el estado actual del expediente. Incluí carátula, datos del juzgado, resumen de la situación procesal y próximos pasos.' },
  libre:              { nombre: 'Documento libre',       icon: '✏️', desc: 'Describí vos qué necesitás',                    prompt: 'Redactá el documento legal que se describe a continuación.' },
}

export default function Documentos({ store }) {
  const { causas } = store
  const [step, setStep] = useState(1)          // 1=plantillas, 2=form, 3=resultado
  const [plantilla, setPlantilla] = useState(null)
  const [causaId, setCausaId] = useState('')
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [instrucciones, setInstrucciones] = useState('')
  const [cliente, setCliente] = useState('')
  const [dni, setDni] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [texto, setTexto] = useState('')
  const [generando, setGenerando] = useState(false)
  const [driveMsg, setDriveMsg] = useState(null)

  const selCausa = causas.find(c => c.id === causaId)

  const selPlantilla = (key) => {
    setPlantilla(key)
    setStep(2)
    setTexto(''); setDriveMsg(null)
    // Autocompletar desde causa
    if (causaId && selCausa) {
      if (selCausa.cliente) setCliente(selCausa.cliente)
    }
  }

  const getCausaCtx = () => {
    if (!selCausa) return ''
    return `Causa: ${selCausa.caratula}\nTribunal: ${selCausa.tribunal}\nFuero: ${selCausa.fuero||'—'}\nJuzgado: ${selCausa.juzgado||'—'}\nExpediente Nro: ${selCausa.nro||'—'}\nCliente: ${selCausa.cliente||'—'}\n`
  }

  const generar = async () => {
    setGenerando(true); setStep(3); setTexto('')
    const pl = PLANTILLAS[plantilla]
    const fechaFmt = fecha ? new Date(fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'}) : ''
    let ctx = `Fecha: ${fechaFmt}\nAbogado: Dr. Ignacio Arigós (CUIT 23-31289316-9, TE: 1154737787, Email: ignacioarigos@gmail.com)\n`
    ctx += getCausaCtx()
    if (cliente) ctx += `Cliente: ${cliente}\n`
    if (dni) ctx += `DNI: ${dni}\n`
    if (destinatario) ctx += `Destinatario: ${destinatario}\n`
    if (instrucciones) ctx += `Instrucciones adicionales: ${instrucciones}\n`

    const prompt = `${pl.prompt}\n\nDATOS DEL DOCUMENTO:\n${ctx}\n\nGenerá el documento completo listo para usar. Formato profesional argentino. Solo el texto del documento, sin explicaciones ni comentarios.`

    try {
      const res = await fetch('/api-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setTexto(data.content?.find(b => b.type === 'text')?.text || 'Error al generar.')
    } catch {
      setTexto('Error de conexión al generar el documento.')
    }
    setGenerando(false)
  }

  const copiar = async () => {
    if (!texto) return
    await navigator.clipboard.writeText(texto)
  }

  const descargar = () => {
    if (!texto) return
    const blob = new Blob([texto], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${PLANTILLAS[plantilla]?.nombre} [${fecha}].txt`
    a.click()
    URL.revokeObjectURL(url)
    setDriveMsg({ type: 'ok', text: '✅ Archivo descargado correctamente.' })
  }

  const guardarDrive = async () => {
    if (!texto) return
    // Intentar Drive API si hay token disponible
    try {
      const token = window.__gdrive_token
      if (!token) throw new Error('No token')
      const pl = PLANTILLAS[plantilla]
      const nombre = `${pl.nombre}${selCausa?' — '+selCausa.caratula.substring(0,40):''}  [${fecha}].txt`

      // Buscar/crear carpeta del cliente
      let folderId = null
      if (selCausa?.cliente) {
        const carpeta = 'CRM Legal — ' + selCausa.cliente
        const busq = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(carpeta)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`, { headers: { Authorization: 'Bearer ' + token } })
        const bdata = await busq.json()
        if (bdata.files?.length) {
          folderId = bdata.files[0].id
        } else {
          const cr = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: carpeta, mimeType: 'application/vnd.google-apps.folder' }) })
          folderId = (await cr.json()).id
        }
      }

      const meta = { name: nombre, mimeType: 'text/plain', ...(folderId ? { parents: [folderId] } : {}) }
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
      form.append('file', new Blob([texto], { type: 'text/plain' }))
      const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form })
      const udata = await up.json()
      setDriveMsg({ type: 'ok', text: `✅ Guardado en Drive: ${udata.name}` })
    } catch {
      // Fallback: descarga directa
      descargar()
    }
  }

  // Campos extra según plantilla
  const renderCamposExtra = () => {
    if (!plantilla) return null
    if (['contrato_honorarios','poder_judicial'].includes(plantilla)) return (
      <div className="form-row">
        <div className="form-group"><label>Nombre del cliente</label><input className="form-control" value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nombre y apellido completo" /></div>
        <div className="form-group"><label>DNI del cliente</label><input className="form-control" value={dni} onChange={e=>setDni(e.target.value)} placeholder="NN.NNN.NNN" /></div>
      </div>
    )
    if (plantilla === 'carta_documento') return (
      <div className="form-group" style={{marginBottom:'.9rem'}}>
        <label>Destinatario</label>
        <input className="form-control" value={destinatario} onChange={e=>setDestinatario(e.target.value)} placeholder="Nombre y domicilio del destinatario" />
      </div>
    )
    return null
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Documentos <small>GENERADOR CON IA + GOOGLE DRIVE</small></div>
      </div>

      {/* STEP 1 — Selección */}
      {step === 1 && (
        <>
          <p style={{fontSize:'.83rem',color:'var(--muted)',marginBottom:'1.1rem'}}>
            Seleccioná el tipo de documento. La IA lo completa con los datos del expediente.
          </p>
          <div className="doc-plantillas-grid">
            {Object.entries(PLANTILLAS).map(([key, pl]) => (
              <div key={key} className="doc-plantilla-card" onClick={() => selPlantilla(key)}>
                <div className="doc-plantilla-icon">{pl.icon}</div>
                <div className="doc-plantilla-name">{pl.nombre}</div>
                <div className="doc-plantilla-desc">{pl.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* STEP 2 — Formulario */}
      {step === 2 && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'1.1rem'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Cambiar tipo</button>
            <span style={{fontFamily:'Playfair Display, serif',fontSize:'1.1rem',fontWeight:700}}>
              {PLANTILLAS[plantilla]?.icon} {PLANTILLAS[plantilla]?.nombre}
            </span>
          </div>

          <div className="card" style={{marginBottom:'1rem'}}>
            <div className="form-row">
              <div className="form-group" style={{flex:2}}>
                <label>Causa (opcional)</label>
                <select className="form-control" value={causaId} onChange={e=>{setCausaId(e.target.value);const c=causas.find(x=>x.id===e.target.value);if(c?.cliente)setCliente(c.cliente)}}>
                  <option value="">— General —</option>
                  {causas.map(c=><option key={c.id} value={c.id}>{c.caratula.substring(0,50)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha del documento</label>
                <input type="date" className="form-control" value={fecha} onChange={e=>setFecha(e.target.value)} />
              </div>
            </div>
            {renderCamposExtra()}
            <div className="form-group">
              <label>Instrucciones adicionales</label>
              <textarea className="form-control" rows="3" value={instrucciones} onChange={e=>setInstrucciones(e.target.value)}
                placeholder="Ej: Solicitar prórroga de 10 días hábiles, tono formal, incluir jurisprudencia..." />
            </div>
          </div>

          <button className="btn btn-primary" onClick={generar}>✨ Generar con IA</button>
        </>
      )}

      {/* STEP 3 — Resultado */}
      {step === 3 && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'1rem'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>← Editar datos</button>
            <span style={{fontFamily:'Playfair Display, serif',fontSize:'1.1rem',fontWeight:700}}>
              {PLANTILLAS[plantilla]?.nombre}
            </span>
          </div>

          <div className="doc-resultado">
            <div className="doc-resultado-header">
              <div className="doc-resultado-title">{PLANTILLAS[plantilla]?.nombre}</div>
              {!generando && texto && (
                <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
                  <button className="btn btn-ghost btn-sm" onClick={copiar}>📋 Copiar</button>
                  <button className="btn btn-ghost btn-sm" onClick={descargar}>⬇ Descargar</button>
                  <button className="btn btn-primary btn-sm" onClick={guardarDrive}>💾 Guardar en Drive</button>
                </div>
              )}
            </div>

            {generando ? (
              <div className="doc-generando">
                <div className="spinner" />
                <span style={{fontFamily:'IBM Plex Mono, monospace',fontSize:'.78rem'}}>Generando documento con IA...</span>
              </div>
            ) : (
              <div className="doc-texto">{texto}</div>
            )}

            {driveMsg && (
              <div className={`doc-drive-badge ${driveMsg.type}`} style={{marginTop:'.8rem'}}>
                {driveMsg.text}
              </div>
            )}
          </div>

          {!generando && (
            <button className="btn btn-ghost btn-sm" style={{marginTop:'1rem'}} onClick={() => { setStep(2) }}>
              ↻ Regenerar
            </button>
          )}
        </>
      )}
    </div>
  )
}
