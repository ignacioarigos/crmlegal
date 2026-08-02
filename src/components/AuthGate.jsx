import { createContext, useContext, useEffect, useState } from 'react'
import { getSession, initSesion, onAuthChange, signOut, miPerfil } from '../lib/supabase.js'
import Login from '../screens/Login.jsx'

// Contexto de sesión: cualquier componente sabe quién está logueado.
//   const { user, perfil, logout } = useSesion()
//   perfil = { codigo: 'N' | 'R', nombre: '...' }
const SesionCtx = createContext(null)
export const useSesion = () => useContext(SesionCtx)

export default function AuthGate({ children }) {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)

  // Arranque: valida/refresca la sesión guardada y escucha cambios
  useEffect(() => {
    let unsub = () => {}
    initSesion().then((s) => {
      setSesion(s || getSession())
      setCargando(false)
      unsub = onAuthChange((ns) => setSesion(ns))
    })
    return () => unsub()
  }, [])

  // Con sesión, traigo el perfil (código N/R y nombre)
  useEffect(() => {
    if (!sesion) { setPerfil(null); return }
    miPerfil().then(setPerfil).catch(() => setPerfil(null))
  }, [sesion])

  const logout = async () => { await signOut() }  // onAuthChange limpia la sesión

  if (cargando) {
    return (
      <div className="db-loading">
        <div className="logo">EA</div>
        <div className="spinner" />
        <div className="msg">Cargando…</div>
      </div>
    )
  }

  if (!sesion) return <Login />

  return (
    <SesionCtx.Provider value={{ user: sesion.user, perfil, logout }}>
      {children}
    </SesionCtx.Provider>
  )
}
