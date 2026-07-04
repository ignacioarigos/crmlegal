// src/lib/recibo.js
import { fmtF } from './supabase.js'

// ╔══════════════════════════════════════════════════════════════╗
// ║  TUS DATOS — encabezado del recibo                            ║
// ╚══════════════════════════════════════════════════════════════╝
export const MIS_DATOS = {
  nombre:    'Ignacio Arigós',
  subtitulo: 'Abogado',
  matriculas: [
    'T° 120  F° 824  —  C.P.A.C.F.',
    'T° LVII  F° 344  —  C.A.S.I.',
  ],
  firmaSello: '/firma-sello.png',   // colocar el archivo en /public
  domicilios: {
    PJN:  { dir: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.',        lugar: 'C.A.B.A.' },
    SCBA: { dir: 'Adolfo Alsina N° 1.756, Florida, Vicente López.',   lugar: 'Vicente López' },
    EJE:  { dir: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.',        lugar: 'C.A.B.A.' },
  },
  defaultTribunal: 'PJN',
}
// ────────────────────────────────────────────────────────────────

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

const F = 'font-family:Arial,Helvetica,sans-serif;'
const PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf)
    const s = document.createElement('script')
    s.src = PDF_CDN
    s.onload = () => resolve(window.html2pdf)
    s.onerror = () => reject(new Error('No se pudo cargar el generador de PDF.'))
    document.head.appendChild(s)
  })
}
function preload(src) {
  return new Promise((resolve) => {
    if (!src) return resolve()
    const im = new Image()
    im.onload = im.onerror = () => resolve()
    im.src = src
  })
}

// Devuelve el HTML del recibo con TODOS los estilos en línea (nada depende de CSS externo).
function construir({ tipo, nroFmt, fecha, monto, moneda, concepto, tribunal }) {
  const esCobro  = tipo === 'cobro'
  const simbolo  = moneda === 'USD' ? 'U$S' : '$'
  const montoTxt = `${simbolo} ${(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const letrasTxt = montoEnLetras(monto, moneda)
  const banda = esCobro
    ? 'Recibí la suma que se detalla a continuación:'
    : 'Se deja constancia del pago según el siguiente detalle:'
  const dom = MIS_DATOS.domicilios[tribunal] || MIS_DATOS.domicilios[MIS_DATOS.defaultTribunal]
  const fechaTxt = fecha ? fmtF(fecha) : fmtF(new Date().toISOString().slice(0, 10))
  const nombreHead = `IA&nbsp;&nbsp;|&nbsp;&nbsp;${MIS_DATOS.nombre.toUpperCase()}`
  const matHtml = (MIS_DATOS.matriculas || []).map(m => `<div>${m}</div>`).join('')
  const firmaSrc = MIS_DATOS.firmaSello
    ? (MIS_DATOS.firmaSello.startsWith('http') ? MIS_DATOS.firmaSello : window.location.origin + MIS_DATOS.firmaSello)
    : ''

  // celdas del detalle
  const thBase = `${F}background:#ececec;color:#000;border:1px solid #000;padding:5px 8px;font-size:9px;text-transform:uppercase;letter-spacing:.04em;`
  const tdBase = `${F}color:#000;border-left:1px solid #000;border-right:1px solid #000;padding:8px;font-size:12px;vertical-align:top;`
  const fillTd = `border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;`

  const firmaBlock = (esCobro && firmaSrc)
    ? `<div style="text-align:center;margin-top:14px;padding-bottom:6px;">
         <img src="${firmaSrc}" alt="" style="max-width:72%;max-height:130px;display:block;margin:0 auto;">
       </div>`
    : `<div style="text-align:center;margin-top:56px;padding-bottom:6px;">
         <div style="${F}border-top:1px solid #000;width:260px;margin:0 auto;padding-top:6px;font-size:10px;color:#000;">Recibí conforme &nbsp;—&nbsp; firma y aclaración</div>
       </div>`

  return {
    firmaSrc,
    html: `
<div class="rcb-doc" style="${F}width:470px;margin:0 auto;border:1.5px solid #000;background:#fff;color:#000;">

  <div style="${F}text-align:center;font-size:12px;font-weight:bold;letter-spacing:.35em;padding:4px 0;border-bottom:1.5px solid #000;">ORIGINAL</div>

  <table style="width:100%;border-collapse:collapse;border-bottom:1.5px solid #000;">
    <tr>
      <td style="${F}padding:10px 12px;text-align:center;vertical-align:top;color:#000;">
        <div style="font-size:14px;font-weight:bold;letter-spacing:.02em;">${nombreHead}</div>
        <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;margin-top:2px;color:#222;">${MIS_DATOS.subtitulo || ''}</div>
        <div style="display:inline-block;border:1px solid #000;border-radius:2px;padding:4px 12px;margin-top:8px;font-size:9px;line-height:1.7;letter-spacing:.02em;">${matHtml}</div>
        <div style="font-size:9px;margin-top:7px;line-height:1.5;">${dom.dir}</div>
      </td>
      <td style="width:54px;border-left:1px solid #000;border-right:1px solid #000;text-align:center;vertical-align:middle;font-size:34px;font-weight:bold;color:#000;">R</td>
      <td style="${F}width:168px;padding:10px 12px;vertical-align:top;color:#000;">
        <div style="font-size:17px;font-weight:bold;letter-spacing:.1em;">RECIBO</div>
        <div style="font-size:10px;margin-top:8px;line-height:1.9;">
          N°: <b>${nroFmt}</b><br>Fecha: <b>${fechaTxt}</b><br>Lugar: <b>${dom.lugar}</b>
        </div>
      </td>
    </tr>
  </table>

  <div style="${F}border-bottom:1.5px solid #000;background:#f4f4f4;padding:6px 12px;font-size:10px;color:#000;">${banda}</div>

  <div style="padding:12px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <th style="${thBase}text-align:left;">Detalle</th>
        <th style="${thBase}text-align:center;width:70px;">Cantidad</th>
        <th style="${thBase}text-align:right;width:120px;">Importe</th>
      </tr>
      <tr>
        <td style="${tdBase}font-weight:bold;">${concepto || '—'}</td>
        <td style="${tdBase}text-align:center;">1</td>
        <td style="${tdBase}text-align:right;">${montoTxt}</td>
      </tr>
      <tr>
        <td style="${fillTd}height:150px;"></td>
        <td style="${fillTd}"></td>
        <td style="${fillTd}"></td>
      </tr>
    </table>

    <div style="${F}font-size:10px;font-style:italic;margin:10px 2px 0;color:#000;">Son ${letrasTxt}.</div>

    <div style="text-align:right;margin-top:12px;">
      <table style="display:inline-table;border-collapse:collapse;border:1.5px solid #000;width:230px;text-align:left;">
        <tr>
          <td style="${F}padding:5px 10px;font-size:11px;color:#000;">Subtotal (${moneda}):</td>
          <td style="${F}padding:5px 10px;font-size:11px;text-align:right;color:#000;">${montoTxt}</td>
        </tr>
        <tr>
          <td style="${F}padding:5px 10px;font-size:14px;font-weight:bold;border-top:1px solid #000;color:#000;">TOTAL:</td>
          <td style="${F}padding:5px 10px;font-size:14px;font-weight:bold;border-top:1px solid #000;text-align:right;color:#000;">${montoTxt}</td>
        </tr>
      </table>
    </div>

    ${firmaBlock}
  </div>

</div>`
  }
}

// Genera y DESCARGA el PDF automáticamente (A5). Si falla el CDN, cae a impresión.
export async function imprimirRecibo(opts) {
  const moneda = opts.moneda || 'ARS'
  const { html, firmaSrc } = construir({ ...opts, moneda })

  try {
    const html2pdf = await loadHtml2Pdf()
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1; background:#fff;'
    host.innerHTML = html
    document.body.appendChild(host)
    await preload(firmaSrc)
    try {
      await html2pdf().set({
        margin: 5,
        filename: `${opts.nroFmt}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, backgroundColor: '#ffffff', useCORS: true },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all'] },
      }).from(host.querySelector('.rcb-doc')).save()
    } finally {
      document.body.removeChild(host)
    }
  } catch (e) {
    const w = window.open('', '_blank')
    if (!w) { alert('No se pudo generar el PDF. Permití las ventanas emergentes o revisá la conexión.'); return }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${opts.nroFmt}</title>
      <style>@page{size:A5;margin:5mm}body{margin:0}</style></head><body>${html}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }
}
