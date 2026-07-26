const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return { statusCode: 400, body: 'Falta el id' };

  try {
    const store = getStore('borradores');
    const data = await store.get(id, { type: 'json' });

    if (!data) return { statusCode: 404, body: 'No encontrado' };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
