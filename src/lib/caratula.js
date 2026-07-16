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
const money = (v) => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
const chk = (on) => `<span style="display:inline-block;width:12px;height:12px;border:1px solid #000;text-align:center;line-height:11px;font-size:11px;vertical-align:middle;font-weight:bold;">${on ? '×' : '&nbsp;'}</span>`
const sino = (v) => `${chk(!!v)}&nbsp;Sí&nbsp;&nbsp;${chk(!v)}&nbsp;No`

// Compañía de seguros: dato único. `compania` queda solo como fallback de datos viejos.
const cia = (s) => val(s.aseguradora || s.compania)

// ╔══════════════════════════════════════════════════════════════╗
// ║  CARÁTULA (tapa de carpeta) — A4                              ║
// ╚══════════════════════════════════════════════════════════════╝
function construirCaratula(s) {
  const items = [
    { label: 'N° de Siniestro',     value: val(s.nro_siniestro) },
    { label: 'Compañía / Aseg.',    value: cia(s) },
    { label: 'CUIT Compañía',       value: val(s.aseg_cuit) },
    { label: 'Calidad del Tercero', value: val(s.req_calidad) },
    { label: 'Fecha del Hecho',     value: fF(s.fecha_hecho) },
    { label: 'Lugar',               value: val(s.lugar) },
    { label: 'Dominio Reclamado',   value: val(s.rdo_dominio) },
    { label: 'Requerido',           value: val(s.rdo_nombre) },
  ]
  if (s.derivado) {
    items.push({ label: 'Estudio Liquidador', value: val(s.derivado_estudio) })
  }
  if (s.monto_presupuesto != null && s.monto_presupuesto !== '') {
    items.push({ label: 'Presupuesto', value: money(s.monto_presupuesto) })
  }

  let filasDatos = ''
  items.forEach(item => {
    filasDatos += `
      <div style="display: flex; padding: 9px 0; border-bottom: 1px dashed #e0e0e0; line-height: 1.4;">
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
      <div style="font-size:23px; font-weight:bold; color:#000; letter-spacing: .02em;">${cia(s)}</div>
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

  // Estilos base sin subrayados
  const box = 'border:1.5px solid #000; padding:10px 12px; margin-bottom:10px; box-sizing:border-box;'
  const titleBox = 'font-size:13px; font-weight:bold; text-transform:uppercase; border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:8px; color:#111;'
  const line = 'font-size:13px; line-height:1.8; color:#000;'
  const compact = 'font-size:13px; line-height:1.6; color:#000; margin:4px 2px 10px; padding:5px 8px; background:#f9f9f9; border:1px solid #ddd;'
  const u = (v) => `<span style="padding:0 2px; font-weight:bold; font-size:13px;">${val(v)}</span>`

  // ── Bloques condicionales: el detalle solo se despliega si está tildado ──

  const derivadoBlock = s.derivado ? `
  <div style="${box}">
    <div style="${titleBox}">Derivado — Estudio Liquidador</div>
    <div style="${line}">ESTUDIO: ${u(s.derivado_estudio)}</div>
    <div style="${line}">RESPONSABLE: ${u(s.derivado_responsable)}</div>
    <div style="${line}">TEL. / MAIL: ${u(s.derivado_telefono)} &nbsp;/&nbsp; ${u(s.derivado_mail)}</div>
  </div>` : ''

  const mediacionBlock = s.mediacion ? `
  <div style="${box}">
    <div style="${titleBox}">Mediación</div>
    <div style="${line}">FECHA: ${u(fF(s.mediacion_fecha))} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; MEDIADOR/A: ${u(s.mediacion_nombre)}</div>
    <div style="font-size:11px; color:#555; font-weight:bold; margin-top:4px;">Contacto: 4371-3018 – abeniacar@gomezabeniacar.com.ar</div>
  </div>` : `
  <div style="${compact}">MEDIACIÓN: ${sino(s.mediacion)}</div>`

  const vistaMedicaBlock = s.vista_medica ? `
  <div style="${box}">
    <div style="${titleBox}">Vista Médica</div>
    <div style="${line}">FECHA: ${u(fF(s.vm_fecha))} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PROFESIONAL INTERVENIENTE: ${u(s.vm_dr)}</div>
    <div style="${line}">DOMICILIO / TEL: ${u(s.vm_domicilio)} &nbsp;/&nbsp; ${u(s.vm_telefono)}</div>
    <div style="${line}">MAIL: ${u(s.vm_mail)}</div>
  </div>` : `
  <div style="${compact}">VISTA MÉDICA: ${sino(s.vista_medica)}</div>`

  return `
<div class="frm-doc" style="${F}width:720px; box-sizing:border-box; margin:0 auto; background:#fff; color:#000; padding:30px 35px; font-size:13px;">

  <!-- Encabezado y Título del Formulario -->
  <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:15px;">
    <div style="font-size:18px; font-weight:bold; letter-spacing:0.05em;">FORMULARIO DE SINIESTRO</div>
    <div style="font-size:14px; font-weight:bold; letter-spacing:0.05em;">CARPETA N°: ${carpetaFmt(s.carpeta_nro)}</div>
  </div>

  <!-- BLOQUE DESTACADO: Identificadores Principales -->
  <div style="${box} background:#fcfcfc; border-width:2px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; font-size:16px; font-weight:bold; line-height:1.4;">
      <div>SINIESTRO N°: <span>${val(s.nro_siniestro)}</span></div>
      <div style="text-align:right;">
        <div>COMPAÑÍA: <span>${cia(s)}</span></div>
        <div style="font-size:11px; color:#555; font-weight:bold; margin-top:2px;">CUIT: ${val(s.aseg_cuit)}</div>
      </div>
    </div>
  </div>

  <!-- Bloque 1: Requirente -->
  <div style="${box}">
    <div style="${titleBox}">Datos del Requirente</div>
    <div style="${line}">NOMBRE Y APELLIDO: ${u(s.req_nombre)}</div>
    <div style="${line}">DNI: ${u(s.req_dni)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; TELÉFONO: ${u(s.req_telefono)}</div>
    <div style="${line}">CALIDAD DEL TERCERO: ${u(s.req_calidad)}</div>
  </div>

  <!-- Bloque 2: El Hecho -->
  <div style="${box}">
    <div style="${titleBox}">Detalles del Hecho y Aseguradora</div>
    <div style="${line}">FECHA: ${u(fF(s.fecha_hecho))} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; HORA: ${u(s.hora_hecho)}</div>
    <div style="${line}">LUGAR: ${u(s.lugar)}</div>
    <div style="${line}">¿PRESENTA LESIONES?: ${sino(s.lesiones)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ¿ADJUNTA COMPROBANTES MÉDICOS?: ${sino(s.comprobantes_medicos)}</div>
    <div style="${line}; margin-top:4px; border-top:1px dashed #ccc; padding-top:4px;">DENUNCIA ADMINISTRATIVA: ${sino(s.denuncia_admin)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DERIVADO: ${sino(s.derivado)}</div>
    <div style="${line}">DOMICILIO CO. / TEL: ${u(s.aseg_domicilio)} &nbsp;/&nbsp; ${u(s.aseg_telefono)}</div>
    <div style="${line}">CONTACTO / EMAIL: ${u(s.aseg_contacto)} &nbsp;/&nbsp; ${u(s.aseg_mail)}</div>
  </div>

  ${derivadoBlock}

  <!-- Bloque 3: Requerido -->
  <div style="${box}">
    <div style="${titleBox}">Datos del Requerido y Vehículo</div>
    <div style="${line}">REQUERIDO: ${u(s.rdo_nombre)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; VEHÍCULO: ${u(s.rdo_vehiculo)}</div>
    <div style="${line}">DNI: ${u(s.rdo_dni)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DOMINIO: ${u(s.rdo_dominio)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PÓLIZA N°: ${u(s.rdo_poliza)}</div>
    <div style="${line}">DOMICILIO / TEL: ${u(s.rdo_domicilio)} &nbsp;/&nbsp; ${u(s.rdo_telefono)}</div>
  </div>

  ${mediacionBlock}

  <!-- Bloque 4: Daños -->
  <div style="${box}">
    <div style="${line}"><strong>LESIONES:</strong> ${u(s.lesiones_detalle)}</div>
    <div style="${line}"><strong>DAÑOS MATERIALES:</strong> ${u(s.danos_detalle)}</div>
    <div style="${line}"><strong>PRESUPUESTO A RECLAMAR:</strong> ${u(money(s.monto_presupuesto))}</div>
  </div>

  ${vistaMedicaBlock}

  <!-- Bloque 6: Checkbox Documentación -->
  <div style="border:1.5px dashed #000; padding:10px 12px; ${line} background:#fafafa;">
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

</div>`
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  Generación — SIEMPRE una sola carilla A4                     ║
// ╚══════════════════════════════════════════════════════════════╝
// Estrategia: capturamos el bloque como imagen y la encajamos en la página
// escalándola proporcionalmente. Si el contenido es corto entra a lo ancho;
// si es largo, se achica para entrar a lo alto. Nunca hay segunda hoja.
async function generar(html, filename, selector) {
  const MARGEN_MM = 6
  try {
    const html2pdf = await loadHtml2Pdf()
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1; background:#fff;'
    host.innerHTML = html
    document.body.appendChild(host)
    await waitImages(host)

    try {
      const el = host.querySelector(selector)

      // 1) El bloque a imagen
      const canvas = await html2pdf()
        .set({
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, backgroundColor: '#ffffff', useCORS: true, imageTimeout: 15000 },
        })
        .from(el)
        .toCanvas()
        .get('canvas')

      // 2) La imagen encajada en una única A4
      const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF
      if (!JsPDF) throw new Error('jsPDF no disponible')

      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const dispW = pw - MARGEN_MM * 2
      const dispH = ph - MARGEN_MM * 2

      // escala proporcional: la que sea más restrictiva (ancho o alto)
      const k = Math.min(dispW / canvas.width, dispH / canvas.height)
      const w = canvas.width * k
      const h = canvas.height * k
      const x = (pw - w) / 2
      const y = MARGEN_MM

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', x, y, w, h)
      pdf.save(filename)
    } finally {
      document.body.removeChild(host)
    }
  } catch (e) {
    // Fallback: impresión del navegador, ajustada a una carilla
    const w = window.open('', '_blank')
    if (!w) { alert('No se pudo generar el PDF. Permití las ventanas emergentes.'); return }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${filename}</title>
      <style>@page{size:A4;margin:6mm}body{margin:0}</style></head><body>${html}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }
}
// ╔══════════════════════════════════════════════════════════════╗
// ║  CIERRE DE CARPETA — A4                                       ║
// ╚══════════════════════════════════════════════════════════════╝
const DOC_CIERRE_LBL = [
  ['CONVENIO', 'Convenio / Acuerdo'], ['FACTURA', 'Factura'],
  ['CBU_ESTUDIO', 'CBU estudio'], ['CBU_CLIENTE', 'CBU cliente'],
  ['CONST_CUIT', 'Constancia CUIT'], ['CONST_IIGG', 'Constancia IIGG'],
  ['FORM_EXTRA', 'Formulario extra'],
]
const DOC_MED_LBL = [
  ['MED_FACTURA', 'Factura mediadora'], ['MED_CUIT', 'CUIT mediadora'], ['MED_CBU', 'CBU mediadora'],
]

function construirCierre(s, ofertas = [], docCats = []) {
  const has = (k) => docCats.includes(k)
  const box = 'border:1.5px solid #000; padding:10px 12px; margin-bottom:10px; box-sizing:border-box;'
  const titleBox = 'font-size:13px; font-weight:bold; text-transform:uppercase; border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:8px; color:#111;'
  const line = 'font-size:13px; line-height:1.8; color:#000;'

  const list = [...ofertas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  const acc = list.find(o => o.aceptada)

  const acordado    = acc ? Number(acc.monto) || 0 : 0
  const pctCia      = acc ? Number(acc.hon_pct_cia) || 0 : 0
  const pctCli      = Number(s.hon_pct) || 0
  const honCia      = acordado * pctCia / 100
  const honCliente  = acordado * pctCli / 100
  const netoCliente = acordado - honCliente
  const totalPerc   = honCia + honCliente

  // Historial de negociación
  let filasNeg = ''
  if (list.length === 0) {
    filasNeg = `<tr><td colspan="5" style="${line}padding:6px 4px;color:#666;">Sin ofertas registradas.</td></tr>`
  } else {
    list.forEach(o => {
      const esAcc = !!o.aceptada
      filasNeg += `<tr style="${esAcc ? 'background:#f0f0f0;font-weight:bold;' : ''}">
        <td style="border:1px solid #ccc;padding:5px 7px;font-size:12px;">${fF(o.fecha)}</td>
        <td style="border:1px solid #ccc;padding:5px 7px;font-size:12px;">${o.tipo === 'oferta' ? 'Oferta compañía' : 'Contraoferta'}</td>
        <td style="border:1px solid #ccc;padding:5px 7px;font-size:12px;text-align:right;">${money(o.monto)}</td>
        <td style="border:1px solid #ccc;padding:5px 7px;font-size:12px;text-align:center;">${o.hon_pct_cia != null ? o.hon_pct_cia + '%' : '—'}</td>
        <td style="border:1px solid #ccc;padding:5px 7px;font-size:11px;">${esAcc ? '✔ ACEPTADA' : (o.nota || '')}</td>
      </tr>`
    })
  }

  // Liquidación
  const filaLiq = (lbl, monto, extra = '') =>
    `<tr><td style="${line}padding:5px 4px;border-bottom:1px solid #ddd;${extra}">${lbl}</td>
         <td style="${line}padding:5px 4px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;${extra}">${monto}</td></tr>`

  const liq = acc ? `
    <table style="width:100%;border-collapse:collapse;">
      ${filaLiq('Monto acordado', money(acordado))}
      ${filaLiq(`Honorarios cliente (${pctCli}%)`, money(honCliente))}
      ${filaLiq(`Honorarios compañía (${pctCia}%)`, money(honCia))}
      ${filaLiq('Neto al cliente', money(netoCliente), 'border-top:1.5px solid #000;')}
      ${filaLiq('TOTAL PERCIBIDO POR EL ESTUDIO', money(totalPerc), 'font-size:15px;')}
    </table>`
    : `<div style="${line}color:#666;">No hay oferta aceptada.</div>`

  // Documentación
  const cats = [...DOC_CIERRE_LBL, ...(s.mediacion ? DOC_MED_LBL : [])]
  const docsHtml = cats.map(([k, lbl]) =>
    `<div style="width:33%;box-sizing:border-box;padding:3px 0;font-size:12px;">${chk(has(k))}&nbsp;${lbl}</div>`
  ).join('')

  return `
<div class="cie-doc" style="${F}width:720px; box-sizing:border-box; margin:0 auto; background:#fff; color:#000; padding:30px 35px;">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:15px;">
    <div style="font-size:18px; font-weight:bold; letter-spacing:0.05em;">CIERRE DE CARPETA</div>
    <div style="font-size:14px; font-weight:bold; letter-spacing:0.05em;">CARPETA N°: ${carpetaFmt(s.carpeta_nro)}</div>
  </div>

  <div style="${box} background:#fcfcfc; border-width:2px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; font-size:15px; font-weight:bold; line-height:1.4;">
      <div>${val(s.req_nombre)}</div>
      <div style="text-align:right;">
        <div>${cia(s)}</div>
        <div style="font-size:11px; color:#555; margin-top:2px;">SINIESTRO N°: ${val(s.nro_siniestro)}</div>
      </div>
    </div>
  </div>

  <div style="${box}">
    <div style="${titleBox}">Negociación</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#ececec;">
        <th style="border:1px solid #999;padding:5px 7px;font-size:10px;text-transform:uppercase;text-align:left;">Fecha</th>
        <th style="border:1px solid #999;padding:5px 7px;font-size:10px;text-transform:uppercase;text-align:left;">Origen</th>
        <th style="border:1px solid #999;padding:5px 7px;font-size:10px;text-transform:uppercase;text-align:right;">Monto</th>
        <th style="border:1px solid #999;padding:5px 7px;font-size:10px;text-transform:uppercase;text-align:center;">Hon. cía</th>
        <th style="border:1px solid #999;padding:5px 7px;font-size:10px;text-transform:uppercase;text-align:left;">Obs.</th>
      </tr>
      ${filasNeg}
    </table>
  </div>

  <div style="${box}">
    <div style="${titleBox}">Liquidación</div>
    ${liq}
  </div>

  <div style="border:1.5px dashed #000; padding:10px 12px; background:#fafafa; margin-bottom:10px;">
    <div style="font-size:13px;font-weight:bold;text-transform:uppercase;margin-bottom:6px;">Documentación de cierre</div>
    <div style="display:flex;flex-wrap:wrap;">${docsHtml}</div>
  </div>

  <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:14px;">
    <div>ESTADO: <b>${(s.estado || 'abierto') === 'cerrado' ? 'CERRADO' : 'EN TRÁMITE'}</b></div>
    <div style="color:#777;">Generado el ${fmtF(new Date().toISOString().slice(0, 10))}</div>
  </div>

</div>`
}
export function imprimirCaratula(s) {
  return generar(construirCaratula(s), `Caratula-${carpetaFmt(s.carpeta_nro)}.pdf`, '.crt-doc')
}
export function imprimirFormulario(s, docCats = []) {
  return generar(construirFormulario(s, docCats), `Formulario-${carpetaFmt(s.carpeta_nro)}.pdf`, '.frm-doc')
}
export function imprimirCierre(s, ofertas = [], docCats = []) {
  return generar(construirCierre(s, ofertas, docCats), `Cierre-${carpetaFmt(s.carpeta_nro)}.pdf`, '.cie-doc')
}
