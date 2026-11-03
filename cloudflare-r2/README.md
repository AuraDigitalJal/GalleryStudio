# Gallery Studio · Cloudflare R2
Integración habilitada en la rama principal el 2 de noviembre de 2026.

## Arquitectura
- GitHub Pages publica `index.html`, `config.json`, miniatura social y el resto de archivos de la galería.
- Cloudflare R2 aloja **solo fotografías optimizadas**, sin originales ni botones nuevos de descarga.
- Perfil Aura 500 KB: objetivo ~500 KB, máximo habitual ~550 KB; el Worker rechaza archivos que exceden 600 KB.
- Bucket: `aura-galerias` (clase Standard). Binding del Worker: `AURA_GALERIAS`.
- Worker: `aura-gallery-r2-upload`. Fuente: `cloudflare-r2/src/worker.js`.
- Dominio R2 temporal de pruebas: `https://pub-13ff1b1ba169434b9c10a7299b6ead9e.r2.dev`. Para uso prolongado configurar un dominio propio sin alterar la configuración DNS actual sin revisión previa.
- Orígenes autorizados en Worker: `https://auradigitaljal.com` y `https://auradigitaljal.github.io`.

## Editor
En **Publicar** se puede dejar Cloudflare activado (predeterminado) o desactivarlo para usar el modo GitHub tradicional. Las dos URL están precargadas pero son editables en **Ver o cambiar los datos de Cloudflare**.
La clave privada `GALLERY_PUBLISH_KEY` se introduce al publicar o borrar y jamás debe guardarse en este repositorio, en la galería ni en `config.json`. El token de GitHub también se introduce en el editor, no se publica.

## Eliminación completa: fotos + repositorio
1. Verifica que la cuenta GitHub controla el repositorio de la galería y que su configuración de fotos apunta al prefijo correspondiente en R2.
2. Pide doble confirmación.
3. Registra en GitHub un manifiesto `aura-deleted.json` con un identificador aleatorio, **sin retirar aún la página**.
4. El Worker verifica el manifiesto contra GitHub y borra solamente `galerias/<slug>/` en R2.
5. **Solo si Cloudflare devuelve `ok:true`**, Gallery Studio sustituye temporalmente la página por un aviso y valida el repositorio.
6. Finalmente solicita a la API de GitHub eliminar el repositorio completo. Se necesita que el token de GitHub tenga permiso de **Administration (read/write)** o `delete_repo` según el tipo de token.
7. Si la limpieza falla en Cloudflare, no se retira la página. Si GitHub no permite el borrado final, el usuario verá el mensaje y un enlace a configuración de ese repositorio. Se admite reintento si ya existe el manifiesto.

El código del Worker se actualiza en el panel de Cloudflare; guardar este archivo fuente en GitHub no lo vuelve a desplegar automáticamente.

## Precauciones
- Nunca borrar manualmente el repositorio **antes** de confirmar que R2 se vació; el Worker necesita consultar `aura-deleted.json` en GitHub para autorizar el borrado.
- No se modifican las galerías de clientes ya publicadas.
- El borrado definitivo en GitHub elimina también el historial de ese repositorio: no hay deshacer garantizado.
- La URL pública `r2.dev` es temporal y está sujeta a limitaciones. Sustituirla por dominio propio cuando se prepare el uso masivo.
- No hay todavía caducidad automática de 3–6 meses: la eliminación se inicia manualmente desde Gallery Studio.

## Comprobaciones realizadas
- Publicación de una galería de prueba con imágenes optimizadas y URLs R2 en `config.json`.
- Eliminación completa de `prueba22`: GitHub reportó que el repositorio dejó de existir y el usuario mostró la lista de objetos R2 vacía. La métrica de tamaño de bucket puede tardar en actualizarse.
- Inspección estática de sintaxis y referencias DOM del editor.
- La versión desplegada de Gallery Studio en su enlace público debe verificarse visualmente tras la actualización; la conexión GitHub no comprueba directamente el caché del navegador.
