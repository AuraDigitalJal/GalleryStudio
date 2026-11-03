# Gallery Studio · Cloudflare R2
Integración habilitada en la rama principal el 2 de noviembre de 2026.

## Arquitectura
- GitHub Pages publica `index.html`, `config.json`, miniatura social y el resto de archivos de la galería.
- Cloudflare R2 aloja **solo fotografías optimizadas**, sin originales ni botones nuevos de descarga.
- Perfil Aura 500 KB: objetivo ~500 KB, máximo habitual ~550 KB; el Worker rechaza archivos que exceden 600 KB.
- Bucket: `aura-galerias` (clase Standard). Binding del Worker: `AURA_GALERIAS`.
- Worker: `aura-gallery-r2-upload`. Fuente: `cloudflare-r2/src/worker.js`.
- Dominio de fotografías **comprobado**: `https://fotos-prueba.auradigitaljal.com` (Cloudflare Pages, proyecto `aura-r2-fotos-prueba`, binding `AURA_GALERIAS` al bucket). Este subdominio ya lo usa la galería entregada Guadalupe + Emanuel, por lo que NO debe borrarse ni tratarse como prescindible. El dominio anterior `r2.dev` se mantiene admitido únicamente para galerías antiguas, no para publicaciones nuevas.
- Orígenes autorizados en Worker: `https://auradigitaljal.com` y `https://auradigitaljal.github.io`.

## Editor
En **Publicar** se puede dejar Cloudflare activado (predeterminado) o desactivarlo para usar el modo GitHub tradicional. Dentro de **Administrar o eliminar galería publicada** hay un botón **Comprobar servicio de eliminación** que consulta `GET /capabilities` sin borrar ningún archivo. El Worker de subida y el subdominio de lectura comprobado están precargados; pueden revisarse en **Ver o cambiar los datos de Cloudflare**.
La clave privada `GALLERY_PUBLISH_KEY` se introduce al publicar o borrar y jamás debe guardarse en este repositorio, en la galería ni en `config.json`. El token de GitHub también se introduce en el editor, no se publica.

## Eliminación completa: fotos + repositorio
1. Verifica que la cuenta GitHub controla el repositorio de la galería y que su configuración de fotos apunta al prefijo correspondiente en R2.
2. Pide doble confirmación.
3. Registra en GitHub un manifiesto `aura-deleted.json` con un identificador aleatorio, **sin retirar aún la página**.
4. El Worker verifica el manifiesto contra GitHub y borra solamente `galerias/<slug>/` en R2.
5. **Solo si Cloudflare devuelve `ok:true`**, Gallery Studio sustituye temporalmente la página por un aviso y valida el repositorio.
6. Finalmente solicita a la API de GitHub eliminar el repositorio completo. Se necesita que el token de GitHub tenga permiso de **Administration (read/write)** o `delete_repo` según el tipo de token. Acepta fotos de los dominios autorizados `fotos-prueba.auradigitaljal.com` y `r2.dev` anterior, exigiendo siempre el prefijo y nombre exacto de la galería.
7. Si la limpieza falla en Cloudflare, no se retira la página. Si GitHub no permite el borrado final, el usuario verá el mensaje y un enlace a configuración de ese repositorio. Se admite reintento si ya existe el manifiesto.

El código del Worker se actualiza en el panel de Cloudflare; guardar este archivo fuente en GitHub no lo vuelve a desplegar automáticamente.

## Precauciones
- Nunca borrar manualmente el repositorio **antes** de confirmar que R2 se vació; el Worker necesita consultar `aura-deleted.json` en GitHub para autorizar el borrado.
- No se modifican las galerías de clientes ya publicadas.
- El borrado definitivo en GitHub elimina también el historial de ese repositorio: no hay deshacer garantizado.
- No publicar nuevas galerías usando `r2.dev`. El subdominio de lectura funciona a través de Cloudflare Pages + R2; mantener disponible el proyecto `aura-r2-fotos-prueba` mientras una galería real lo utilice.
- La vigencia comercial deseada de 3–6 meses **NO es automática**: al vencer, el operador entra en **Publicar → Administrar o eliminar galería publicada** y ejecuta el borrado manual, con doble confirmación. La eliminación de una foto de la edición no limpia por sí sola versiones antiguas de R2; estas se eliminan al borrar el evento completo.

## Comprobaciones realizadas
- Publicación de una galería de prueba con imágenes optimizadas y URLs R2 en `config.json`.
- Eliminación completa de `prueba22`: GitHub reportó que el repositorio dejó de existir y el usuario mostró la lista de objetos R2 vacía. La métrica de tamaño de bucket puede tardar en actualizarse.
- Inspección estática de sintaxis y referencias DOM del editor.
- La versión desplegada de Gallery Studio en su enlace público debe verificarse visualmente tras la actualización; la conexión GitHub no comprueba directamente el caché del navegador.

## Verificación de integración (3 de noviembre de 2026)
- La galería Guadalupe + Emanuel conservó su enlace y cargó las 257 referencias de fotografías, 256 objetos distintos, sin errores desde `https://fotos-prueba.auradigitaljal.com` (confirmado visualmente por el usuario).
- Las URLs de `config.json` y `index.html` de ese evento fueron migradas a ese subdominio, manteniendo un respaldo previo de ambos archivos.
- Gallery Studio v1.4.31 propone por defecto este dominio en nuevas publicaciones R2. Si se realiza un cambio futuro de host, debe verificarse toda galería que ya depende del dominio anterior antes de retirarlo.
- El sistema de eliminación conjunta ya existía: su operación depende de que el Worker `aura-gallery-r2-upload` tenga desplegado el endpoint `POST /delete-gallery`; el código en GitHub no modifica por sí mismo un Worker publicado.
- No se ha ejecutado eliminación de una galería real con esta versión; validar `GET /capabilities` con el navegador, antes de dar por hecho que la limpieza está operativa.

**Sobre la caché:** la eliminación de R2 impide futuras lecturas desde el bucket, pero navegadores que descargaron una fotografía previamente pueden conservar copias locales durante el periodo configurado en `Cache-Control`. No se debe prometer revocación de copias que los visitantes ya descargaron.
