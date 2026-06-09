// src/lib/recibo.js
import { fmtF } from './supabase.js'

// ╔══════════════════════════════════════════════════════════════╗
// ║  TUS DATOS — COMPLETÁ ESTO UNA SOLA VEZ                        ║
// ║  (no sale nada del CRM; lo que pongas acá va en el encabezado) ║
// ╚══════════════════════════════════════════════════════════════╝
export const MIS_DATOS = {
  nombre:    'Dr. Ignacio Arigós',
  subtitulo: 'Abogado',
  matricula: 'T° XX  F° XXX  —  C.A.S.I.',        // ← completar
  domicilio: 'Domicilio del estudio, Localidad, Pcia. de Bs. As.', // ← completar
  cuit:      '',                                   // ← completar (opcional, dejar '' para ocultar)
  contacto:  '',                                   // ← Tel / email (opcional)
  localidad: 'San Isidro',                         // ← para la línea "Localidad, fecha"
}
// ────────────────────────────────────────────────────────────────

// Próximo número correlativo a partir de los registros existentes.
export function nextReciboNro(items) {
  const max = (items || []).reduce((m, x) => {
    const n = parseInt(x?.recibo_nro, 10)
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return max + 1
}

// Formatea el número: fmtNro('REC', 7) => 'REC-0007'
export function fmtNro(prefijo, n) {
  return `${prefijo}-${String(n).padStart(4, '0')}`
}

// ── Monto en letras ─────────────────────────────────────────────
const UNIDADES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
  'once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte',
  'veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve']
const DECENAS  = ['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']
const CENTENAS = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos']

// Apócope del "uno" final antes de un sustantivo: uno→un, veintiuno→veintiún
function apocope(palabras) {
  return palabras.replace(/veintiuno$/, 'veintiún').replace(/\buno$/, 'un')
}

function menor1000(n) {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  let out = ''
  const c = Math.floor(n / 100)
  const r = n % 100
  if (c > 0) out += CENTENAS[c]
  if (r > 0) {
    if (out) out += ' '
    if (r < 30) out += UNIDADES[r]
    else {
      const d = Math.floor(r / 10), u = r % 10
      out += DECENAS[d] + (u > 0 ? ' y ' + UNIDADES[u] : '')
    }
  }
  return out
}

export function numeroALetras(n) {
  n = Math.floor(Math.abs(n || 0))
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1000000)
  const miles    = Math.floor((n % 1000000) / 1000)
  const cientos  = n % 1000
  let out = ''
  if (millones > 0) out += (millones === 1 ? 'un millón' : apocope(numeroALetras(millones)) + ' millones')
  if (miles > 0)    out += (out ? ' ' : '') + (miles === 1 ? 'mil' : apocope(menor1000(miles)) + ' mil')
  if (cientos > 0)  out += (out ? ' ' : '') + menor1000(cientos)
  return out.trim()
}

export function montoEnLetras(monto, moneda = 'ARS') {
  const m = Math.abs(monto || 0)
  const entero = Math.floor(m)
  const cent = Math.round((m - entero) * 100)
  const nombre = moneda === 'USD'
    ? (entero === 1 ? 'dólar estadounidense' : 'dólares estadounidenses')
    : (entero === 1 ? 'peso' : 'pesos')
  const usaDe = entero >= 1000000 && entero % 1000000 === 0   // "un millón DE pesos"
  const letras = apocope(numeroALetras(entero))
  const frase = `${letras}${usaDe ? ' de' : ''} ${nombre} con ${String(cent).padStart(2, '0')}/100`
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}
// ────────────────────────────────────────────────────────────────

// Abre el recibo en una ventana nueva, listo para imprimir / guardar como PDF.
// tipo: 'cobro' | 'pago'
export function imprimirRecibo({ tipo, nroFmt, fecha, monto, moneda = 'ARS', concepto }) {
  const esCobro  = tipo === 'cobro'
  const simbolo  = moneda === 'USD' ? 'U$S' : '$'
  const montoTxt = `${simbolo} ${(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const letrasTxt = montoEnLetras(monto, moneda)
  const titulo   = esCobro ? 'RECIBO' : 'RECIBO DE PAGO'
  const introTxt = esCobro
    ? `Recibí la suma de <strong>${montoTxt}</strong> (${moneda}), en concepto de:`
    : `Se deja constancia del pago de la suma de <strong>${montoTxt}</strong> (${moneda}), en concepto de:`
  const firmaLabel = esCobro
    ? `${MIS_DATOS.nombre}${MIS_DATOS.matricula ? '  ·  ' + MIS_DATOS.matricula : ''}`
    : 'Recibí conforme  ·  firma y aclaración'

  const fechaTxt = `${MIS_DATOS.localidad ? MIS_DATOS.localidad + ', ' : ''}${fecha ? fmtF(fecha) : fmtF(new Date().toISOString().slice(0, 10))}`
  const cuitLine = MIS_DATOS.cuit ? `CUIT ${MIS_DATOS.cuit}` : ''
  const pieDatos = [cuitLine, MIS_DATOS.contacto].filter(Boolean).join('  ·  ')

  const w = window.open('', '_blank')
  if (!w) { alert('El navegador bloqueó la ventana del recibo. Permití las ventanas emergentes para este sitio.'); return }

  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${nroFmt}</title>
<style>
  @page { size: A4; margin: 22mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; }
  .doc { max-width: 720px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 30px; }
  .emisor .n { font-size: 20px; font-weight: bold; letter-spacing: .01em; }
  .emisor .s { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #555; margin-top: 2px; }
  .emisor .d { font-size: 11px; color: #555; margin-top: 8px; line-height: 1.6; }
  .rb { text-align: right; white-space: nowrap; }
  .rb .t   { font-size: 22px; font-weight: bold; letter-spacing: .14em; }
  .rb .nro { font-family: 'Courier New', monospace; font-size: 14px; margin-top: 6px; }
  .rb .fch { font-size: 11px; color: #555; margin-top: 6px; }
  .pill { display: inline-block; border: 2px solid #1a1a1a; border-radius: 6px;
          padding: 9px 20px; font-size: 21px; font-weight: bold; margin: 4px 0 6px; }
  .letras { font-size: 12px; font-style: italic; color: #444; margin: 0 0 24px; }
  .cuerpo { font-size: 15px; line-height: 1.9; }
  .concepto { margin-top: 8px; font-size: 16px; font-weight: bold;
              border-bottom: 1px solid #ccc; padding-bottom: 10px; min-height: 24px; }
  .linea { margin-top: 28px; font-size: 13px; }
  .linea .lbl { color: #555; }
  .linea .ln  { display: inline-block; border-bottom: 1px solid #999; min-width: 240px; }
  .firma { margin-top: 80px; text-align: center; }
  .firma .fl { border-top: 1px solid #1a1a1a; width: 300px; margin: 0 auto; padding-top: 8px; font-size: 12px; }
  .pie { margin-top: 44px; text-align: center; font-size: 10px; color: #999; line-height: 1.5; }
</style></head><body><div class="doc">
  <div class="head">
    <div class="emisor">
      <div class="n">${MIS_DATOS.nombre}</div>
      <div class="s">${MIS_DATOS.subtitulo || ''}</div>
      <div class="d">${MIS_DATOS.matricula || ''}<br>${MIS_DATOS.domicilio || ''}${pieDatos ? '<br>' + pieDatos : ''}</div>
    </div>
    <div class="rb">
      <div class="t">${titulo}</div>
      <div class="nro">N° ${nroFmt}</div>
      <div class="fch">${fechaTxt}</div>
    </div>
  </div>

  <div class="pill">${montoTxt}</div>
  <div class="letras">Son ${letrasTxt}.</div>

  <div class="cuerpo">
    ${introTxt}
    <div class="concepto">${concepto || '—'}</div>
  </div>

  <div class="linea"><span class="lbl">Forma de pago: </span><span class="ln">&nbsp;</span></div>

  <div class="firma"><div class="fl">${firmaLabel}</div></div>

  <div class="pie">Documento interno del estudio. No reemplaza la factura exigida por la normativa fiscal vigente.</div>
</div></body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 350)
}
