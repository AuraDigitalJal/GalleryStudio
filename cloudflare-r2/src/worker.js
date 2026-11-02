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
    'Access-Control-Allow-Methods': 'PUT, POST, GET, OPTIONS',
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
// La eliminación no se autoriza únicamente con la clave de subida:
// también exige que GitHub publique previamente un manifiesto de
// cancelación con un nonce único, en el repositorio exacto de la galería.
// Así nadie puede borrar todo el bucket por error.
const GALLERY_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])$/;
async function hasValidDeletionManifest(slug, nonce) {
  const url = 'https://api.github.com/repos/AuraDigitalJal/' + encodeURIComponent(slug) +
    '/contents/aura-deleted.json?ref=main';
  const response = await fetch(url,{
    headers: {'Accept':'application/vnd.github+json','User-Agent':'AuraDigital-GalleryWorker'},
    cache:'no-store'
  });
  if(!response.ok) return false;
  const data = await response.json();
  if (data.encoding !== 'base64' || typeof data.content !== 'string') return false;
  let manifest;
  try { manifest=JSON.parse(atob(data.content.replace(/\s/g,''))); }
  catch (_) { return false; }
  return manifest.schemaVersion === 1
    && manifest.status === 'deleted'
    && manifest.gallery === slug
    && manifest.nonce === nonce
    && manifest.storagePrefix === 'galerias/' + slug + '/';
}
async function deleteGalleryFromR2(request, env, origin) {
  const auth = (request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!tokenMatches(auth, env.GALLERY_PUBLISH_KEY)) return reply('Clave de publicación incorrecta',401,origin);
  if (+(request.headers.get('Content-Length')||0)>4096) return reply('Solicitud demasiado grande',413,origin);
  let data;
  try { data=await request.json(); } catch (_) { return reply('JSON inválido',400,origin); }
  const slug = String(data?.gallery||'');
  const nonce = String(data?.nonce||'');
  if(!GALLERY_SLUG.test(slug) || !/^[a-f0-9]{32}$/.test(nonce))
    return reply('Galería o confirmación inválida',400,origin);
  if(slug === 'auradigitaljal-github-io' || slug === 'gallery-studio')
    return reply('No se puede borrar la infraestructura',403,origin);
  let verified = false;
  try { verified = await hasValidDeletionManifest(slug,nonce); }
  catch (error) { return reply('No se pudo verificar la eliminación en GitHub',502,origin); }
  if (!verified) return reply('Primero debes confirmar la eliminación publicada en GitHub',409,origin);
  const prefix='galerias/' + slug + '/';
  let deleted = 0;
  // R2 devuelve hasta 1000 objetos por llamada. Se borra por lotes,
  // siempre bajo el prefijo exacto para nunca tocar otro evento.
  try {
    for (let page=0;page<30;page++) {
      const listing=await env.AURA_GALERIAS.list({prefix,limit:1000});
      const keys=listing.objects.map(o=>o.key).filter(key=>key.startsWith(prefix));
      if(!keys.length) {
        return new Response(JSON.stringify({ok:true,gallery:slug,deleted}),{
          status:200,headers:{'content-type':'application/json; charset=utf-8',...corsHeaders(origin)}
        });
      }
      for(let i=0;i<keys.length;i+=100) {
        const part=keys.slice(i,i+100);
        await env.AURA_GALERIAS.delete(part);
        deleted += part.length;
      }
    }
    return reply('Quedan archivos pendientes; vuelve a intentar la limpieza',503,origin);
  } catch(error) {
    return reply('La eliminación de Cloudflare quedó incompleta; inténtalo nuevamente',503,origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return reply('Origen no autorizado',403,null);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(origin)});
    const path = new URL(request.url).pathname;
    if (request.method==='GET' && path==='/capabilities') {
      return new Response(JSON.stringify({deleteGallery:true}),{status:200,
        headers:{'content-type':'application/json; charset=utf-8',...corsHeaders(origin)}});
    }
    if (request.method==='POST' && path==='/delete-gallery') {
      return deleteGalleryFromR2(request,env,origin);
    }
    if (request.method!=='PUT') return reply('Método no permitido',405,origin);
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
