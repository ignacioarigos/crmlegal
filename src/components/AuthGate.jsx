import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'   // ← confirmá el nombre del export (ver nota)
import Login from '../screens/Login.jsx'

// Contexto de sesión: cualquier componente puede saber quién está logueado.
//   const { user, perfil, logout } = useSesion()
//   perfil = { codigo: 'N' | 'R', nombre: '...' }
const SesionCtx = createContext(null)
export const useSesion = () => useContext(SesionCtx)

export default function AuthGate({ children }) {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)

  // Sesión inicial + escucha de cambios (login / logout / refresh de token)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSesion(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cuando hay sesión, traigo el perfil (código N/R y nombre) desde crm_usuarios
  useEffect(() => {
    if (!sesion?.user) { setPerfil(null); return }
    supabase
      .from('crm_usuarios')
      .select('codigo, nombre')
      .eq('id', sesion.user.id)
      .single()
      .then(({ data }) => setPerfil(data || null))
  }, [sesion])

  const logout = () => supabase.auth.signOut()

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
