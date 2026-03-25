import { useState, useCallback } from 'react'
import { DB, uid, dateFmt, TRAMITES_DEFAULT } from '../lib/supabase.js'

// Estado global simple sin librería externa
let _state = {
  tareas: [], causas: [], registros: [], gastos: [],
  eventos: [], tramites: [], cobros: [],
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
