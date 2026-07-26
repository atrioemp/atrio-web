// Esta función recibe los datos del formulario, le pide a la IA que
// genere una web completa a partir de ellos, y la guarda para que
// puedas revisarla en admin.html

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const datos = JSON.parse(event.body);
    const { nombre, email, telefono, tipo_negocio, estilo, referencia, mensaje } = datos;

    if (!nombre || !mensaje) {
      return { statusCode: 400, body: 'Faltan datos obligatorios' };
    }

    const prompt = `Genera una página web de una sola página en HTML, CSS y JS (todo en un solo archivo, sin dependencias externas salvo Google Fonts si quieres) para el siguiente negocio.

Datos del cliente:
- Nombre del negocio/contacto: ${nombre}
- Tipo de negocio: ${tipo_negocio || 'no especificado'}
- Estilo visual deseado: ${estilo || 'a tu criterio, algo profesional y moderno'}
- Referencia de estilo que le gusta: ${referencia || 'ninguna'}
- Descripción de su negocio y lo que necesita: ${mensaje}

Requisitos:
- Web de una sola página (secciones: cabecera con navegación, hero, servicios/productos, sobre nosotros, contacto)
- Diseño profesional, colores coherentes con el estilo pedido, tipografía cuidada (usa Google Fonts)
- Totalmente responsive (que se vea bien en móvil)
- Español, sin lorem ipsum — usa contenido realista basado en la descripción dada
- No incluyas ningún banner ni texto que diga que es un ejemplo o demo
- Devuelve ÚNICAMENTE el código HTML completo, empezando por <!DOCTYPE html>, sin explicaciones ni texto adicional antes o después, sin bloques de markdown (nada de \`\`\`).`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error de Anthropic:', data);
      return { statusCode: 500, body: 'Error generando la web' };
    }

    let html = data.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    // Por si el modelo mete markdown fences a pesar de la instrucción
    html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const store = getStore('borradores');
    await store.setJSON(id, {
      id,
      nombre,
      email: email || '',
      telefono: telefono || '',
      tipo_negocio: tipo_negocio || '',
      estilo: estilo || '',
      mensaje,
      html,
      fecha: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
