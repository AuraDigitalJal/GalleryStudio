// Aura Digital: proxy de lectura de fotos de Cloudflare R2 por Cloudflare Pages.
// Solo GET, HEAD y OPTIONS; no escribe ni elimina archivos.
const PHOTO_PATH = /^\/galerias\/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\/assets\/img-\d{3,5}-[a-f0-9]{16}\.(?:jpg|jpeg|png|webp|gif)$/;
const MIME={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'};
const BASE_HEADERS={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
 'Access-Control-Allow-Headers':'If-None-Match',
 'Access-Control-Expose-Headers':'Content-Type, Content-Length, ETag',
 'X-Content-Type-Options':'nosniff',
 'Cache-Control':'public, max-age=31536000, immutable'
};
async function readPhoto({request,env},isHead=false){
 const pathname=new URL(request.url).pathname;
 if(!PHOTO_PATH.test(pathname))return new Response('Ruta no autorizada',{status:404,headers:{'Cache-Control':'no-store'}});
 if(!env?.AURA_GALERIAS)return new Response('R2 no conectado',{status:503,headers:{'Cache-Control':'no-store'}});
 const key=pathname.slice(1);
 const photo=isHead?await env.AURA_GALERIAS.head(key):await env.AURA_GALERIAS.get(key);
 if(!photo)return new Response('Fotografía no encontrada',{status:404,headers:{'Cache-Control':'no-store'}});
 const headers=new Headers(BASE_HEADERS);
 photo.writeHttpMetadata?.(headers);
 headers.set('Content-Type',MIME[key.split('.').pop().toLowerCase()]||'application/octet-stream');
 headers.set('Cache-Control',BASE_HEADERS['Cache-Control']);
 if(photo.httpEtag)headers.set('ETag',photo.httpEtag);
 if(typeof photo.size==='number')headers.set('Content-Length',String(photo.size));
 if(photo.httpEtag&&request.headers.get('If-None-Match')===photo.httpEtag)return new Response(null,{status:304,headers});
 return new Response(isHead?null:photo.body,{status:200,headers});
}
export const onRequestGet=context=>readPhoto(context,false);
export const onRequestHead=context=>readPhoto(context,true);
export const onRequestOptions=()=>new Response(null,{status:204,headers:BASE_HEADERS});
