// src/lib/recibo.js
import { fmtF } from './supabase.js'

// ╔══════════════════════════════════════════════════════════════╗
// ║  TUS DATOS — encabezado del recibo                            ║
// ╚══════════════════════════════════════════════════════════════╝
export const MIS_DATOS = {
  nombre:    'Ignacio Arigós',
  subtitulo: 'Abogado',
  // Separamos las matrículas usando un salto de línea HTML <br>
  matriculas: 'T° 120  F° 824  —  C.P.A.C.F.<br>T° LVII  F° 344  —  C.A.S.I.',

  // Domicilio y lugar de emisión según el TRIBUNAL de la causa (campo causa.tribunal)
  // Corregimos la entidad "&quot;" para usar comillas dobles comunes o tipográficas directamente
  domicilios: {
    PJN:  { dir: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.',        lugar: 'C.A.B.A.' },
    SCBA: { dir: 'Adolfo Alsina N° 1.756, Florida, Vicente López.',   lugar: 'Vicente López' },
    EJE:  { dir: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.',        lugar: 'C.A.B.A.' }, 
  },
  defaultTribunal: 'PJN',   // cuando el cobro/pago no tiene causa asociada
}
// ────────────────────────────────────────────────────────────────

// Número correlativo
export function nextReciboNro(items) {
  const max = (items || []).reduce((m, x) => {
    const n = parseInt(x?.recibo_nro, 10)
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return max + 1
}
export function fmtNro(prefijo, n) {
  return `${prefijo}-${String(n).padStart(4, '0')}`
}

// ── Monto en letras ─────────────────────────────────────────────
const UNIDADES = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
  'once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte',
  'veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve']
const DECENAS  = ['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']
const CENTENAS = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos']
function apocope(p) { return p.replace(/veintiuno$/, 'veintiún').replace(/\buno$/, 'un') }
function menor1000(n) {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  let out = ''
  const c = Math.floor(n / 100), r = n % 100
  if (c > 0) out += CENTENAS[c]
  if (r > 0) {
    if (out) out += ' '
    if (r < 30) out += UNIDADES[r]
    else { const d = Math.floor(r / 10), u = r % 10; out += DECENAS[d] + (u > 0 ? ' y ' + UNIDADES[u] : '') }
  }
  return out
}
export function numeroALetras(n) {
  n = Math.floor(Math.abs(n || 0))
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1000000), miles = Math.floor((n % 1000000) / 1000), cientos = n % 1000
  let out = ''
  if (millones > 0) out += (millones === 1 ? 'un millón' : apocope(numeroALetras(millones)) + ' millones')
  if (miles > 0)    out += (out ? ' ' : '') + (miles === 1 ? 'mil' : apocope(menor1000(miles)) + ' mil')
  if (cientos > 0)  out += (out ? ' ' : '') + menor1000(cientos)
  return out.trim()
}
export function montoEnLetras(monto, moneda = 'ARS') {
  const m = Math.abs(monto || 0), entero = Math.floor(m), cent = Math.round((m - entero) * 100)
  const nombre = moneda === 'USD'
    ? (entero === 1 ? 'dólar estadounidense' : 'dólares estadounidenses')
    : (entero === 1 ? 'peso' : 'pesos')
  const usaDe = entero >= 1000000 && entero % 1000000 === 0
  const letras = apocope(numeroALetras(entero))
  const frase = `${letras}${usaDe ? ' de' : ''} ${nombre} con ${String(cent).padStart(2, '0')}/100`
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}
// ────────────────────────────────────────────────────────────────

export function imprimirRecibo({ tipo, nroFmt, fecha, monto, moneda = 'ARS', concepto, tribunal }) {
  const esCobro  = tipo === 'cobro'
  const simbolo  = moneda === 'USD' ? 'U$S' : '$'
  const montoTxt = `${simbolo} ${(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const letrasTxt = montoEnLetras(monto, moneda)
  const intro = esCobro ? 'Recibí la suma de:' : 'Se deja constancia del pago de la suma de:'
  const firmaLabel = esCobro ? MIS_DATOS.nombre : 'Recibí conforme  —  firma y aclaración'

  const dom = MIS_DATOS.domicilios[tribunal] || MIS_DATOS.domicilios[MIS_DATOS.defaultTribunal]
  const fechaTxt = fecha ? fmtF(fecha) : fmtF(new Date().toISOString().slice(0, 10))

  const w = window.open('', '_blank')
  if (!w) { alert('El navegador bloqueó la ventana del recibo. Permití las ventanas emergentes para este sitio.'); return }

  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${nroFmt}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body { 
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    color: #222; 
    margin: 0; 
    font-size: 13px; 
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .doc { 
    max-width: 680px; 
    margin: 0 auto; 
    border: 1px solid #333; 
    background: #fff;
  }

  /* Encabezado: Añadimos flexbox vertical para centrar el bloque izquierdo */
  .top { display: flex; align-items: stretch; border-bottom: 1px solid #333; background: #fafafa; }
  
  /* Ajuste de alineación centralizada para tus datos */
  .col-em { 
    flex: 1.2; 
    padding: 18px 20px; 
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center; 
  }
  
  .box-tipo { 
    width: 55px; 
    border-left: 1px solid #333; 
    border-right: 1px solid #333;
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
    background: #fff;
  }
  .box-tipo .big { font-size: 28px; font-weight: 800; color: #000; line-height: 1; }
  .box-tipo .sub { font-size: 7px; letter-spacing: .12em; margin-top: 4px; color: #555; font-weight: bold; }
  
  .col-r { flex: 0.8; padding: 18px 20px; background: #fff; }

  /* Datos del Emisor */
  .em-nom { font-size: 18px; font-weight: 700; color: #111; letter-spacing: -0.02em; }
  .em-sub { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; margin-top: 3px; color: #666; font-weight: 600; }
  .em-mat { font-size: 10px; margin-top: 10px; line-height: 1.5; color: #444; }
  .em-dom { font-size: 10.5px; margin-top: 6px; color: #444; }

  /* Datos del Recibo */
  .r-tit  { font-size: 16px; font-weight: 700; letter-spacing: .15em; color: #111; text-transform: uppercase; }
  .r-meta { font-size: 11.5px; margin-top: 10px; line-height: 1.8; color: #333; }
  .r-meta .v { font-weight: 600; color: #000; }

  /* Cuerpo del documento */
  .body { padding: 32px 28px; font-family: Georgia, serif; }
  .intro { font-size: 13px; color: #444; font-style: italic; margin-bottom: 12px; }
  
  .imp-box { 
    display: inline-block; 
    background: #f3f4f6; 
    border: 1px solid #333; 
    padding: 10px 22px; 
    font-size: 24px; 
    font-weight: bold; 
    font-family: system-ui, sans-serif;
    letter-spacing: -0.01em;
  }
  .imp-box .mon { font-size: 12px; font-weight: 500; margin-left: 8px; color: #555; }
  
  .letras { font-size: 13px; font-style: italic; margin: 12px 0 28px; color: #222; }
  
  /* Concepto: Ajustado para centrar etiquetas y contenidos */
  .concepto-container { text-align: center; margin-top: 15px; }
  .concepto-k { font-size: 12px; color: #555; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.05em; }
  .concepto-v { 
    font-size: 15px; 
    font-weight: bold; 
    font-family: system-ui, sans-serif;
    border-bottom: 1px dotted #999; 
    padding-bottom: 6px; 
    margin: 6px auto 0 auto; 
    min-height: 28px; 
    color: #111;
    max-width: 85%;
  }
  
  .firma { margin-top: 90px; text-align: center; }
  .firma .fl { 
    border-top: 1px solid #444; 
    width: 260px; 
    margin: 0 auto; 
    padding-top: 8px; 
    font-size: 11px; 
    font-family: system-ui, sans-serif;
    color: #333;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
</style></head><body><div class="doc">

  <div class="top">
    <div class="col-em">
      <div class="em-nom">${MIS_DATOS.nombre}</div>
      <div class="em-sub">${MIS_DATOS.subtitulo || ''}</div>
      <div class="em-mat">${MIS_DATOS.matriculas || ''}</div>
      <div class="em-dom">${dom.dir}</div>
    </div>
    <div class="box-tipo">
      <div class="big">R</div>
      <div class="sub">RECIBO</div>
    </div>
    <div class="col-r">
      <div class="r-tit">RECIBO</div>
      <div class="r-meta">
        N°: <span class="v">${nroFmt}</span><br>
        Fecha: <span class="v">${fechaTxt}</span><br>
        Lugar: <span class="v">${dom.lugar}</span>
      </div>
    </div>
  </div>

  <div class="body">
    <div class="intro">${intro}</div>
    <div class="imp-box">${montoTxt}<span class="mon">(${moneda})</span></div>
    <div class="letras">Son ${letrasTxt}.</div>

    <div class="concepto-container">
      <div class="concepto-k">En concepto de:</div>
      <div class="concepto-v">${concepto || '—'}</div>
    </div>

    <div class="firma"><div class="fl">${firmaLabel}</div></div>
  </div>

</div></body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 350)
}
