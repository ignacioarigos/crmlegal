import { useState, useMemo } from 'react'
import { dateFmt, uid } from '../lib/supabase.js'
import { saveModelo, deleteModelo } from '../lib/store.js'
import {
  VARS_AUTO, resolverAuto, extraerVars, varsManuales, esAuto,
  render, descargarWord, descargarPdf,
} from '../lib/modelos.js'

// Plantillas de IA (para lo que NO es formulario ritual)
const PLANTILLAS = {
  nota_simple:         { nombre: 'Nota simple',            icon: '📝', desc: 'Nota dirigida a tribunal o contraparte', prompt: 'Redactá una nota simple formal dirigida al tribunal o contraparte indicada. Formato carta con encabezado, cuerpo y cierre profesional.' },
  escrito_inicio:      { nombre: 'Escrito de inicio',      icon: '⚖️', desc: 'Demanda o presentación inicial',         prompt: 'Redactá un escrito judicial de inicio (demanda o presentación inicial). Incluí encabezado con datos del juzgado, nombre del profesional, carátula, y desarrollo formal del pedido.' },
  contrato_honorarios: { nombre: 'Contrato de honorarios', icon: '📋', desc: 'Acuerdo de honorarios profesionales',    prompt: 'Redactá un contrato de honorarios profesionales entre el abogado Ignacio Arigós y el cliente. Incluí partes, objeto, monto o forma de cálculo, condiciones de pago y firma.' },
  carta_documento:     { nombre: 'Carta documento',        icon: '✉️', desc: 'Comunicación formal fehaciente',         prompt: 'Redactá una carta documento con formato fehaciente. Incluí remitente, destinatario, objeto de la intimación/comunicación y plazo si corresponde.' },
  informe_causa:       { nombre: 'Informe de causa',       icon: '📊', desc: 'Resumen del estado del expediente',      prompt: 'Redactá un informe sobre el estado actual del expediente. Incluí carátula, datos del juzgado, resumen de la situación procesal y próximos pasos.' },
  libre:               { nombre: 'Documento libre',        icon: '✏️', desc: 'Describí vos qué necesitás',             prompt: 'Redactá el documento legal que se describe a continuación.' },
}

const WORKER = 'https://crmproxy.ignacioarigos.workers.dev'

export default function Documentos({ store }) {
  const causas = store.causas || []
  const modelos = store.modelos || []
  const [tab, setTab] = useState('modelos')

  return (
    <div className="doc-wrap">
      <Style />
      <div className="doc-head">
        <h1>Documentos</h1>
      </div>

      <div className="doc-tabs">
        {[['modelos', 'Modelos'], ['ia', 'Redacción con IA'], ['admin', 'Administrar modelos']].map(([k, lbl]) => (
          <button key={k} className={'doc-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{lbl}</button>
        ))}
      </div>

      {tab === 'modelos' && <TabModelos causas={causas} modelos={modelos} irAdmin={() => setTab('admin')} />}
      {tab === 'ia'      && <TabIA causas={causas} />}
      {tab === 'admin'   && <TabAdmin modelos={modelos} />}
    </div>
  )
}

// ══════════════════ MODELOS ══════════════════
function TabModelos({ causas, modelos, irAdmin }) {
  const [sel, setSel] = useState(null)
  const [causaId, setCausaId] = useState('')
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [manual, setManual] = useState({})
  const [texto, setTexto] = useState('')

  const modelo = modelos.find(m => m.id === sel)
  const causa = causas.find(c => c.id === causaId)

  const manuales = useMemo(() => modelo ? varsManuales(modelo.texto) : [], [modelo])
  const usadas   = useMemo(() => modelo ? extraerVars(modelo.texto) : [], [modelo])

  const elegir = (m) => {
    setSel(m.id); setTexto(''); setManual({})
  }

  const generar = () => {
    if (!modelo) return
    const auto = resolverAuto(causa, fecha)
    setTexto(render(modelo.texto, { ...auto, ...manual }))
  }

  const volver = () => { setSel(null); setTexto(''); setManual({}) }

  if (!modelo) {
    return (
      <>
        <p className="doc-intro">Escritos con estructura fija. Elegís la causa y el sistema completa los datos. Sin IA: exacto e instantáneo.</p>
        {modelos.length === 0 ? (
          <div className="doc-empty">
            <p>Todavía no cargaste ningún modelo.</p>
            <button className="doc-btn primary" onClick={irAdmin}>Cargar mi primer modelo</button>
          </div>
        ) : (
          <div className="doc-grid">
            {modelos.map(m => (
              <div key={m.id} className="doc-card" onClick={() => elegir(m)}>
                <div className="doc-card-name">{m.nombre}</div>
                {m.descripcion && <div className="doc-card-desc">{m.descripcion}</div>}
                <div className="doc-card-vars">{extraerVars(m.texto).length} variable{extraerVars(m.texto).length === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="doc-sub-head">
        <button className="doc-btn ghost" onClick={volver}>← Cambiar modelo</button>
        <span className="doc-sub-title">{modelo.nombre}</span>
      </div>

      <div className="doc-panel">
        <div className="doc-fields">
          <label className="doc-field">
            <span>Causa</span>
            <select value={causaId} onChange={e => setCausaId(e.target.value)}>
              <option value="">— Sin causa —</option>
              {causas.map(c => <option key={c.id} value={c.id}>{(c.caratula || '').substring(0, 60)}</option>)}
            </select>
            {causa && <em className="doc-hint">{causa.tribunal} · usa {causa.tribunal === 'SCBA' ? 'C.A.S.I. y domicilio de Vicente López' : 'C.P.A.C.F. y domicilio de CABA'}</em>}
          </label>
          <label className="doc-field">
            <span>Fecha</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
        </div>

        {manuales.length > 0 && (
          <>
            <div className="doc-sep">Datos a completar</div>
            <div className="doc-fields">
              {manuales.map(v => (
                <label key={v} className="doc-field">
                  <span>{v.replace(/_/g, ' ')}</span>
                  <input value={manual[v] ?? ''} onChange={e => setManual(m => ({ ...m, [v]: e.target.value }))}
                    placeholder={`{{${v}}}`} />
                </label>
              ))}
            </div>
          </>
        )}

        {usadas.length > 0 && (
          <div className="doc-vars-used">
            {usadas.map(v => (
              <span key={v} className={'doc-var' + (esAuto(v) ? ' auto' : '')}>{`{{${v}}}`}</span>
            ))}
          </div>
        )}

        <button className="doc-btn primary" style={{ marginTop: '1rem' }} onClick={generar}>Generar escrito</button>
      </div>

      {texto && <Editor texto={texto} setTexto={setTexto} nombre={`${modelo.nombre}${causa ? ' — ' + (causa.caratula || '').substring(0, 40) : ''}`} />}
    </>
  )
}

// ══════════════════ IA ══════════════════
function TabIA({ causas }) {
  const [sel, setSel] = useState(null)
  const [causaId, setCausaId] = useState('')
  const [fecha, setFecha] = useState(dateFmt(new Date()))
  const [instrucciones, setInstrucciones] = useState('')
  const [texto, setTexto] = useState('')
  const [gen, setGen] = useState(false)

  const causa = causas.find(c => c.id === causaId)

  const generar = async () => {
    setGen(true); setTexto('')
    const pl = PLANTILLAS[sel]
    const auto = resolverAuto(causa, fecha)
    let ctx = `Fecha: ${auto.fecha_larga}\nAbogado: Dr. ${auto.abogado} (CUIT ${auto.cuit})\n`
    ctx += `Matrícula: ${auto.matricula}\nDomicilio constituido: ${auto.domicilio}\nDomicilio electrónico: ${auto.domicilio_electronico}\n`
    if (causa) ctx += `Causa: ${auto.caratula}\nTribunal: ${auto.tribunal}\nFuero: ${auto.fuero || '—'}\nJuzgado: ${auto.juzgado || '—'}\nExpediente Nro: ${auto.nro || '—'}\nCliente: ${auto.cliente || '—'}\n`
    if (instrucciones) ctx += `Instrucciones adicionales: ${instrucciones}\n`

    const prompt = `${pl.prompt}\n\nDATOS DEL DOCUMENTO:\n${ctx}\n\nGenerá el documento completo listo para usar. Formato profesional argentino. Solo el texto del documento, sin explicaciones ni comentarios.`

    try {
      const res = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setTexto(data.content?.find(b => b.type === 'text')?.text || 'Error al generar.')
    } catch {
      setTexto('Error de conexión al generar el documento.')
    }
    setGen(false)
  }

  if (!sel) {
    return (
      <>
        <p className="doc-intro">Para lo que no es formulario: redacción abierta. La IA puede variar el texto, así que revisalo siempre antes de presentar.</p>
        <div className="doc-grid">
          {Object.entries(PLANTILLAS).map(([k, pl]) => (
            <div key={k} className="doc-card" onClick={() => { setSel(k); setTexto('') }}>
              <div className="doc-card-icon">{pl.icon}</div>
              <div className="doc-card-name">{pl.nombre}</div>
              <div className="doc-card-desc">{pl.desc}</div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="doc-sub-head">
        <button className="doc-btn ghost" onClick={() => { setSel(null); setTexto('') }}>← Cambiar tipo</button>
        <span className="doc-sub-title">{PLANTILLAS[sel].icon} {PLANTILLAS[sel].nombre}</span>
      </div>

      <div className="doc-panel">
        <div className="doc-fields">
          <label className="doc-field">
            <span>Causa</span>
            <select value={causaId} onChange={e => setCausaId(e.target.value)}>
              <option value="">— General —</option>
              {causas.map(c => <option key={c.id} value={c.id}>{(c.caratula || '').substring(0, 60)}</option>)}
            </select>
          </label>
          <label className="doc-field">
            <span>Fecha</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
          <label className="doc-field wide">
            <span>Instrucciones adicionales</span>
            <textarea rows="3" value={instrucciones} onChange={e => setInstrucciones(e.target.value)}
              placeholder="Ej: solicitar prórroga de 10 días hábiles, tono formal…" />
          </label>
        </div>
        <button className="doc-btn primary" style={{ marginTop: '1rem' }} onClick={generar} disabled={gen}>
          {gen ? 'Generando…' : '✨ Generar con IA'}
        </button>
      </div>

      {gen && <div className="doc-panel doc-gen">Generando documento…</div>}
      {!gen && texto && <Editor texto={texto} setTexto={setTexto} nombre={PLANTILLAS[sel].nombre} />}
    </>
  )
}

// ══════════════════ ADMIN ══════════════════
function TabAdmin({ modelos }) {
  const [edit, setEdit] = useState(null)   // objeto en edición
  const [busy, setBusy] = useState(false)

  const nuevo = () => setEdit({ id: uid(), nombre: '', descripcion: '', texto: '' })

  const guardar = async () => {
    if (!edit.nombre.trim()) return alert('Ponele un nombre al modelo.')
    setBusy(true)
    try {
      await saveModelo({ ...edit, nombre: edit.nombre.trim(), descripcion: edit.descripcion?.trim() || null })
      setEdit(null)
    } catch (e) { alert('Error: ' + (e.message || e)) }
    finally { setBusy(false) }
  }

  const borrar = async (m) => {
    if (!confirm(`¿Eliminar el modelo "${m.nombre}"?`)) return
    await deleteModelo(m.id)
  }

  if (edit) {
    const manuales = varsManuales(edit.texto)
    return (
      <>
        <div className="doc-sub-head">
          <button className="doc-btn ghost" onClick={() => setEdit(null)}>← Volver</button>
          <span className="doc-sub-title">{modelos.find(m => m.id === edit.id) ? 'Editar modelo' : 'Nuevo modelo'}</span>
        </div>

        <div className="doc-panel">
          <div className="doc-fields">
            <label className="doc-field">
              <span>Nombre *</span>
              <input value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })}
                placeholder="Ej: Aceptación de cargo" />
            </label>
            <label className="doc-field">
              <span>Descripción</span>
              <input value={edit.descripcion ?? ''} onChange={e => setEdit({ ...edit, descripcion: e.target.value })}
                placeholder="Opcional" />
            </label>
          </div>

          <label className="doc-field wide" style={{ marginTop: '1rem' }}>
            <span>Texto del modelo</span>
            <textarea className="doc-editor-ta" rows="18" value={edit.texto ?? ''}
              onChange={e => setEdit({ ...edit, texto: e.target.value })}
              placeholder={'Pegá acá el escrito y marcá los huecos con dobles llaves.\n\nEj:\n    IGNACIO ARIGÓS, abogado, {{matricula}}, constituyendo domicilio en {{domicilio}} y domicilio electrónico en {{domicilio_electronico}}, en autos "{{caratula}}", Expte. N° {{nro}}, ante V.S. digo:\n    Que vengo a aceptar el cargo de {{cargo}}...'} />
          </label>

          {edit.texto && manuales.length > 0 && (
            <div className="doc-vars-used" style={{ marginTop: '.6rem' }}>
              <span className="doc-vars-lbl">Te va a pedir:</span>
              {manuales.map(v => <span key={v} className="doc-var">{`{{${v}}}`}</span>)}
            </div>
          )}

          <div className="doc-ref">
            <div className="doc-ref-title">Variables que se completan solas</div>
            <div className="doc-ref-grid">
              {VARS_AUTO.map(v => (
                <div key={v.k} className="doc-ref-item">
                  <code>{`{{${v.k}}}`}</code><span>{v.d}</span>
                </div>
              ))}
            </div>
            <div className="doc-ref-note">
              Cualquier otra marca que escribas —por ejemplo <code>{'{{cargo}}'}</code>— se convierte en un campo para completar al generar.
              La matrícula, el domicilio y el domicilio electrónico cambian solos según el tribunal de la causa.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '1.2rem' }}>
            <button className="doc-btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="doc-btn primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar modelo'}</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="doc-sub-head">
        <span className="doc-sub-title">Mis modelos <em>{modelos.length}</em></span>
        <button className="doc-btn primary" onClick={nuevo}>＋ Nuevo modelo</button>
      </div>

      {modelos.length === 0 ? (
        <div className="doc-empty"><p>Todavía no cargaste ningún modelo.</p></div>
      ) : (
        <div className="doc-list">
          {modelos.map(m => (
            <div key={m.id} className="doc-row">
              <div style={{ flex: 1 }}>
                <div className="doc-row-name">{m.nombre}</div>
                {m.descripcion && <div className="doc-row-desc">{m.descripcion}</div>}
              </div>
              <span className="doc-row-vars">{extraerVars(m.texto).length} var.</span>
              <button className="doc-btn ghost sm" onClick={() => setEdit({ ...m })}>Editar</button>
              <button className="doc-del" onClick={() => borrar(m)}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ══════════════════ EDITOR + EXPORT ══════════════════
function Editor({ texto, setTexto, nombre }) {
  const pendientes = (texto.match(/\[\[[a-zA-Z0-9_]+\]\]/g) || [])
  const copiar = async () => { await navigator.clipboard.writeText(texto) }

  return (
    <div className="doc-panel" style={{ marginTop: '1.1rem' }}>
      <div className="doc-editor-head">
        <span className="doc-sub-title">Documento</span>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="doc-btn ghost sm" onClick={copiar}>📋 Copiar</button>
          <button className="doc-btn pdf sm" onClick={() => descargarPdf(texto, nombre)}>⬇ PDF</button>
          <button className="doc-btn primary sm" onClick={() => descargarWord(texto, nombre)}>⬇ Word</button>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="doc-warn">
          Quedaron datos sin completar: {[...new Set(pendientes)].join(' ')} — corregilos antes de presentar.
        </div>
      )}

      <textarea className="doc-editor-ta" value={texto} onChange={e => setTexto(e.target.value)} rows="22" />
      <div className="doc-hint" style={{ display: 'block', marginTop: '.5rem' }}>
        Podés editar el texto acá mismo antes de exportarlo.
      </div>
    </div>
  )
}

// ── Estilos ──
function Style() {
  return (
    <style>{`
    .doc-wrap {
      --g:#c9a24b; --g-dim:#a9853a;
      --panel:#24201a; --input:#322d23; --input-b:#4a4234;
      --txt:#f0ece2; --muted:#a49a88; --line:#39332a; --danger:#c9603f;
      padding:1.25rem 1.5rem 4rem; font-family:'IBM Plex Mono', monospace; color:var(--txt);
      max-width:960px; margin:0 auto;
    }
    .doc-head { margin-bottom:1.1rem; }
    .doc-head h1 { font-family:'Fraunces', serif; font-size:1.7rem; margin:0; color:var(--g); }
    .doc-intro { font-size:.8rem; color:var(--muted); margin:0 0 1.1rem; line-height:1.6; }

    .doc-tabs { display:flex; gap:.3rem; border-bottom:2px solid var(--g); margin-bottom:1.25rem; padding-left:.4rem; }
    .doc-tab { background:rgba(0,0,0,.22); border:1px solid var(--line); border-bottom:none;
      border-radius:9px 9px 0 0; color:var(--muted); padding:.6rem 1.4rem; cursor:pointer;
      font-family:inherit; font-size:.82rem; position:relative; top:2px; transition:all .15s; }
    .doc-tab:hover { color:var(--txt); background:rgba(0,0,0,.35); }
    .doc-tab.on { background:var(--panel); border-color:var(--g); border-top-width:3px; color:var(--g); font-weight:600; top:0; padding-bottom:.7rem; }

    .doc-btn { border:1px solid var(--input-b); background:transparent; color:var(--txt);
      padding:.55rem 1rem; border-radius:8px; cursor:pointer; font-family:inherit; font-size:.82rem; transition:all .15s; }
    .doc-btn:hover { border-color:var(--g); }
    .doc-btn.primary { background:var(--g); color:#1c1811; border-color:var(--g); font-weight:600; }
    .doc-btn.primary:hover { background:var(--g-dim); }
    .doc-btn.pdf { border-color:var(--g); color:var(--g); background:rgba(201,162,75,.06); font-weight:600; }
    .doc-btn.pdf:hover { background:var(--g); color:#1c1811; }
    .doc-btn.sm { padding:.35rem .7rem; font-size:.72rem; }
    .doc-btn:disabled { opacity:.5; cursor:default; }

    .doc-sub-head { display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-bottom:1rem; flex-wrap:wrap; }
    .doc-sub-title { font-family:'Fraunces', serif; font-size:1.05rem; color:var(--g); }
    .doc-sub-title em { font-style:normal; font-family:'IBM Plex Mono', monospace; font-size:.72rem; color:var(--muted); margin-left:.4rem; }

    .doc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.9rem; }
    .doc-card { background:var(--panel); border:1px solid var(--line); border-left:3px solid var(--g);
      border-radius:10px; padding:1rem; cursor:pointer; transition:all .15s; }
    .doc-card:hover { border-color:var(--g); transform:translateY(-2px); }
    .doc-card-icon { font-size:1.4rem; margin-bottom:.4rem; }
    .doc-card-name { font-size:.9rem; margin-bottom:.3rem; }
    .doc-card-desc { font-size:.7rem; color:var(--muted); line-height:1.5; }
    .doc-card-vars { font-size:.65rem; color:var(--g); margin-top:.5rem; opacity:.8; }

    .doc-list { display:flex; flex-direction:column; gap:.5rem; }
    .doc-row { display:flex; align-items:center; gap:.8rem; background:var(--panel); border:1px solid var(--line);
      border-left:3px solid var(--g); border-radius:9px; padding:.7rem .9rem; }
    .doc-row-name { font-size:.88rem; }
    .doc-row-desc { font-size:.7rem; color:var(--muted); margin-top:.2rem; }
    .doc-row-vars { font-size:.68rem; color:var(--muted); }
    .doc-del { background:none; border:none; color:var(--danger); cursor:pointer; font-size:.8rem; }

    .doc-empty { color:var(--muted); text-align:center; padding:2.5rem 0; }
    .doc-empty p { margin:0 0 1rem; font-size:.85rem; }

    .doc-panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:1.1rem 1.2rem; }
    .doc-gen { color:var(--muted); font-size:.82rem; text-align:center; }
    .doc-fields { display:grid; grid-template-columns:repeat(2,1fr); gap:.9rem 1.1rem; }
    .doc-field { display:flex; flex-direction:column; gap:.35rem; font-size:.7rem; }
    .doc-field.wide { grid-column:1 / -1; }
    .doc-field > span { color:var(--muted); text-transform:uppercase; letter-spacing:.05em; font-size:.66rem; }
    .doc-field input, .doc-field select, .doc-field textarea {
      background:var(--input); border:1px solid var(--input-b); color:var(--txt);
      padding:.55rem .7rem; border-radius:8px; font-family:inherit; font-size:.88rem; }
    .doc-field input:focus, .doc-field select:focus, .doc-field textarea:focus {
      outline:none; border-color:var(--g); box-shadow:0 0 0 3px rgba(201,162,75,.15); }
    .doc-field select { cursor:pointer; color-scheme:dark; }
    .doc-hint { font-style:normal; font-size:.62rem; color:var(--muted); opacity:.8; margin-top:.2rem; }

    .doc-sep { font-size:.66rem; color:var(--muted); text-transform:uppercase; letter-spacing:.08em;
      margin:1.1rem 0 .7rem; padding-bottom:.4rem; border-bottom:1px solid var(--line); }

    .doc-vars-used { display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; margin-top:1rem; }
    .doc-vars-lbl { font-size:.66rem; color:var(--muted); margin-right:.2rem; }
    .doc-var { font-size:.66rem; padding:.15rem .45rem; border-radius:4px; background:rgba(164,154,136,.14); color:var(--muted); }
    .doc-var.auto { background:rgba(201,162,75,.16); color:var(--g); }

    .doc-ref { margin-top:1.2rem; border:1px solid var(--line); border-radius:10px; padding:.9rem 1rem; background:rgba(0,0,0,.18); }
    .doc-ref-title { font-size:.68rem; color:var(--g); text-transform:uppercase; letter-spacing:.06em; margin-bottom:.7rem; }
    .doc-ref-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:.35rem .9rem; }
    .doc-ref-item { display:flex; gap:.5rem; align-items:baseline; font-size:.68rem; color:var(--muted); }
    .doc-ref-item code { color:var(--g); font-family:inherit; font-size:.68rem; white-space:nowrap; }
    .doc-ref-note { font-size:.66rem; color:var(--muted); line-height:1.6; margin-top:.8rem;
      padding-top:.7rem; border-top:1px solid var(--line); }
    .doc-ref-note code { color:var(--g); font-family:inherit; }

    .doc-editor-head { display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-bottom:.8rem; flex-wrap:wrap; }
    .doc-editor-ta { width:100%; box-sizing:border-box; background:var(--input); border:1px solid var(--input-b);
      color:var(--txt); padding:1rem; border-radius:8px; font-family:'IBM Plex Mono', monospace;
      font-size:.82rem; line-height:1.7; resize:vertical; }
    .doc-editor-ta:focus { outline:none; border-color:var(--g); box-shadow:0 0 0 3px rgba(201,162,75,.15); }

    .doc-warn { background:rgba(201,96,63,.12); border:1px solid rgba(201,96,63,.4); color:#e0917c;
      border-radius:8px; padding:.6rem .8rem; font-size:.72rem; margin-bottom:.8rem; line-height:1.5; }

    @media (max-width:640px) { .doc-fields { grid-template-columns:1fr; } }
    `}</style>
  )
}
