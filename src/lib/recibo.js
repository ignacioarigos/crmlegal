// src/lib/recibo.js
import { fmtF } from './supabase.js'

// ╔══════════════════════════════════════════════════════════════╗
// ║  TUS DATOS — encabezado del recibo                            ║
// ╚══════════════════════════════════════════════════════════════╝
export const MIS_DATOS = {
  nombre:    'Ignacio Arigós',
  subtitulo: 'Abogado',
  matriculas: 'T° 120  F° 824  —  C.P.A.C.F.   ·   T° LVII  F° 344  —  C.A.S.I.',

  // Domicilio y lugar de emisión según el TRIBUNAL de la causa (campo causa.tribunal)
  domicilios: {
    PJN:  { dir: 'Paraná N° 597, Piso 2, Of. «15», C.A.B.A.',        lugar: 'C.A.B.A.' },
    SCBA: { dir: 'Adolfo Alsina N° 1.756, Florida, Vicente López.',   lugar: 'Vicente López' },
    EJE:  { dir: 'Paraná N° 597, Piso 2, Of. «15», C.A.B.A.',        lugar: 'C.A.B.A.' }, // CABA (ajustar si constituís otro)
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

// Abre el recibo en una ventana nueva, listo para imprimir / guardar como PDF.
// { tipo: 'cobro'|'pago', nroFmt, fecha, monto, moneda, concepto, tribunal }
export function imprimirRecibo({ tipo, nroFmt, fecha, monto, moneda = 'ARS', concepto, tribunal }) {
  const esCobro  = tipo === 'cobro'
  const simbolo  = moneda === 'USD' ? 'U$S' : '$'
  const montoTxt = `${simbolo} ${(monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const letrasTxt = montoEnLetras(monto, moneda)
  const banda = esCobro
    ? 'Recibí la suma que se detalla a continuación:'
    : 'Se deja constancia del pago según el siguiente detalle:'
  const firmaLabel = esCobro ? MIS_DATOS.nombre : 'Recibí conforme  —  firma y aclaración'

  const dom = MIS_DATOS.domicilios[tribunal] || MIS_DATOS.domicilios[MIS_DATOS.defaultTribunal]
  const fechaTxt = fecha ? fmtF(fecha) : fmtF(new Date().toISOString().slice(0, 10))

  const w = window.open('', '_blank')
  if (!w) { alert('El navegador bloqueó la ventana del recibo. Permití las ventanas emergentes para este sitio.'); return }

  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${nroFmt}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 12px; }
  .doc { max-width: 640px; margin: 0 auto; border: 1.5px solid #000; display: flex; flex-direction: column; min-height: 900px; }

  /* Banda superior tipo ORIGINAL */
  .banner { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: .35em;
            padding: 5px 0; border-bottom: 1.5px solid #000; }

  /* Cabecera: emisor | R | datos */
  .top { display: flex; align-items: stretch; border-bottom: 1.5px solid #000; }
  .col-em { flex: 1; padding: 14px 16px; }
  .box-tipo { width: 66px; border-left: 1px solid #000; border-right: 1px solid #000;
              display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .box-tipo .big { font-size: 38px; font-weight: bold; line-height: 1; }
  .box-tipo .sub { font-size: 8px; letter-spacing: .12em; margin-top: 3px; }
  .col-r { width: 224px; padding: 14px 16px; }

  .em-nom { font-size: 17px; font-weight: bold; }
  .em-sub { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; margin-top: 1px; color: #222; }
  .em-mat { font-size: 10px; margin-top: 10px; line-height: 1.7; }
  .em-dom { font-size: 10px; margin-top: 4px; line-height: 1.6; }

  .r-tit  { font-size: 20px; font-weight: bold; letter-spacing: .1em; }
  .r-meta { font-size: 11px; margin-top: 10px; line-height: 1.9; }
  .r-meta .v { font-weight: bold; }

  /* Banda de leyenda */
  .band { border-bottom: 1.5px solid #000; background: #f4f4f4; padding: 8px 16px; font-size: 11px; }

  /* Cuerpo (crece para dar altura) */
  .body { flex: 1; display: flex; flex-direction: column; padding: 16px; }

  /* Tabla de detalle */
  table.det { width: 100%; border-collapse: collapse; }
  table.det th { background: #ececec; border: 1px solid #000; padding: 6px 10px;
                 font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  table.det th.l, table.det td.l { text-align: left; }
  table.det th.c, table.det td.c { text-align: center; width: 90px; }
  table.det th.r, table.det td.r { text-align: right; width: 150px; }
  table.det td { border-left: 1px solid #000; border-right: 1px solid #000; padding: 10px;
                 font-size: 13px; vertical-align: top; }
  table.det td.l { font-weight: bold; }
  .det-fill { flex: 1; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; min-height: 150px; }

  .letras { font-size: 11px; font-style: italic; margin: 12px 2px 0; }

  /* Totales */
  .tot-wrap { display: flex; justify-content: flex-end; margin-top: 14px; }
  .tot { width: 260px; border: 1.5px solid #000; }
  .tot .row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 12px; }
  .tot .row.total { border-top: 1px solid #000; font-size: 15px; font-weight: bold; }

  /* Pie */
  .foot { padding: 0 16px 18px; }
  .pago { margin-top: 20px; font-size: 11px; }
  .pago .ln { display: inline-block; border-bottom: 1px solid #777; min-width: 280px; }
  .firma { margin-top: 66px; text-align: center; }
  .firma .fl { border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 7px; font-size: 11px; }
</style></head><body><div class="doc">

  <div class="banner">ORIGINAL</div>

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

  <div class="band">${banda}</div>

  <div class="body">
    <table class="det">
      <thead><tr><th class="l">Detalle</th><th class="c">Cantidad</th><th class="r">Importe</th></tr></thead>
      <tbody><tr><td class="l">${concepto || '—'}</td><td class="c">1</td><td class="r">${montoTxt}</td></tr></tbody>
    </table>
    <div class="det-fill"></div>

    <div class="letras">Son ${letrasTxt}.</div>

    <div class="tot-wrap">
      <div class="tot">
        <div class="row"><span>Subtotal (${moneda}):</span><span>${montoTxt}</span></div>
        <div class="row total"><span>TOTAL:</span><span>${montoTxt}</span></div>
      </div>
    </div>
  </div>

  <div class="foot">
    <div class="pago">Forma de pago: <span class="ln">&nbsp;</span></div>
    <div class="firma"><div class="fl">${firmaLabel}</div></div>
  </div>

</div></body></html>`)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 350)
}
