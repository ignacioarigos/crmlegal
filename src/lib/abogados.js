// src/lib/abogados.js
// Datos profesionales de cada abogado, por código (N/R) y por tribunal.
// La causa guarda abogado_id (uuid) → se mapea a su código con store.usuarios.

export const ABOGADOS = {
  N: {
    codigo: 'N',
    nombre: 'Ignacio Arigós',
    subtitulo: 'Abogado',
    telefono: '11 5473-7787',
    matriculas: ['T° 120 F° 824 — C.P.A.C.F.', 'T° LVII F° 344 — C.A.S.I.'],
    porTribunal: {
      PJN:  { matricula: 'T° 120 F° 824 — C.P.A.C.F.', domicilio: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.', domicilio_electronico: '23312893169', lugar: 'C.A.B.A.' },
      EJE:  { matricula: 'T° 120 F° 824 — C.P.A.C.F.', domicilio: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.', domicilio_electronico: '23312893169', lugar: 'C.A.B.A.' },
      SCBA: { matricula: 'T° LVII F° 344 — C.A.S.I.', domicilio: 'Adolfo Alsina N° 1.756, Florida, Vicente López.', domicilio_electronico: '23312893169@notificaciones.scba.gov.ar', lugar: 'Vicente López' },
    },
  },
  R: {
    codigo: 'R',
    nombre: 'Ramón E. J. Arigós',
    subtitulo: 'Abogado',
    telefono: '',
    matriculas: ['T° 68 F° 119 — C.P.A.C.F.'],
    porTribunal: {
      PJN: { matricula: 'T° 68 F° 119 — C.P.A.C.F.', domicilio: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.', domicilio_electronico: '2011614283', lugar: 'C.A.B.A.' },
      EJE: { matricula: 'T° 68 F° 119 — C.P.A.C.F.', domicilio: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.', domicilio_electronico: '2011614283', lugar: 'C.A.B.A.' },
      // Ramón no actúa en SCBA
    },
  },
}

// Devuelve los datos del abogado (código N/R) fusionados con los del tribunal.
// Si el abogado no actúa en ese tribunal, cae al primero que tenga.
export function datosAbogado(codigo, tribunal) {
  const ab = ABOGADOS[codigo] || ABOGADOS.N
  const trib = (tribunal || 'PJN').toUpperCase()
  const t = ab.porTribunal[trib] || ab.porTribunal.PJN || Object.values(ab.porTribunal)[0] || {}
  return { ...ab, ...t }
}

// ── Datos del ESTUDIO (para recibos: identidad única, emita quien emita) ──
export const ESTUDIO = {
  nombre: 'Estudio Arigós',
  subtitulo: 'Abogados',
  porTribunal: {
    PJN:  { matriculas: ['T° 120 F° 824 — C.P.A.C.F.', 'T° 68 F° 119 — C.P.A.C.F.'], domicilio: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.', lugar: 'C.A.B.A.' },
    EJE:  { matriculas: ['T° 120 F° 824 — C.P.A.C.F.', 'T° 68 F° 119 — C.P.A.C.F.'], domicilio: 'Paraná N° 597, Piso 2, Of. "15", C.A.B.A.', lugar: 'C.A.B.A.' },
    SCBA: { matriculas: ['T° LVII F° 344 — C.A.S.I.'], domicilio: 'Adolfo Alsina N° 1.756, Florida, Vicente López.', lugar: 'Vicente López' },
  },
}

export function datosEstudio(tribunal) {
  const trib = (tribunal || 'PJN').toUpperCase()
  const t = ESTUDIO.porTribunal[trib] || ESTUDIO.porTribunal.PJN
  return { nombre: ESTUDIO.nombre, subtitulo: ESTUDIO.subtitulo, ...t }
}
