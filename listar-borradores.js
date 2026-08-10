const { getStore } = require('@netlify/blobs');

exports.handler = async function () {
  try {
    const store = getStore('borradores');
    const { blobs } = await store.list();

    const items = await Promise.all(
      blobs.map(async (b) => {
        const data = await store.get(b.key, { type: 'json' });
        return {
          id: data.id,
          nombre: data.nombre,
          email: data.email,
          tipo_negocio: data.tipo_negocio,
          estilo: data.estilo,
          fecha: data.fecha,
        };
      })
    );

    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
