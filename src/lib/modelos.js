// src/lib/modelos.js
// Motor de plantillas: reemplaza {{variables}} por datos reales.
// Sin IA: sustitución exacta, instantánea y predecible.
import { MIS_DATOS } from './recibo.js'
import { fechaLarga } from './supabase.js'

// ── Datos del estudio según el fuero de la causa ──────────────
export const POR_TRIBUNAL = {
  PJN: {
    matricula: 'T° 120 F° 824 — C.P.A.C.F.',
    domicilio_electronico: '23312893169',
  },
  EJE: {
    matricula: 'T° 120 F° 824 — C.P.A.C.F.',
    domicilio_electronico: '23312893169',
  },
  SCBA: {
    matricula: 'T° LVII F° 344 — C.A.S.I.',
    domicilio_electronico: '23312893169@notificaciones.scba.gov.ar',
  },
}

export const CUIT_ESTUDIO = '23-31289316-9'

// ── Variables que el sistema completa solo ────────────────────
export const VARS_AUTO = [
  { k: 'caratula',              d: 'Carátula de la causa' },
  { k: 'nro',                   d: 'N° de expediente' },
  { k: 'juzgado',               d: 'Juzgado' },
  { k: 'tribunal',              d: 'Tribunal (PJN / SCBA / EJE)' },
  { k: 'fuero',                 d: 'Fuero' },
  { k: 'cliente',               d: 'Cliente de la causa' },
  { k: 'abogado',               d: 'Ignacio Arigós' },
  { k: 'cuit',                  d: 'CUIT del estudio' },
  { k: 'matricula',             d: 'Tomo y folio — según el fuero' },
  { k: 'domicilio',             d: 'Domicilio constituido — según el fuero' },
  { k: 'domicilio_electronico', d: 'Domicilio electrónico — según el fuero' },
  { k: 'fecha',                 d: 'Fecha (dd/mm/aaaa)' },
  { k: 'fecha_larga',           d: 'Fecha (15 de julio de 2026)' },
]

const AUTO_KEYS = VARS_AUTO.map(v => v.k)

// ── Resolución ────────────────────────────────────────────────
export function resolverAuto(causa, fechaISO) {
  const trib = (causa?.tribunal || MIS_DATOS.defaultTribunal || 'PJN').toUpperCase()
  const cfg = POR_TRIBUNAL[trib] || POR_TRIBUNAL.PJN
  const dom = MIS_DATOS.domicilios[trib] || MIS_DATOS.domicilios[MIS_DATOS.defaultTribunal]
  const d = fechaISO ? new Date(fechaISO + 'T12:00:00') : new Date()

  return {
    caratula:              causa?.caratula || '',
    nro:                   causa?.nro || '',
    juzgado:               causa?.juzgado || '',
    tribunal:              causa?.tribunal || '',
    fuero:                 causa?.fuero || '',
    cliente:               causa?.cliente || '',
    abogado:               MIS_DATOS.nombre,
    cuit:                  CUIT_ESTUDIO,
    matricula:             cfg.matricula,
    domicilio:             dom?.dir || '',
    domicilio_electronico: cfg.domicilio_electronico,
    fecha:                 `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
    fecha_larga:           fechaLarga(d),
  }
}

// Devuelve todas las marcas {{x}} presentes en el texto, sin repetir
export function extraerVars(texto) {
  const out = []
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m
  while ((m = re.exec(texto || '')) !== null) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

// Las que el sistema NO conoce → las tiene que completar el usuario
export function varsManuales(texto) {
  return extraerVars(texto).filter(v => !AUTO_KEYS.includes(v))
}

export function esAuto(v) { return AUTO_KEYS.includes(v) }

// Reemplaza todas las marcas. Las que no tengan valor quedan visibles
// como [[variable]] para que saltes a la vista y no pasen desapercibidas.
export function render(texto, valores) {
  return (texto || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = valores[k]
    return (v === undefined || v === null || v === '') ? `[[${k}]]` : String(v)
  })
}

// ── Exportación ───────────────────────────────────────────────
const escapeHtml = (s) => (s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const safeName = (s) => (s || 'documento').replace(/[^\w\s.\-áéíóúñÁÉÍÓÚÑ]/g, '').trim().substring(0, 80)

// Word: HTML con cabecera de Office. Abre nativo y queda editable.
export function descargarWord(texto, nombre) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(nombre)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size:21cm 29.7cm; margin:2.5cm 2.5cm 2.5cm 3cm; }
  body { font-family:'Times New Roman',serif; font-size:12pt; line-height:1.5; text-align:justify; }
  pre  { font-family:'Times New Roman',serif; font-size:12pt; line-height:1.5;
         white-space:pre-wrap; word-wrap:break-word; margin:0; text-align:justify; }
</style></head>
<body><pre>${escapeHtml(texto)}</pre></body></html>`

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(nombre)}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

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

export async function descargarPdf(texto, nombre) {
  const inner = `<div class="mdl-doc" style="width:700px;box-sizing:border-box;background:#fff;color:#000;
    padding:0;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.55;text-align:justify;
    white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(texto)}</div>`
  try {
    const html2pdf = await loadHtml2Pdf()
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1; background:#fff;'
    host.innerHTML = inner
    document.body.appendChild(host)
    try {
      await html2pdf().set({
        margin: [25, 25, 25, 30],   // mm — márgenes de escrito judicial
        filename: `${safeName(nombre)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(host.querySelector('.mdl-doc')).save()
    } finally {
      document.body.removeChild(host)
    }
  } catch {
    const w = window.open('', '_blank')
    if (!w) { alert('No se pudo generar el PDF. Permití las ventanas emergentes.'); return }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(nombre)}</title>
      <style>@page{size:A4;margin:25mm 25mm 25mm 30mm}body{margin:0}</style></head><body>${inner}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }
}
