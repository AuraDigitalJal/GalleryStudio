# Aura Digital · Cloudflare R2 (PRUEBAS)

**Alcance congelado:** mantener exactamente el diseño, la navegación, el visor, el orden de fotos, los capítulos, la música y las opciones existentes de Gallery Studio. Sin fotografías originales, sin descarga individual y sin descarga completa nueva. R2 recibe únicamente **imágenes optimizadas** (objetivo 500 KB, máximo 550 KB en el perfil habitual). La página `index.html`, la configuración, la música y la miniatura social se mantienen en GitHub Pages.

## Estado
- Implementación en rama `pruebas/cloudflare-r2-fotos-optimizadas`. **La rama principal y las galerías publicadas no se han modificado.**
- Modo R2 desactivado por defecto. El modo tradicional de publicación GitHub no cambia.
- **Aún no desplegado ni probado contra un bucket real.** Requiere una cuenta Cloudflare, un bucket R2 Standard y la configuración siguiente.
- Las imágenes se identifican por hash de contenido. Al corregir una fotografía cambia su URL, de modo que no queda atrapada en caché.
- Si el optimizador no logra reducir una imagen al máximo del perfil, **se bloquea la publicación en R2** en vez de subir un original pesado.

## Preparar la cuenta Cloudflare
1. Crear bucket R2 `aura-galerias`, clase **Standard** (no Infrequent Access).
2. Publicarlo bajo un dominio propio controlado por la cuenta Cloudflare, por ejemplo `https://fotos.auradigitaljal.com`. No usar `r2.dev` en producción: tiene límites de pruebas y no sirve para configurar caché.
3. Si el dominio `auradigitaljal.com` no está en Cloudflare, primero configurar la zona DNS en esa cuenta (o una configuración parcial compatible). **No cambiar los servidores DNS sin revisar y conservar los registros actuales** de GitHub Pages y correo.
4. Crear Worker con `src/worker.js`, usando `wrangler.toml`. La vinculación `AURA_GALERIAS` debe apuntar al bucket `aura-galerias`.
5. Configurar **secreto**, nunca variable pública: `npx wrangler secret put GALLERY_PUBLISH_KEY`. Establecer una contraseña aleatoria larga, diferente del token de GitHub.
6. En el Worker establecer `ALLOWED_ORIGINS` con el origen exacto donde se abre Gallery Studio, por ejemplo `https://auradigitaljal.github.io`; incluir el dominio propio si lo usa.
7. En el bucket R2 configurar **CORS de lectura GET** para el/los orígenes del editor. Se necesita para recuperar fotografías mediante `config.json` en el editor; las imágenes mostradas en el navegador no cambian su diseño.
8. En Gallery Studio de la rama de pruebas, abrir **Publicar**, marcar **Cloudflare R2 · fotos optimizadas (pruebas)** y completar:
   - URL pública del Worker: `https://<tu-worker>.<tu-cuenta>.workers.dev`
   - URL pública del bucket: `https://fotos.auradigitaljal.com`
   - Clave de publicación (solo memoria de la pestaña)
9. Conectar GitHub normalmente, usar un **repositorio nuevo de prueba** y publicar una galería con 2 o 3 fotografías antes de subir los 300 archivos del primer evento.

## Resultado técnico
- URL de imágenes: `https://fotos.auradigitaljal.com/galerias/<repositorio>/assets/img-001-<hash>.jpg`.
- `index.html` y `config.json` contienen URLs públicas de R2, no claves ni archivos originales.
- Otras funciones, música, `og-preview.jpg` y publicación GitHub Pages permanecen como antes.
- El Worker recibe solo imágenes de hasta 600 KB, verifica token y origen permitidos y las almacena en R2.
- Una publicación fallida NO reemplaza el HTML de GitHub si R2 falla al subir; pueden quedar objetos parciales de prueba en el bucket, que se podrán limpiar después.
- La opción de generar ZIP en el editor sigue siendo el comportamiento original; no se utiliza como descarga para invitados.
- La **caducidad automática de 3–6 meses todavía no está implementada**. No habilitar reglas de borrado hasta coordinar la caducidad de las páginas de cada evento.


## Eliminación conjunta (preparada, pendiente de activar y probar)

- El editor experimental muestra **Publicar → Administrar o eliminar galería publicada**.
- Antes de permitir ningún cambio destructivo, consulta `GET /capabilities`. El Worker anterior responde 405, por lo que **no borra nada** hasta que se despliegue la nueva versión.
- El editor comprueba que el repositorio sea una galería Aura con fotografías en R2; requiere la clave R2 y que el usuario escriba `ELIMINAR <slug>` y confirme.
- Primero retira la página y sus archivos publicados de GitHub mediante un commit de sustitución (el repositorio y su historial **siguen existiendo**). Escribe `aura-deleted.json` con un nonce único.
- Después solicita `POST /delete-gallery` al Worker con el slug y nonce. Worker comprueba la clave de publicación **y** que GitHub publique el manifiesto exacto antes de borrar únicamente `galerias/<slug>/`.
- **Nuevo flujo**: después de la confirmación exitosa de Cloudflare, Gallery Studio valida que el repositorio contenga exclusivamente el aviso de baja y su manifiesto, y llama a `DELETE /repos/{owner}/{repo}` para borrar definitivamente el repositorio. Requiere permiso GitHub **Administration: write** (token fine-grained) o `delete_repo` (token clásico). No necesita ninguna modificación adicional al Worker. Si GitHub deniega el borrado, el repositorio permanece y se puede reintentar; R2 ya estará limpio.
- Si falla la limpieza R2, el editor mostrará un error y permitirá repetir el proceso contra el mismo manifiesto. No debe darse por terminado hasta que confirme Cloudflare.
- Importante: eliminar la galería manualmente desde el panel de GitHub no desencadena esta limpieza. Es necesario usar el botón coordinado de Gallery Studio.
- La eliminación de fotos R2 ya se validó con la galería desechable `prueba`, retirada de GitHub y con el bucket vacío. **No se ha probado aún el nuevo borrado total del repositorio**. La opción está preparada en el editor público de pruebas.
- **Pendiente**: desplegar el nuevo `src/worker.js` en el Worker existente y probar el borrado solo de una galería desechable. Nunca usar las galerías activas de clientes para esta primera prueba.

## Comprobaciones antes de activar producción
- [ ] Una fotografía visible en galería apunta a Cloudflare R2.
- [ ] La foto optimizada en R2 ocupa como máximo 550 KB con perfil 500 KB.
- [ ] El archivo original de prueba NO existe en R2.
- [ ] Portada, banners, música, capítulos, lightbox, WhatsApp y carga diferida funcionan como antes.
- [ ] Restauración desde URL/config funciona (CORS GET).
- [ ] Una corrección de fotografía se refleja al actualizar, sin caché anterior.
- [ ] Publicación GitHub tradicional sigue funcionando sin marcar R2.
- [ ] No se han alterado Galerías Pro ni invitaciones de clientes.

## Fuentes oficiales
- https://developers.cloudflare.com/r2/get-started/workers-api/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/buckets/cors/
