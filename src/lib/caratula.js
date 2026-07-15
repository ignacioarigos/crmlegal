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
const chk = (on) => `<span style="display:inline-block;width:12px;height:12px;border:1px solid #000;text-align:center;line-height:11px;font-size:11px;vertical-align:middle;font-weight:bold;">${on ? '×' : '&nbsp;'}</span>`
const sino = (v) => `${chk(!!v)}&nbsp;Sí&nbsp;&nbsp;${chk(!v)}&nbsp;No`

// ╔══════════════════════════════════════════════════════════════╗
// ║  CARÁTULA (tapa de carpeta) — A4                              ║
// ╚══════════════════════════════════════════════════════════════╝
function construirCaratula(s) {
  const tipoMovilidad = s.req_rol || s.rdo_vehiculo || s.vehiculo || '';

  const items = [
    { label: 'N° de Siniestro',     value: val(s.nro_siniestro) },
    { label: 'Compañía / Aseg.',    value: val(s.aseguradora || s.compania) },
    { label: 'Calidad del Tercero', value: val(tipoMovilidad) },
    { label: 'Fecha del Hecho',     value: fF(s.fecha_hecho) },
    { label: 'Lugar',               value: val(s.lugar) },
    { label: 'Dominio Reclamado',   value: val(s.rdo_dominio) },
    { label: 'Requerido',           value: val(s.rdo_nombre) }
  ]

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
    <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:15px;">
      <div style="font-size:25px; font-weight:bold; letter-spacing:.06em;">IA&nbsp;&nbsp;|&nbsp;&nbsp;${MIS_DATOS.nombre.toUpperCase()}</div>
      <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#333; margin-top:5px; font-weight: bold;">${MIS_DATOS.subtitulo || ''}</div>
    </div>
    <div style="text-align:center; margin:40px 0 15px;">
      <div style="font-size:13px; letter-spacing:.35em; color:#555; font-weight: 500;">CARPETA DE SINIESTRO N°</div>
      <div style="font-size:110px; font-weight:bold; line-height:1; margin-top:5px; letter-spacing:-0.03em;">${carpetaFmt(s.carpeta_nro)}</div>
    </div>
    <div style="border-top:1.5px solid #000; border-bottom:1.5px solid #000; padding:22px 15px; margin:30px 0; text-align:center; background: #fafafa;">
      <div style="font-size:23px; font-weight:bold; color:#000; letter-spacing: .02em;">${val(s.req_nombre)}</div>
      <div style="font-size:13px; font-weight:bold; text-transform:uppercase; color:#777; margin:10px 0; letter-spacing: .2em;">c /</div>
      <div style="font-size:23px; font-weight:bold; color:#000; letter-spacing: .02em;">${val(s.aseguradora || s.compania)}</div>
    </div>
    <div style="margin-top:30px; padding: 0 5px;">
      ${filasDatos}
    </div>
  </div>
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
  
  // Estilos base optimizados para mayor legibilidad (13px) sin desbordar A4
  const box = 'border:1.5px solid #000; padding:10px 12px; margin-bottom:10px; box-sizing:border-box;'
  const titleBox = 'font-size:13px; font-weight:bold; text-transform:uppercase; border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:8px; color:#111;'
  const line = 'font-size:13px; line-height:1.8; color:#000;'
  const u = (v) => `<span style="border-bottom:1px solid #888; padding:0 4px; font-weight:bold; font-size:13px;">${val(v)}</span>`

  return `
<div class="frm-doc" style="${F}width:720px; box-sizing:border-box; margin:0 auto; background:#fff; color:#000; padding:30px 35px; font-size:13px;">

  <!-- Encabezado y Título del Formulario -->
  <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:15px;">
    <div style="font-size:18px; font-weight:bold; letter-spacing:0.05em;">FORMULARIO DE SINIESTRO</div>
    <div style="font-size:14px; font-weight:bold; letter-spacing:0.05em;">CARPETA N°: ${carpetaFmt(s.carpeta_nro)}</div>
  </div>

  <!-- BLOQUE DESTACADO: Identificadores Principales -->
  <div style="${box} background:#fcfcfc; border-width:2px;">
    <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold; line-height:1.4;">
      <div>SINIESTRO N°: <span style="font-size:17px; color:#000; text-decoration:underline;">${val(s.nro_siniestro)}</span></div>
      <div>COMPAÑÍA: <span style="font-size:17px; color:#000; text-decoration:underline;">${val(s.compania || s.aseguradora)}</span></div>
    </div>
  </div>

  <!-- Bloque 1: Requirente -->
  <div style="${box}">
    <div style="${titleBox}">Datos del Requirente</div>
    <div style="${line}">NOMBRE Y APELLIDO: ${u(s.req_nombre)}</div>
    <div style="${line}">DNI: ${u(s.req_dni)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; TELÉFONO: ${u(s.req_telefono)}</div>
  </div>

  <!-- Bloque 2: El Hecho -->
  <div style="${box}">
    <div style="${titleBox}">Detalles del Hecho y Aseguradora</div>
    <div style="${line}">FECHA: ${u(fF(s.fecha_hecho))} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; HORA: ${u(s.hora_hecho)}</div>
    <div style="${line}">LUGAR: ${u(s.lugar)}</div>
    <div style="${line}">¿PRESENTA LESIONES?: ${sino(s.lesiones)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ¿ADJUNTA COMPROBANTES MÉDICOS?: ${sino(s.comprobantes_medicos)}</div>
    <div style="${line}; margin-top:4px; border-top:1px dashed #ccc; padding-top:4px;">ASEGURADORA: ${u(s.aseguradora)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DENUNCIA ADMINISTRATIVA: ${sino(s.denuncia_admin)}</div>
    <div style="${line}">DOMICILIO CO. / TEL: ${u(s.aseg_domicilio)} &nbsp;/&nbsp; ${u(s.aseg_telefono)}</div>
    <div style="${line}">CONTACTO / EMAIL: ${u(s.aseg_contacto)} &nbsp;/&nbsp; ${u(s.aseg_mail)}</div>
  </div>

  <!-- Bloque 3: Requerido -->
  <div style="${box}">
    <div style="${titleBox}">Datos del Requerido y Vehículo</div>
    <div style="${line}">REQUERIDO: ${u(s.rdo_nombre)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; VEHÍCULO: ${u(s.rdo_vehiculo)}</div>
    <div style="${line}">DNI: ${u(s.rdo_dni)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DOMINIO: ${u(s.rdo_dominio)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PÓLIZA N°: ${u(s.rdo_poliza)}</div>
    <div style="${line}">DOMICILIO / TEL: ${u(s.rdo_domicilio)} &nbsp;/&nbsp; ${u(s.rdo_telefono)}</div>
  </div>

  <!-- Bloque Intermedio: Mediación -->
  <div style="${line} margin: 4px 2px 10px; padding: 4px 6px; background:#f9f9f9; border: 1px solid #ddd;">
    MEDIACIÓN: ${sino(s.mediacion)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; FECHA: ${u(fF(s.mediacion_fecha))} 
    <span style="font-size:11px; float:right; color:#555; font-weight:bold; margin-top:2px;">Contacto: 4371-3018 – abeniacar@gomezabeniacar.com.ar</span>
  </div>

  <!-- Bloque 4: Daños -->
  <div style="${box}">
    <div style="${line}"><strong>LESIONES:</strong> ${u(s.lesiones_detalle)}</div>
    <div style="${line}"><strong>DAÑOS MATERIALES:</strong> ${u(s.danos_detalle)}</div>
  </div>

  <!-- Bloque 5: Vista Médica -->
  <div style="${box}">
    <div style="${line}">VISTA MÉDICA: ${sino(s.vista_medica)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; FECHA: ${u(fF(s.vm_fecha))} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PROFESIONAL INTERVENIENTE: ${u(s.vm_dr)}</div>
    <div style="${line}">DOMICILIO / TEL. VISTA: ${u(s.vm_domicilio)} &nbsp;/&nbsp; ${u(s.vm_telefono)}</div>
  </div>

  <!-- Bloque 6: Checkbox Documentación -->
  <div style="border:1.5px dashed #000; padding:10px 12px; margin-bottom:10px; ${line} background:#fafafa;">
    <strong>DOCUMENTACIÓN ADJUNTADA:</strong><br>
    <div style="margin-top:5px; display:flex; justify-content:space-between; flex-wrap:wrap;">
      <div>DNI ${chk(has('DNI'))}</div>
      <div>CV ${chk(has('CV'))}</div>
      <div>REGISTRACIÓN ${chk(has('REG'))}</div>
      <div>SEGURO ${chk(has('SEG'))}</div>
      <div>FOTOS ${chk(has('FOTOS'))}</div>
      <div>D.A. ${chk(has('DA'))}</div>
      <div>CERT. COB. ${chk(has('CERT_COB'))}</div>
      <div>PRESUPUESTO ${chk(has('PRESUPUESTO'))}</div>
    </div>
  </div>

  <!-- Bloque de Cierre -->
  <div style="${line} padding: 5px 2px;">
    ¿ESTADO CERRADO?: ${sino(cerrado)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
    FECHA DE PAGO: ${u(fF(s.fecha_pago))} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
    MONTO INDEMNIZADO: <span style="font-size:14px; font-weight:bold;">$ ${u(s.monto_pago != null && s.monto_pago !== '' ? Number(s.monto_pago).toLocaleString('es-AR') : '')}</span>
  </div>

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
        margin: 0,
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
