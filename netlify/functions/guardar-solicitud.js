// netlify/functions/guardar-solicitud.js
// Recibe el formulario "Solicita tu web" de la web oficial de Atrio y lo guarda
// en Airtable (base "Atrio - Solicitudes"), para que el panel ATRIOD las muestre.
// Requiere la variable de entorno AIRTABLE_API_KEY configurada en Netlify
// (Site settings > Environment variables), con un Personal Access Token de Airtable
// que tenga permiso de LECTURA Y ESCRITURA (data.records:read y data.records:write)
// sobre la base "Atrio - Solicitudes".

const AIRTABLE_BASE_ID = 'appvz4WdS2j5L0RUI';
const AIRTABLE_TABLE_ID = 'tblLzVga6soadDhuW';

exports.handler = async (event) => {
  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Método no permitido' }) };
  }

  // Parsear el body de forma segura
  let datos;
  try {
    datos = JSON.parse(event.body || '{}');
  } catch (err) {
    console.error('Error parseando el body:', err, 'body recibido:', event.body);
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'JSON inválido' }) };
  }

  // Aceptar varios posibles nombres de campo que pueda mandar el formulario,
  // para que un cambio de nombre en el HTML no vuelva a romper esto.
  const nombre = datos.nombre || datos.Nombre || '';
  const negocio = datos.negocio || datos.Negocio || datos.empresa || '';
  const email = datos.email || datos.Email || '';
  const telefono = datos.telefono || datos.Telefono || datos.phone || '';
  const tipoNegocio = datos.tipoNegocio || datos['Tipo de negocio'] || datos.tipo || '';
  const plan = datos.plan || datos.Plan || '';
  const estilo = datos.estilo || datos.Estilo || '';
  const referencia = datos.referencia || datos.Referencia || '';
  const mensaje = datos.mensaje || datos.Mensaje || datos.negocioDescripcion || datos.cuentame || '';

  if (!nombre.trim() || !negocio.trim()) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Faltan campos obligatorios (nombre y negocio)' }) };
  }

  if (!process.env.AIRTABLE_API_KEY) {
    console.error('Falta la variable de entorno AIRTABLE_API_KEY en este sitio de Netlify');
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Configuración del servidor incompleta' }) };
  }

  const fields = {
    Nombre: nombre,
    Negocio: negocio,
    Email: email,
    Telefono: telefono,
    'Tipo de negocio': tipoNegocio,
    Plan: plan,
    Estilo: estilo,
    Referencia: referencia,
    Mensaje: mensaje,
    Fecha: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        // typecast: true evita que Airtable rechace el envío completo por un
        // formato "casi correcto" (por ejemplo, un teléfono con espacios o
        // un email mal escrito). Sin esto, CUALQUIER valor que no encaje al
        // 100% con el tipo de columna tumba todo el guardado.
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Error de Airtable al guardar solicitud:', res.status, errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ ok: false, error: 'No se pudo guardar en Airtable' }),
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      // El frontend (index.html) comprueba "result.success", no "result.ok".
      // Se mandan ambas claves para que funcione pase lo que pase.
      body: JSON.stringify({ success: true, ok: true, id: data.records?.[0]?.id }),
    };
  } catch (err) {
    console.error('Error en guardar-solicitud:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, ok: false, error: 'Error interno' }) };
  }
};
