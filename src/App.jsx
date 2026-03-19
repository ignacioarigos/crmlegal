import { useState, useEffect, useRef } from 'react'
import { useStore, loadAll } from './lib/store.js'
import { fetchFeriados, dateFmt, MESES_CORTOS } from './lib/supabase.js'
import Sidebar from './components/Sidebar.jsx'
import Home from './screens/Home.jsx'
import Tareas from './screens/Tareas.jsx'
import Registro from './screens/Registro.jsx'
import Gastos from './screens/Gastos.jsx'
import Causas from './screens/Causas.jsx'
import CausaDetail from './screens/CausaDetail.jsx'
import Cobros from './screens/Cobros.jsx'
import Documentos from './screens/Documentos.jsx'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [causaDetailId, setCausaDetailId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dbOk, setDbOk] = useState(null) // null=loading, true, false
  const [syncState, setSyncState] = useState('idle') // idle | syncing | success | error
  const [lastSync, setLastSync] = useState(null)
  const syncTimer = useRef(null)
  const store = useStore()

  useEffect(() => {
    // Cargar feriados y datos
    const init = async () => {
      const y = new Date().getFullYear()
      fetchFeriados(y); fetchFeriados(y + 1)
      try {
        await loadAll()
        setDbOk(true)
        setLastSync(new Date())
        // Auto-sync cada 30s
        syncTimer.current = setInterval(autoSync, 30000)
      } catch {
        setDbOk(false)
      }
    }
    init()
    return () => clearInterval(syncTimer.current)
  }, [])

  const autoSync = async () => {
    try {
      await loadAll()
      setLastSync(new Date())
    } catch {}
  }

  const manualSync = async () => {
    setSyncState('syncing')
    try {
      await loadAll()
      setLastSync(new Date())
      setSyncState('success')
      setTimeout(() => setSyncState('idle'), 3000)
    } catch {
      setSyncState('error')
    }
  }

  const navigate = (s, cauId = null) => {
    setScreen(s)
    if (s === 'causa-detail' && cauId) setCausaDetailId(cauId)
    setSidebarOpen(false)
  }

  if (dbOk === null) {
    return (
      <div className="db-loading">
        <div className="logo">I|A</div>
        <div className="spinner" />
        <div className="msg">Conectando con la base de datos...</div>
      </div>
    )
  }

  if (!dbOk) {
    return (
      <div className="db-loading">
        <div className="logo">I|A</div>
        <p style={{ color: 'var(--urgent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '.85rem', textAlign: 'center' }}>
          No se pudo conectar.<br />Verificá tu conexión.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    )
  }

  return (
    <>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="app-logo">I|A <span>GESTIÓN LEGAL</span></div>
        </div>
        <div className="header-right">
          <div className="sync-controls">
            <div className={`sync-indicator ${syncState}`}>
              {syncState === 'syncing' && <><div className="sync-spinner" /><span>Sincronizando...</span></>}
              {syncState === 'success' && <span>✓ Sincronizado</span>}
              {syncState === 'error' && <span>⚠ Error</span>}
            </div>
            <button className="sync-btn" onClick={manualSync}>↻ <span>Sincronizar</span></button>
          </div>
          <div className="header-date">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="app-body">
        <Sidebar
          screen={screen}
          open={sidebarOpen}
          navigate={navigate}
          store={store}
          lastSync={lastSync}
          onSync={manualSync}
        />

        <main className="content">
          {screen === 'home'         && <Home navigate={navigate} store={store} />}
          {screen === 'tareas'       && <Tareas store={store} />}
          {screen === 'registro'     && <Registro store={store} />}
          {screen === 'gastos'       && <Gastos store={store} />}
          {screen === 'causas'       && <Causas navigate={navigate} store={store} />}
          {screen === 'causa-detail' && <CausaDetail id={causaDetailId} navigate={navigate} store={store} />}
          {screen === 'cobros'       && <Cobros store={store} />}
          {screen === 'documentos'   && <Documentos store={store} />}
        </main>
      </div>
    </>
  )
}
