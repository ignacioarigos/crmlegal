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
  // Imagen de firma + sello. Colocar el archivo en /public (queda servido en la raíz).
  firmaSello: '/firma-sello.png',

  // Domicilio y lugar de emisión según el TRIBUNAL de la causa (campo causa.tribunal)
  domicilios: {
    PJN:  { dir: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.',        lugar: 'C.A.B.A.' },
    SCBA: { dir: 'Adolfo Alsina N° 1.756, Florida, Vicente López.',   lugar: 'Vicente López' },
    EJE:  { dir: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.',        lugar: 'C.A.B.A.' }, // CABA (ajustar si constituís otro)
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
  const firmaHtml = (esCobro && firmaSrc)
    ? `<div class="firma"><img class="firma-img" src="${firmaSrc}" alt=""></div>`
    : `<div class="firma"><div class="fl">Recibí conforme &nbsp;—&nbsp; firma y aclaración</div></div>`

  const css = `
    .rcb-root, .rcb-root * { box-sizing: border-box; }
    .rcb-root { font-family: Arial, Helvetica, sans-serif; color:#000; font-size:11px; }
    .rcb-root .doc { width: 470px; margin:0 auto; border:1.5px solid #000; display:flex; flex-direction:column; min-height:667px; background:#fff; }
    .rcb-root .banner { text-align:center; font-size:12px; font-weight:bold; letter-spacing:.35em; padding:4px 0; border-bottom:1.5px solid #000; }
    .rcb-root .top { display:flex; align-items:stretch; border-bottom:1.5px solid #000; }
    .rcb-root .col-em { flex:1; padding:10px 12px; text-align:center; }
    .rcb-root .box-tipo { width:54px; border-left:1px solid #000; border-right:1px solid #000; display:flex; align-items:center; justify-content:center; }
    .rcb-root .box-tipo .big { font-size:34px; font-weight:bold; line-height:1; }
    .rcb-root .col-r { width:158px; padding:10px 12px; }
    .rcb-root .em-nom { font-size:14px; font-weight:bold; letter-spacing:.02em; }
    .rcb-root .em-sub { font-size:9px; letter-spacing:.22em; text-transform:uppercase; margin-top:2px; color:#222; }
    .rcb-root .em-mat { display:inline-block; border:1px solid #000; border-radius:2px; padding:4px 12px; margin-top:8px; font-size:9px; line-height:1.7; letter-spacing:.02em; }
    .rcb-root .em-dom { font-size:9px; margin-top:7px; line-height:1.5; }
    .rcb-root .r-tit { font-size:17px; font-weight:bold; letter-spacing:.1em; }
    .rcb-root .r-meta { font-size:10px; margin-top:8px; line-height:1.9; }
    .rcb-root .r-meta .v { font-weight:bold; }
    .rcb-root .band { border-bottom:1.5px solid #000; background:#f4f4f4; padding:6px 12px; font-size:10px; }
    .rcb-root .body { flex:1; display:flex; flex-direction:column; padding:12px; }
    .rcb-root table.det { width:100%; border-collapse:collapse; flex:0 0 auto; }
    .rcb-root table.det th { background:#ececec; border:1px solid #000; padding:5px 8px; font-size:9px; text-transform:uppercase; letter-spacing:.04em; }
    .rcb-root table.det th.l, .rcb-root table.det td.l { text-align:left; }
    .rcb-root table.det th.c, .rcb-root table.det td.c { text-align:center; width:70px; }
    .rcb-root table.det th.r, .rcb-root table.det td.r { text-align:right; width:120px; }
    .rcb-root table.det td { border-left:1px solid #000; border-right:1px solid #000; padding:8px; font-size:12px; vertical-align:top; }
    .rcb-root table.det td.l { font-weight:bold; }
    .rcb-root .det-grow { flex:1; display:flex; }
    .rcb-root .det-grow table { width:100%; height:100%; border-collapse:collapse; }
    .rcb-root .det-grow td { border-left:1px solid #000; border-right:1px solid #000; border-bottom:1px solid #000; }
    .rcb-root .det-grow td.c { width:70px; }
    .rcb-root .det-grow td.r { width:120px; }
    .rcb-root .letras { font-size:10px; font-style:italic; margin:10px 2px 0; }
    .rcb-root .tot-wrap { display:flex; justify-content:flex-end; margin-top:12px; }
    .rcb-root .tot { width:230px; border:1.5px solid #000; }
    .rcb-root .tot .row { display:flex; justify-content:space-between; padding:5px 10px; font-size:11px; }
    .rcb-root .tot .row.total { border-top:1px solid #000; font-size:14px; font-weight:bold; }
    .rcb-root .firma { margin-top:18px; text-align:center; padding-bottom:6px; }
    .rcb-root .firma-img { max-width:74%; max-height:155px; display:block; margin:0 auto; }
    .rcb-root .firma .fl { border-top:1px solid #000; width:260px; margin:34px auto 0; padding-top:6px; font-size:10px; }
  `

  const doc = `
    <div class="doc">
      <div class="banner">ORIGINAL</div>
      <div class="top">
        <div class="col-em">
          <div class="em-nom">${nombreHead}</div>
          <div class="em-sub">${MIS_DATOS.subtitulo || ''}</div>
          <div class="em-mat">${matHtml}</div>
          <div class="em-dom">${dom.dir}</div>
        </div>
        <div class="box-tipo"><div class="big">R</div></div>
        <div class="col-r">
          <div class="r-tit">RECIBO</div>
          <div class="r-meta">
            N°: <span class="v">${nroFmt}</span><br>
            Fecha: <span class="v">${fechaTxt}</span><br>
            Lugar: <span class="v">${dom.lugar}</span>
          </div>
        </div>
      </div>
      <div class="band">${banda}</div>
      <div class="body">
        <table class="det">
          <thead><tr><th class="l">Detalle</th><th class="c">Cantidad</th><th class="r">Importe</th></tr></thead>
          <tbody><tr><td class="l">${concepto || '—'}</td><td class="c">1</td><td class="r">${montoTxt}</td></tr></tbody>
        </table>
        <div class="det-grow"><table><tbody><tr><td class="l"></td><td class="c"></td><td class="r"></td></tr></tbody></table></div>
        <div class="letras">Son ${letrasTxt}.</div>
        <div class="tot-wrap">
          <div class="tot">
            <div class="row"><span>Subtotal (${moneda}):</span><span>${montoTxt}</span></div>
            <div class="row total"><span>TOTAL:</span><span>${montoTxt}</span></div>
          </div>
        </div>
        ${firmaHtml}
      </div>
    </div>`

  return { css, doc, firmaSrc }
}

// Genera y DESCARGA el PDF automáticamente (A5). Si falla el CDN, cae a impresión.
export async function imprimirRecibo(opts) {
  const moneda = opts.moneda || 'ARS'
  const { css, doc, firmaSrc } = construir({ ...opts, moneda })
  const inner = `<style>${css}</style><div class="rcb-root">${doc}</div>`

  try {
    const html2pdf = await loadHtml2Pdf()
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1;'
    host.innerHTML = inner
    document.body.appendChild(host)
    await preload(firmaSrc)
    try {
      await html2pdf().set({
        margin: 6,
        filename: `${opts.nroFmt}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, backgroundColor: '#ffffff', useCORS: true },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all'] },
      }).from(host.querySelector('.doc')).save()
    } finally {
      document.body.removeChild(host)
    }
  } catch (e) {
    // Fallback: abrir ventana e imprimir (por si el CDN está bloqueado)
    const w = window.open('', '_blank')
    if (!w) { alert('No se pudo generar el PDF. Permití las ventanas emergentes o revisá la conexión.'); return }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${opts.nroFmt}</title>
      <style>@page{size:A5;margin:6mm}body{margin:0}</style></head><body>${inner}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }
}
