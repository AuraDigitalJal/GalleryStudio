# Prueba aislada Cloudflare Pages → R2 · Aura Digital

**Estado:** código en rama experimental. No desplegado ni comprobado contra el bucket real. No se ha modificado main ni ninguna galería.

## Propósito
Probar una ruta nueva de lectura desde el bucket `aura-galerias`, sin mover los nameservers de Hostinger ni el dominio actual de GitHub Pages.

## Cómo ponerlo a funcionar en Cloudflare Pages
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Conectar el repositorio **AuraDigitalJal/GalleryStudio**.
3. Crear proyecto **aura-r2-fotos-prueba** y seleccionar rama de producción **pruebas/puente-pages-r2-sin-cambiar-dns**.
4. Configuración de build: **None** (sin framework), **Root directory**: `/` (repositorio raíz), **Build command**: vacío (o `exit 0`), **Build output directory**: `public`.
5. Desplegar. NO añadir dominio personalizado ni tocar Hostinger.
6. En el proyecto Pages → Settings → Bindings → Add → R2 bucket:
   - Variable name: **AURA_GALERIAS**
   - R2 bucket: **aura-galerias**
   - Guardar y **Redeploy**.
7. En el dominio `https://aura-r2-fotos-prueba.pages.dev` abrir esta foto real (sustituir el host si Cloudflare propone otro):
   `/galerias/guadalupe-emanuel/assets/img-002-7af4907f2f8f33af.jpg`.
8. La prueba pasa SOLO si responde HTTP 200, `Content-Type: image/jpeg`, muestra la foto, permite descargarla del navegador y vuelve a funcionar al recargarla. Confirmar que /galerias/.../assets/music.mp3 devuelve 404.
9. Todavía NO modificar Guadalupe + Emanuel ni Gallery Studio ni los nameservers. Solo se puede continuar tras comprobar las fotos reales.

## Costos/límites
Las Pages Functions consumen cuotas Workers Free (100.000 solicitudes/día por cuenta). Cada acceso a una foto pasa por la función, sujeto a caché del navegador. Comprobar tráfico real antes de producción.

## Documentación oficial
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/functions/pricing/

## Activación tras conectar R2
Cloudflare Pages requiere un nuevo despliegue cuando se agrega el binding `AURA_GALERIAS` al bucket `aura-galerias`. Esta actualización documental dispara el redeploy automático del proyecto de pruebas conectado por Git; no toca `main`, los DNS ni las galerías publicadas.
