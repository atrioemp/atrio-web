// netlify/functions/guardar-solicitud.js
// Recibe los datos del formulario "Solicita tu web" y los guarda en Airtable.
// Requiere la variable de entorno AIRTABLE_API_KEY configurada en Netlify
// (Site settings > Environment variables), con un Personal Access Token de Airtable
// que tenga permiso de escritura sobre la base "Atrio - Solicitudes".

const AIRTABLE_BASE_ID = 'appvz4WdS2j5L0RUI';
const AIRTABLE_TABLE_ID = 'tblLzVga6soadDhuW';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  try {
    const datos = JSON.parse(event.body || '{}');

    const fields = {
      Nombre: datos.nombre || '',
      Negocio: datos.empresa || '',
      Email: datos.email || '',
      Telefono: datos.telefono || '',
      'Tipo de negocio': datos.tipo_negocio || '',
      Plan: datos.plan || '',
      Estilo: datos.estilo || '',
      Referencia: datos.referencia || '',
      Mensaje: datos.mensaje || '',
    };

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: [{ fields }] }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Error de Airtable:', errText);
      return { statusCode: 502, body: JSON.stringify({ success: false, error: 'Error guardando en Airtable' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Error en guardar-solicitud:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Error interno' }) };
  }
};
