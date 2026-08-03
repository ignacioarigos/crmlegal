import { fmtF } from '../lib/supabase.js'
import { useSesion } from '../components/AuthGate.jsx'

// Línea profesional del encabezado, propia de cada abogado.
// Cada uno ve la suya; nunca los datos del otro.
const HERO_LINEA = {
  N: 'IGNACIO ARIGÓS — ABOGADO   |   TE: 11 5473-7787',
  R: 'RAMÓN E. J. ARIGÓS — ABOGADO',
}

export default function Home({ navigate, store }) {
  const { tareas, causas, registros, cobros } = store
  const { perfil } = useSesion()

  const primerNombre = perfil?.nombre?.split(' ')[0] || 'Doctor'
  const heroLinea = HERO_LINEA[perfil?.codigo] || ''

  const hoy = new Date().toDateString()
  const mes = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
  const pendientes  = tareas.filter(t => t.estado !== 'completada').length
  const urgentes    = tareas.filter(t => t.criticidad === 'urgente' && t.estado !== 'completada').length
  const regHoy      = registros.filter(r => new Date(r.fecha).toDateString() === hoy).length
  const arsMonth    = cobros.filter(c => c.fecha?.startsWith(mes) && (!c.moneda || c.moneda === 'ARS')).reduce((s,c)=>s+(c.monto||0),0)
  const usdMonth    = cobros.filter(c => c.fecha?.startsWith(mes) && c.moneda === 'USD').reduce((s,c)=>s+(c.monto||0),0)
  const cards = [
    { id:'tareas',     c:'c1', icon:'✅', title:'Tareas',     desc:'Gestión con prioridad, estado y archivo' },
    { id:'registro',   c:'c2', icon:'📋', title:'Registro',   desc:'Novedades PJN · SCBA · EJE con plazos' },
    { id:'gastos',     c:'c3', icon:'💰', title:'Gastos',     desc:'Planilla de gastos por causa' },
    { id:'causas',     c:'c4', icon:'📁', title:'Causas',     desc:'Expedientes con movimientos y gastos' },
    { id:'siniestros', c:'c5', icon:'🚗', title:'Siniestros', desc:'Carpetas de siniestros con documentación' },
    { id:'cobros',     c:'c6', icon:'💵', title:'Cobros',     desc:'Ingresos ARS y USD del estudio' },
    { id:'documentos', c:'c1', icon:'📄', title:'Documentos', desc:'Generador con IA + Google Drive' },
  ]
  return (
    <div>
      <div className="home-hero">
        <h1>Bienvenido,<br /><em>{primerNombre}</em></h1>
        {heroLinea && <p>{heroLinea}</p>}
      </div>
      <div className="home-grid">
        {cards.map(card => (
          <div key={card.id} className={`home-card ${card.c}`} onClick={() => navigate(card.id)}>
            <div className="home-card-icon">{card.icon}</div>
            <h2>{card.title}</h2>
            <p>{card.desc}</p>
          </div>
        ))}
      </div>
      <div className="home-stats">
        <div className="stat-item"><div className="stat-num">{pendientes}</div><div className="stat-label">Pendientes</div></div>
        <div className="stat-item"><div className="stat-num">{urgentes}</div><div className="stat-label">Urgentes</div></div>
        <div className="stat-item"><div className="stat-num">{causas.length}</div><div className="stat-label">Causas</div></div>
        <div className="stat-item"><div className="stat-num">{regHoy}</div><div className="stat-label">Registros hoy</div></div>
        <div className="stat-item"><div className="stat-num">${arsMonth.toLocaleString('es-AR')}</div><div className="stat-label">ARS este mes</div></div>
        <div className="stat-item"><div className="stat-num">U$S {usdMonth.toLocaleString('es-AR')}</div><div className="stat-label">USD este mes</div></div>
      </div>
    </div>
  )
}
