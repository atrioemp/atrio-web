// netlify/functions/test-airtable.js
// Función de SOLO DIAGNÓSTICO. Ábrela directamente en el navegador:
// https://atrioemp.netlify.app/.netlify/functions/test-airtable
// Te va a decir exactamente qué está fallando (permiso, base/tabla, o env var).
// Bórrala cuando termines de diagnosticar.

const AIRTABLE_BASE_ID = 'appvz4WdS2j5L0RUI';
const AIRTABLE_TABLE_ID = 'tblLzVga6soadDhuW';

exports.handler = async () => {
  const resultado = {
    tieneApiKey: Boolean(process.env.AIRTABLE_API_KEY),
    apiKeyEmpieza: process.env.AIRTABLE_API_KEY
      ? process.env.AIRTABLE_API_KEY.slice(0, 8) + '...'
      : null,
  };

  if (!process.env.AIRTABLE_API_KEY) {
    resultado.diagnostico = 'FALTA la variable AIRTABLE_API_KEY en este sitio de Netlify (atrioemp).';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resultado, null, 2) };
  }

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: [{ fields: { Nombre: 'TEST_DIAGNOSTICO', Negocio: 'TEST_DIAGNOSTICO' } }],
          typecast: true,
        }),
      }
    );

    const texto = await res.text();
    resultado.status = res.status;
    resultado.respuestaAirtable = texto;

    if (res.ok) {
      resultado.diagnostico = 'FUNCIONA. El guardado de prueba se hizo con éxito — puedes borrar este registro TEST_DIAGNOSTICO en Airtable y también borrar este archivo.';
    } else if (res.status === 401 || res.status === 403) {
      resultado.diagnostico = 'El token de Airtable NO tiene permiso de escritura sobre esta base. Hay que darle scope data.records:write y acceso a esta base concreta en el token (airtable.com/create/tokens).';
    } else if (res.status === 404) {
      resultado.diagnostico = 'El Base ID o Table ID no existen o el token no tiene acceso a ellos.';
    } else {
      resultado.diagnostico = 'Airtable rechazó el guardado. Mira "respuestaAirtable" arriba para el detalle exacto.';
    }
  } catch (err) {
    resultado.errorDeRed = String(err);
    resultado.diagnostico = 'Error de red al contactar Airtable desde la función.';
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resultado, null, 2),
  };
};
