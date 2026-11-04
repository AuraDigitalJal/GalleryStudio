# Aura Digital · Monitoreo Cloudflare

Herramienta de consulta **solo lectura** de Cloudflare R2 y Workers, agregada a `GalleryStudio` sin alterar sus galerías ni su sitio web.

## Activación (en este mismo repositorio)

1. Abre **Settings → Secrets and variables → Actions**.
2. En **Secrets**, crea `CLOUDFLARE_API_TOKEN` y pega ahí el token de Cloudflare con permiso **Account → Account Analytics → Read**. **Nunca lo escribas en el código ni en un archivo de GitHub**. Como el token anterior se compartió en un chat, se recomienda revocarlo y crear uno nuevo.
3. En **Variables**, crea `CLOUDFLARE_ACCOUNT_ID` y coloca el identificador de tu cuenta de Cloudflare (no el bucket).
4. En **Actions**, elige **Aura Digital - Monitoreo Cloudflare**, pulsa **Run workflow** para probarlo.
5. Consulta el resumen del trabajo y descarga el archivo **aura-cloudflare-reporte**. El archivo contiene `RESUMEN.md` y `ultimo.json`.

Se ejecuta automáticamente cada día a las **14:15 UTC / 08:15 hora de Jalisco**. GitHub puede retrasar trabajos programados.

## Ventana dentro de Gallery Studio

En la barra superior, pulsa **Monitor R2**. La ventana consulta el último JSON de `monitor-estado` y permite refrescar manualmente las cifras o abrir el historial del trabajo programado. No necesitas escribir la clave de Cloudflare para mirar el estado. Se muestran datos de la última medición, **no en tiempo real**. La rama y los datos agregados son públicos por tratarse de un repositorio público.

Si el reporte deja de actualizarse, revisa la acción de GitHub para confirmar las credenciales y permisos de escritura en `monitor-estado`. La rama `main` y las galerías entregadas permanecen sin cambios.

## Qué mide

- Bucket R2 `aura-galerias`: almacenamiento actual (última muestra), número de objetos, operaciones de clase A/B y transferencia contabilizada durante el mes UTC.
- Worker `aura-gallery-r2-upload`: solicitudes y errores del mes UTC, cuando están disponibles.
- Total de solicitudes de **todos los Workers de la cuenta** desde medianoche UTC, cuando Cloudflare ofrece la métrica; a diferencia de la cifra mensual, esta se puede comparar con 100,000 solicitudes/día del plan Free. Si no está disponible, el panel lo indica.
- El comparador muestra el porcentaje utilizado y restante frente a: R2 estándar (10 GB-mes, 1 millón de operaciones A y 10 millones B al mes) y Workers Free (100,000 solicitudes/día). Son referencias, no límites técnicos configurados ni bloqueos. Para R2 la comparación es parcial: el bucket no equivale a toda la cuenta y los MB actuales no equivalen al promedio GB-mes facturable. Las descargas a Internet no usan cuota de egreso en R2.
- Avisos orientativos cuando una de las referencias llegue a 70%, 85% o 95% (visibles en el reporte, **no son notificaciones automáticas**).

Los datos se muestran como un **resumen de GitHub Actions y un artefacto que caduca en 30 días**. No se realizan commits diarios en `main`: cada ejecución también actualiza un resumen JSON de solo lectura en la rama `monitor-estado`, sin disparar el despliegue de GitHub Pages en `main`. El resumen contiene exclusivamente fecha, almacenamiento, conteos, transferencia, errores y alertas; excluye el token, Account ID, rutas de objetos y datos de clientes. No se accede a fotografías ni se muestran nombres o rutas de objetos.

**Importante:** el repositorio `GalleryStudio` es público y los resúmenes o artefactos de Actions podrían ser visibles para otras personas. El informe contiene solo cifras globales; **nunca** el token ni el Account ID. Si se necesitara confidencialidad absoluta de estas cifras, sería preferible un repositorio privado.

Los límites de Cloudflare R2 gratuitos son a nivel cuenta y la cifra de espacio actual no equivale al consumo medio facturable en GB-mes. El tráfico R2 puede omitir transferencias de menos de 100 KiB; las solicitudes no representan visitas únicas.

## Si algo falla

- `Monitoreo pendiente de configurar`: falta el secret o la variable.
- Error `HTTP 403`: revisar el permiso Analytics Read y que el token tenga acceso a la cuenta correcta.
- `sin muestra`: esperar a que Cloudflare actualice sus estadísticas.
- `Worker no disponible`: el reporte de R2 seguirá funcionando.

Consulta el [manual oficial de métricas R2](https://developers.cloudflare.com/r2/platform/metrics-analytics/) y la [documentación de secretos de GitHub](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).
