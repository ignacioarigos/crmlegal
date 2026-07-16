import { useState, useCallback } from 'react'
import { DB, uid, dateFmt, TRAMITES_DEFAULT } from '../lib/supabase.js'

// Estado global simple sin librería externa
let _state = {
  tareas: [], causas: [], registros: [], gastos: [],
  eventos: [], tramites: [], cobros: [],
  siniestros: [], siniestro_docs: [], aseguradoras: [],
  siniestro_novedades: [], siniestro_ofertas: [], modelos: [],
  loaded: false,
}
let _listeners = []

function notify() { _listeners.forEach(fn => fn({ ..._state })) }

export function getState() { return _state }

export function useStore() {
  const [state, setState] = useState({ ..._state })
  const listener = useCallback((s) => setState(s), [])

  // Suscribir al montar
  if (!_listeners.includes(listener)) _listeners.push(listener)

  return state
}

export function unsubscribe(listener) {
  _listeners = _listeners.filter(l => l !== listener)
}

// ── Carga inicial ──────────────────────────────────────────────
export async function loadAll() {
  // 1) Tablas base: si estas fallan, la app no puede funcionar
  const [t, c, r, g, e, tr, co] = await Promise.all([
    DB.get('crm_tareas'), DB.get('crm_causas'), DB.get('crm_registros'),
    DB.get('crm_gastos'), DB.get('crm_eventos'), DB.get('crm_tramites'),
    DB.get('crm_cobros'),
  ])
  _state.tareas    = t  || []
  _state.causas    = c  || []
  _state.registros = r  || []
  _state.gastos    = g  || []
  _state.eventos   = e  || []
  _state.cobros    = co || []
  if (!tr || tr.length === 0) {
    await seedTramites()
  } else {
    _state.tramites = tr
  }

  // 2) Módulo Siniestros + modelos (defensivo: no debe romper loadAll si falla)
  try {
    const [s, sd, ag, nv, of, md] = await Promise.all([
      DB.get('crm_siniestros'), DB.get('crm_siniestro_docs'), DB.get('crm_aseguradoras'),
      DB.get('crm_siniestro_novedades'), DB.get('crm_siniestro_ofertas'), DB.get('crm_modelos'),
    ])
    _state.siniestros          = s  || []
    _state.siniestro_docs      = sd || []
    _state.aseguradoras        = ag || []
    _state.siniestro_novedades = nv || []
    _state.siniestro_ofertas   = of || []
    _state.modelos             = md || []
  } catch {
    _state.siniestros          = _state.siniestros || []
    _state.siniestro_docs      = _state.siniestro_docs || []
    _state.aseguradoras        = _state.aseguradoras || []
    _state.siniestro_novedades = _state.siniestro_novedades || []
    _state.siniestro_ofertas   = _state.siniestro_ofertas || []
    _state.modelos             = _state.modelos || []
  }

  _state.loaded = true
  notify()
}

async function seedTramites() {
  for (const t of TRAMITES_DEFAULT) {
    try { await DB.insert('crm_tramites', { id: t.id, nombre: t.n, precio: t.p, orden: TRAMITES_DEFAULT.indexOf(t) }) } catch {}
  }
  _state.tramites = await DB.get('crm_tramites')
}

// ── Tareas ────────────────────────────────────────────────────
export async function saveTarea(obj) {
  const exists = _state.tareas.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_tareas', obj.id, obj)
    _state.tareas = _state.tareas.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_tareas', obj)
    _state.tareas = [..._state.tareas, obj]
  }
  notify()
}

export async function deleteTarea(id) {
  await DB.delete('crm_tareas', id)
  _state.tareas = _state.tareas.filter(x => x.id !== id)
  notify()
}

export async function patchTarea(id, patch) {
  await DB.update('crm_tareas', id, patch)
  _state.tareas = _state.tareas.map(x => x.id === id ? { ...x, ...patch } : x)
  notify()
}

// ── Registros ─────────────────────────────────────────────────
export async function saveRegistro(obj) {
  await DB.insert('crm_registros', obj)
  _state.registros = [..._state.registros, obj]
  notify()
}

export async function updateRegistro(id, patch) {
  await DB.update('crm_registros', id, patch)
  _state.registros = _state.registros.map(x => x.id === id ? { ...x, ...patch } : x)
  notify()
}

export async function deleteRegistro(id) {
  await DB.delete('crm_registros', id)
  _state.registros = _state.registros.filter(x => x.id !== id)
  notify()
}

// ── Gastos ────────────────────────────────────────────────────
export async function saveGasto(obj) {
  const exists = _state.gastos.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_gastos', obj.id, obj)
    _state.gastos = _state.gastos.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_gastos', obj)
    _state.gastos = [..._state.gastos, obj]
  }
  notify()
}

export async function deleteGasto(id) {
  await DB.delete('crm_gastos', id)
  _state.gastos = _state.gastos.filter(x => x.id !== id)
  notify()
}

// ── Causas ────────────────────────────────────────────────────
export async function saveCausa(obj) {
  const exists = _state.causas.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_causas', obj.id, obj)
    _state.causas = _state.causas.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_causas', obj)
    _state.causas = [..._state.causas, obj]
  }
  notify()
}

export async function deleteCausa(id) {
  await Promise.all([
    DB.delete('crm_causas', id),
    DB.deleteWhere('crm_registros', 'causa', id),
    DB.deleteWhere('crm_gastos', 'causa', id),
    DB.deleteWhere('crm_cobros', 'causa', id),
  ])
  _state.causas    = _state.causas.filter(x => x.id !== id)
  _state.registros = _state.registros.filter(x => x.causa !== id)
  _state.gastos    = _state.gastos.filter(x => x.causa !== id)
  _state.cobros    = _state.cobros.filter(x => x.causa !== id)
  notify()
}

// ── Cobros ────────────────────────────────────────────────────
export async function saveCobro(obj) {
  const exists = _state.cobros.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_cobros', obj.id, obj)
    _state.cobros = _state.cobros.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_cobros', obj)
    _state.cobros = [..._state.cobros, obj]
  }
  notify()
}

export async function deleteCobro(id) {
  await DB.delete('crm_cobros', id)
  _state.cobros = _state.cobros.filter(x => x.id !== id)
  notify()
}

// ── Eventos ───────────────────────────────────────────────────
export async function saveEvento(obj) {
  await DB.insert('crm_eventos', obj)
  _state.eventos = [..._state.eventos, obj]
  notify()
}

// ── Trámites ──────────────────────────────────────────────────
export async function updateTramite(id, patch) {
  await DB.update('crm_tramites', id, patch)
  _state.tramites = _state.tramites.map(x => x.id === id ? { ...x, ...patch } : x)
  notify()
}

export async function deleteTramite(id) {
  await DB.delete('crm_tramites', id)
  _state.tramites = _state.tramites.filter(x => x.id !== id)
  notify()
}

export async function addTramite(obj) {
  await DB.insert('crm_tramites', obj)
  _state.tramites = [..._state.tramites, obj]
  notify()
}

export async function resetTramites() {
  for (const t of _state.tramites) try { await DB.delete('crm_tramites', t.id) } catch {}
  _state.tramites = []
  await seedTramites()
  notify()
}

// ── Siniestros ────────────────────────────────────────────────
const WORKER = 'https://crmproxy.ignacioarigos.workers.dev'

export async function saveSiniestro(obj) {
  const exists = _state.siniestros.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_siniestros', obj.id, obj)
    _state.siniestros = _state.siniestros.map(x => x.id === obj.id ? obj : x)
  } else {
    if (obj.carpeta_nro == null) {
      obj.carpeta_nro = _state.siniestros.reduce((m, s) => Math.max(m, s.carpeta_nro || 0), 0) + 1
    }
    await DB.insert('crm_siniestros', obj)
    _state.siniestros = [..._state.siniestros, obj]
  }
  notify()
  return obj
}

export async function deleteSiniestro(id) {
  // borro los archivos del bucket primero (para no dejar huérfanos en Storage)
  const docs = _state.siniestro_docs.filter(d => d.siniestro_id === id)
  for (const d of docs) { try { await deleteDoc(d.id, d.storage_path) } catch {} }
  await DB.delete('crm_siniestros', id)
  _state.siniestros = _state.siniestros.filter(x => x.id !== id)
  // las novedades y ofertas caen solas por el ON DELETE CASCADE
  _state.siniestro_novedades = _state.siniestro_novedades.filter(n => n.siniestro_id !== id)
  _state.siniestro_ofertas   = _state.siniestro_ofertas.filter(o => o.siniestro_id !== id)
  notify()
}

// ── Documentación (pasa por el Worker, NO por la anon key) ──────
export async function uploadDoc(file, siniestroId, categoria) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('siniestro_id', siniestroId)
  fd.append('categoria', categoria)
  const r = await fetch(`${WORKER}/siniestros/upload`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  const row = await r.json()
  _state.siniestro_docs = [..._state.siniestro_docs, row]
  notify()
  return row
}

export async function getDocUrl(storage_path) {
  const r = await fetch(`${WORKER}/siniestros/signed-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storage_path }),
  })
  const { url } = await r.json()
  return url
}

export async function deleteDoc(id, storage_path) {
  await fetch(`${WORKER}/siniestros/delete-doc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, storage_path }),
  })
  _state.siniestro_docs = _state.siniestro_docs.filter(d => d.id !== id)
  notify()
}

// ── Aseguradoras (memoria de contactos) ───────────────────────
const _norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function findAseguradora(nombre) {
  if (!nombre) return null
  const k = _norm(nombre)
  return _state.aseguradoras.find(a => _norm(a.nombre) === k) || null
}

// Guarda lo que falte: si la aseguradora no existe la crea, y completa
// solo los campos de contacto que estén vacíos (no pisa lo ya cargado).
export async function syncAseguradora(nombre, datos = {}) {
  if (!nombre || !nombre.trim()) return
  const campos = ['telefono', 'domicilio', 'contacto', 'mail', 'cuit']
  const found = findAseguradora(nombre)
  if (found) {
    const patch = {}
    for (const k of campos) if (datos[k] && !found[k]) patch[k] = datos[k]
    if (!Object.keys(patch).length) return
    await DB.update('crm_aseguradoras', found.id, patch)
    _state.aseguradoras = _state.aseguradoras.map(a => a.id === found.id ? { ...a, ...patch } : a)
  } else {
    const row = { id: uid(), nombre: nombre.trim() }
    for (const k of campos) if (datos[k]) row[k] = datos[k]
    await DB.insert('crm_aseguradoras', row)
    _state.aseguradoras = [..._state.aseguradoras, row]
  }
  notify()
}

// ── Seguimiento: novedades del siniestro ──────────────────────
export async function saveNovedad(obj) {
  const exists = _state.siniestro_novedades.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_siniestro_novedades', obj.id, obj)
    _state.siniestro_novedades = _state.siniestro_novedades.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_siniestro_novedades', obj)
    _state.siniestro_novedades = [..._state.siniestro_novedades, obj]
  }
  notify()
  return obj
}

export async function deleteNovedad(id) {
  await DB.delete('crm_siniestro_novedades', id)
  _state.siniestro_novedades = _state.siniestro_novedades.filter(x => x.id !== id)
  notify()
}

// ── Cierre: ofertas y contraofertas ───────────────────────────
export async function saveOferta(obj) {
  const exists = _state.siniestro_ofertas.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_siniestro_ofertas', obj.id, obj)
    _state.siniestro_ofertas = _state.siniestro_ofertas.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_siniestro_ofertas', obj)
    _state.siniestro_ofertas = [..._state.siniestro_ofertas, obj]
  }
  notify()
  return obj
}

export async function deleteOferta(id) {
  await DB.delete('crm_siniestro_ofertas', id)
  _state.siniestro_ofertas = _state.siniestro_ofertas.filter(x => x.id !== id)
  notify()
}

// Marca una oferta como aceptada y desmarca el resto del mismo siniestro
export async function aceptarOferta(siniestroId, ofertaId) {
  const mias = _state.siniestro_ofertas.filter(o => o.siniestro_id === siniestroId)
  for (const o of mias) {
    const debe = o.id === ofertaId
    if (!!o.aceptada === debe) continue
    await DB.update('crm_siniestro_ofertas', o.id, { aceptada: debe })
    _state.siniestro_ofertas = _state.siniestro_ofertas.map(x => x.id === o.id ? { ...x, aceptada: debe } : x)
  }
  notify()
}

// ── Modelos de escritos ───────────────────────────────────────
export async function saveModelo(obj) {
  const exists = _state.modelos.find(x => x.id === obj.id)
  if (exists) {
    await DB.update('crm_modelos', obj.id, obj)
    _state.modelos = _state.modelos.map(x => x.id === obj.id ? obj : x)
  } else {
    await DB.insert('crm_modelos', obj)
    _state.modelos = [..._state.modelos, obj]
  }
  notify()
  return obj
}

export async function deleteModelo(id) {
  await DB.delete('crm_modelos', id)
  _state.modelos = _state.modelos.filter(x => x.id !== id)
  notify()
}
