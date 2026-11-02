// Solo imágenes optimizadas de Gallery Studio. Nunca almacena archivos originales.
const KEY_PATTERN = /^galerias\/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\/assets\/img-\d{3,5}-[a-f0-9]{16}\.(?:jpg|jpeg|png|webp|gif)$/;
const MIME_BY_EXTENSION = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif'
};
const MAX_IMAGE_BYTES = 600 * 1024;

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? origin : null;
}
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
}
function reply(message, status, origin) {
  return new Response(JSON.stringify({message}), {
    status,
    headers:{'content-type':'application/json; charset=utf-8', ...(origin ? corsHeaders(origin):{})}
  });
}
function tokenMatches(received, expected) {
  // Comparación de tiempo aproximadamente constante para el secreto de publicación.
  if (!expected || typeof received !== 'string') return false;
  const left = new TextEncoder().encode(received);
  const right = new TextEncoder().encode(expected);
  let diff = left.length ^ right.length;
  for (let i=0;i<Math.max(left.length,right.length);i++) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff===0;
}
export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return reply('Origen no autorizado',403,null);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(origin)});
    if (request.method!=='PUT') return reply('Método no permitido',405,origin);
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/upload/')) return reply('Ruta no encontrada',404,origin);
    const key = path.slice('/upload/'.length);
    if (!KEY_PATTERN.test(key)) return reply('Nombre de archivo no permitido',400,origin);
    const supplied = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'');
    if (!tokenMatches(supplied,env.GALLERY_PUBLISH_KEY)) return reply('Clave de publicación incorrecta',401,origin);
    const ext = key.split('.').pop();
    const requiredMime = MIME_BY_EXTENSION[ext];
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (mime !== requiredMime) return reply('Tipo de archivo inválido',415,origin);
    // Estos límites evitan guardar originales de varios megabytes por accidente.
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return reply('La imagen supera 600 KB',413,origin);
    await env.AURA_GALERIAS.put(key,bytes,{
      httpMetadata:{contentType:mime,cacheControl:'public, max-age=31536000, immutable'}
    });
    return reply('Fotografía optimizada almacenada',201,origin);
  }
};
