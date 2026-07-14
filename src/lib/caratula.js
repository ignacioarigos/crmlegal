// src/lib/caratula.js
import { fmtF } from './supabase.js'
import { MIS_DATOS } from './recibo.js'   // reutilizamos encabezado del estudio

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
function waitImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'))
  return Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return new Promise((res) => { img.onload = () => res(); img.onerror = () => res() })
  }))
}

// ── helpers de formato ──
const carpetaFmt = (n) => (n == null ? '—' : String(n).padStart(3, '0'))
const val = (v) => (v == null || v === '') ? '&nbsp;' : String(v)
const fF  = (s) => s ? fmtF(s) : '&nbsp;'
const chk = (on) => `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;text-align:center;line-height:10px;font-size:11px;vertical-align:middle;">${on ? '×' : '&nbsp;'}</span>`
const sino = (v) => `${chk(!!v)}&nbsp;Sí&nbsp;&nbsp;${chk(!v)}&nbsp;No`

// ╔══════════════════════════════════════════════════════════════╗
// ║  CARÁTULA (tapa de carpeta) — A4                              ║
// ╚══════════════════════════════════════════════════════════════╝
function construirCaratula(s) {
  const cerrado = (s.estado || 'abierto') === 'cerrado'
  const dom = MIS_DATOS.domicilios[MIS_DATOS.defaultTribunal]
  const pares = [
    ['Nº de siniestro', val(s.nro_siniestro)],
    ['Compañía',        val(s.compania)],
    ['Fecha del hecho', fF(s.fecha_hecho)],
    ['Aseguradora',     val(s.aseguradora)],
    ['DNI requirente',  val(s.req_dni)],
    ['Teléfono',        val(s.req_telefono)],
    ['Dominio contrario', val(s.rdo_dominio)],
    ['Póliza',          val(s.rdo_poliza)],
  ]
  let filas = ''
  for (let i = 0; i < pares.length; i += 2) {
    const cel = (p) => p ? `<td style="${F}width:50%;padding:9px 12px;vertical-align:top;border:1px solid #000;">
        <div
