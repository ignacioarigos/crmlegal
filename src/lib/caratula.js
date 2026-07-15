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
const val = (v) => (v == null || v === '') ? '—' : String(v)
const fF  = (s) => s ? fmtF(s) : '—'
const chk = (on) => `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;text-align:center;line-height:10px;font-size:11px;vertical-align:middle;">${on ? '×' : '&nbsp;'}</span>`
const sino = (v) => `${chk(!!v)}&nbsp;Sí&nbsp;&nbsp;${chk(!v)}&nbsp;No`

// ╔══════════════════════════════════════════════════════════════╗
// ║  CARÁTULA (tapa de carpeta) — A4                              ║
// ╚══════════════════════════════════════════════════════════════╝
function construirCaratula(s) {
  // Mapeo dinámico del campo de movilidad/rol
  const tipoMovilidad = s.req_rol || s.rdo_vehiculo || s.vehiculo || '';

  // Lista de datos optimizada en orden lógico y con nuevo nombre
  const items = [
    { label: 'N° de Siniestro',     value: val(s.nro_siniestro) },
    { label: 'Compañía / Aseg.',    value: val(s.aseguradora || s.compania) },
    { label: 'Calidad del Tercero', value: val(tipoMovilidad) },
    { label: 'Fecha del Hecho',     value: fF(s.fecha_hecho) },
    { label: 'Lugar',               value: val(s.lugar) },
    { label: 'Dominio Reclamado',   value: val(s.rdo_dominio) },
    { label: 'Requerido',           value: val(s.rdo_nombre) }
  ]

  // Filas compactadas (padding 10px) para blindar el diseño contra desbordes de página
  let filasDatos = ''
  items.forEach(item => {
    filasDatos += `
      <div style="display: flex; padding: 10px 0; border-bottom: 1px dashed #e0e0e0; line-height: 1.4;">
        <div style="width: 180px; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: .08em; color: #666; display: flex; align-items: center; padding-right: 10px;">
          ${item.label}:
        </div>
        <div style="flex-grow: 1; font-size: 15px; font-weight: bold; color: #000; letter-spacing: .02em;">
          ${item.value}
        </div>
      </div>
    `
  })

  return `
<div class="crt-doc" style="${F}width:720px; box-sizing:border-box; margin:0 auto; background:#fff; color:#000; padding:45px 50px 30px; display: flex; flex-direction: column; justify-content: space-between;">

  <div>
    <!-- Encabezado del Estudio Jurídico -->
    <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:15px;">
      <div style="font-size:25px; font-weight:bold; letter-spacing:.06em;">IA&nbsp;&nbsp;|&nbsp;&nbsp;${MIS_DATOS.nombre.toUpperCase()}</div>
      <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#333; margin-top:5px; font-weight: bold;">${MIS_DATOS.subtitulo || ''}</div>
    </div>

    <!-- Bloque Central de Identificación -->
    <div style="text-align:center; margin:40px 0 15px;">
      <div style="font-size:13px; letter-spacing:.35em; color:#555; font-weight: 500;">CARPETA DE SINIESTRO N°</div>
      <div style="font-size:110px; font-weight:bold; line-height:1; margin-top:5px; letter-spacing:-0.03em;">${carpetaFmt(s.carpeta_nro)}</div>
    </div>

    <!-- Bloque de Partes Involucradas -->
    <div style="border-top:1.5px solid #000; border-bottom:1.5px solid #000; padding:22px 15px; margin:30px 0; text-align:center; background: #fafafa;">
      <div style="font-size:23px; font-weight:bold; color:#000; letter-spacing: .02em;">${val(s.req_nombre)}</div>
      <div style="font-size:13px; font-weight:bold; text-transform:uppercase; color:#777; margin:10px 0; letter-spacing: .2em;">c /</div>
      <div style="font-size:23px; font-weight:bold; color:#000; letter-spacing: .02em;">${val(s.aseguradora || s.compania)}</div>
    </div>

    <!-- Listado Técnico -->
    <div style="margin-top:30px; padding: 0 5px;">
      ${filasDatos}
    </div>
  </div>

  <!-- Pie de Página Fijo en la misma Hoja -->
  <div style="text-align:center; margin-top:50px; font-size:10px; color:#777; letter-spacing: .05em; border-top: 1px solid #eee; padding-top: 12px;">
    Documento de control interno • Generado el ${fmtF(new Date().toISOString().slice(0, 10))}
  </div>

</div>`
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  FORMULARIO (réplica del papel, relleno) — A4                 ║
// ╚══════════════════════════════════════════════════════════════╝
function construirFormulario(s, docCats = []) {
  const has = (k) => docCats.includes(k)
  const cerrado = (s.estado || 'abierto') === 'cerrado'
  const box = 'border:1.4px solid #000;padding:8px 10px;margin-bottom:8px;'
  const line = 'font-size:11px;line-height:2.1;'
  const u = (v) => `<span style="border-bottom:1px solid #000;padding:0 4px;font-weight:bold;">${val(v)}</span>`

  return `
<div class="frm-doc" style="${F}width:720px;margin:0 auto;background:#fff;color:#000;padding:24px 26px;font-size:11px;">

  <div style="${box}">
    <div style="${line}">SINIESTRO: ${u(s.nro_siniestro)} &nbsp;&nbsp; COMPAÑÍA: ${u(s.compania)} &nbsp;&nbsp; CARPETA: ${u(carpetaFmt(s.carpeta_nro))}</div>
    <div style="${line}">REQUIRENTE: ${u(s.req_nombre)}</div>
    <div style="${line}">DNI: ${u(s.req_dni)} &nbsp;&nbsp; Teléfono: ${u(s.req_telefono)}</div>
  </div>

  <div style="${box}">
    <div style="${line}">SINIESTRO: ${u(s.nro_siniestro)} &nbsp;&nbsp; Fecha: ${u(fF(s.fecha_hecho))} &nbsp;&nbsp; Hora: ${u(s.hora_hecho)}</div>
    <div style="${line}">Lugar: ${u(s.lugar)}</div>
    <div style="${line}">Lesiones? ${sino(s.lesiones)}</div>
    <div style="${line}">Adjunta Comprobantes Médicos? ${sino(s.comprobantes_medicos)}</div>
    <div style="${line}">Aseguradora: ${u(s.aseguradora)}</div>
    <div style="${line}">Denuncia Administrativa: ${sino(s.denuncia_admin)}</div>
    <div style="${line}">Teléfono: ${u(s.aseg_telefono)} &nbsp;&nbsp; Domicilio: ${u(s.aseg_domicilio)}</div>
    <div style="${line}">Contacto: ${u(s.aseg_contacto)} &nbsp;&nbsp; Mail: ${u(s.aseg_mail)}</div>
  </div>

  <div style="${box}">
    <div style="${line}">REQUERIDO: ${u(s.rdo_nombre)} &nbsp;&nbsp; Vehículo: ${u(s.rdo_vehiculo)}</div>
    <div style="${line}">Teléfono: ${u(s.rdo_telefono)} &nbsp;&nbsp; Domicilio: ${u(s.rdo_domicilio)}</div>
    <div style="${line}">DNI: ${u(s.rdo_dni)} &nbsp;&nbsp; Dominio: ${u(s.rdo_dominio)} &nbsp;&nbsp; Póliza: ${u(s.rdo_poliza)}</div>
  </div>

  <div style="${line}margin-bottom:8px;">Mediación: ${sino(s.mediacion)} &nbsp;&nbsp; Fecha: ${u(fF(s.mediacion_fecha))} &nbsp;&nbsp; <span style="font-size:10px;">Contacto 4371-3018 – abeniacar@gomezabeniacar.com.ar</span></div>

  <div style="${box}">
    <div style="${line}">Lesiones: ${u(s.lesiones_detalle)}</div>
    <div style="${line}">Daños: ${u(s.danos_detalle)}</div>
  </div>

  <div style="${line}margin-bottom:8px;">VISTA MÉDICA: ${sino(s.vista_medica)} &nbsp;&nbsp; Fecha: ${u(fF(s.vm_fecha))} &nbsp;&nbsp; Dr: ${u(s.vm_dr)}</div>
  <div style="${line}margin-bottom:8px;">Domicilio: ${u(s.vm_domicilio)} &nbsp;&nbsp; Teléfono: ${u(s.vm_telefono)}</div>

  <div style="border:1.4px dashed #000;padding:10px;margin-bottom:8px;${line}">
    DOCUMENTACIÓN: DNI ${chk(has('DNI'))} &nbsp; CV ${chk(has('CV'))} &nbsp; REG ${chk(has('REG'))} &nbsp; SEG ${chk(has('SEG'))} &nbsp; FOTOS ${chk(has('FOTOS'))}<br>
    DA ${chk(has('DA'))} &nbsp; CERT. COB. ${chk(has('CERT_COB'))} &nbsp; PRESUPUESTO ${chk(has('PRESUPUESTO'))}
  </div>

  <div style="${line}">CERRADO? ${sino(cerrado)} &nbsp;&nbsp; Fecha de Pago: ${u(fF(s.fecha_pago))} &nbsp;&nbsp; $: ${u(s.monto_pago != null && s.monto_pago !== '' ? Number(s.monto_pago).toLocaleString('es-AR') : '')}</div>

</div>`
}

// ── Generación / descarga ──
async function generar(html, filename, selector) {
  try {
    const html2pdf = await loadHtml2Pdf()
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1; background:#fff;'
    host.innerHTML = html
    document.body.appendChild(host)
    await waitImages(host)
    try {
      await html2pdf().set({
        margin: 0, // Ajustado a 0 ya que el contenedor maneja sus propios paddings de imprenta
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, backgroundColor: '#ffffff', useCORS: true, imageTimeout: 15000 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all'] },
      }).from(host.querySelector(selector)).save()
    } finally {
      document.body.removeChild(host)
    }
  } catch (e) {
    const w = window.open('', '_blank')
    if (!w) { alert('No se pudo generar el PDF. Permití las ventanas emergentes.'); return }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${filename}</title>
      <style>@page{size:A4;margin:0mm}body{margin:0}</style></head><body>${html}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }
}

export function imprimirCaratula(s) {
  return generar(construirCaratula(s), `Caratula-${carpetaFmt(s.carpeta_nro)}.pdf`, '.crt-doc')
}
export function imprimirFormulario(s, docCats = []) {
  return generar(construirFormulario(s, docCats), `Formulario-${carpetaFmt(s.carpeta_nro)}.pdf`, '.frm-doc')
}
