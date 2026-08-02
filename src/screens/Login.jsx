import { useState } from 'react'
import { signIn } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async () => {
    if (cargando) return
    setError(''); setCargando(true)
    try {
      await signIn(email.trim(), pass)
      // Si entra bien, AuthGate detecta la sesión y monta la app solo.
    } catch {
      setError('Correo o contraseña incorrectos.')
      setCargando(false)
    }
  }

  const onKey = (e) => { if (e.key === 'Enter') entrar() }

  return (
    <div className="lg-wrap">
      <style>{`
        .lg-wrap{
          min-height:100dvh; display:flex; align-items:center; justify-content:center;
          background:#F7F6F2; padding:24px; box-sizing:border-box;
          font-family:'IBM Plex Mono',monospace; color:#22272E;
        }
        .lg-card{
          width:100%; max-width:420px; background:#fff;
          border:1px solid #E3E1DA; border-radius:16px;
          padding:40px 32px; box-shadow:0 1px 2px rgba(31,77,63,.04), 0 12px 32px rgba(31,77,63,.06);
        }
        .lg-brand{
          font-family:'Fraunces',serif; font-weight:600; font-size:30px; line-height:1.1;
          color:#1F4D3F; letter-spacing:-.01em; margin:0 0 4px;
        }
        .lg-sub{ font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#8A8F87; margin:0 0 32px; }
        .lg-label{ display:block; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:#6B7280; margin:0 0 8px; }
        .lg-field{ margin-bottom:20px; }
        .lg-input{
          width:100%; box-sizing:border-box; height:54px; padding:0 16px;
          font-family:'IBM Plex Mono',monospace; font-size:16px; color:#22272E;
          background:#FBFBF9; border:1px solid #E3E1DA; border-radius:10px; outline:none;
          transition:border-color .15s, box-shadow .15s;
        }
        .lg-input:focus{ border-color:#1F4D3F; box-shadow:0 0 0 3px rgba(31,77,63,.12); background:#fff; }
        .lg-btn{
          width:100%; height:56px; margin-top:8px; border:0; border-radius:10px; cursor:pointer;
          font-family:'IBM Plex Mono',monospace; font-size:16px; font-weight:600; letter-spacing:.02em;
          color:#fff; background:#1F4D3F; transition:background .15s, transform .05s;
        }
        .lg-btn:hover:not(:disabled){ background:#173B31; }
        .lg-btn:active:not(:disabled){ transform:translateY(1px); }
        .lg-btn:disabled{ opacity:.6; cursor:default; }
        .lg-error{
          background:#FBEBEA; border:1px solid #F2CFCB; color:#9A3128;
          font-size:13px; border-radius:8px; padding:12px 14px; margin-bottom:20px;
        }
        .lg-foot{ text-align:center; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#B7BBB4; margin-top:28px; }
      `}</style>

      <div className="lg-card">
        <h1 className="lg-brand">Estudio Arigós</h1>
        <p className="lg-sub">Gestión Legal</p>

        {error && <div className="lg-error">{error}</div>}

        <div className="lg-field">
          <label className="lg-label" htmlFor="lg-email">Correo</label>
          <input
            id="lg-email" className="lg-input" type="email" inputMode="email"
            autoComplete="username" value={email} onKeyDown={onKey}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"
          />
        </div>

        <div className="lg-field">
          <label className="lg-label" htmlFor="lg-pass">Contraseña</label>
          <input
            id="lg-pass" className="lg-input" type="password"
            autoComplete="current-password" value={pass} onKeyDown={onKey}
            onChange={(e) => setPass(e.target.value)} placeholder="••••••••"
          />
        </div>

        <button className="lg-btn" onClick={entrar} disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="lg-foot">Acceso privado</p>
      </div>
    </div>
  )
}
