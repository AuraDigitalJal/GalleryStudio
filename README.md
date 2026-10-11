## Gallery Studio v1.4.29 — Vista previa al compartir

En **02 · Portada → Miniatura para WhatsApp y Facebook** se pueden editar título, descripción, elegir la portada o una fotografía cargada y ver una muestra de la imagen. La exportación produce **`og-preview.jpg` (1200 × 630)** en la raíz, junto con las etiquetas Open Graph y Twitter Card en el `index.html` estático.

**Publicación desde el editor:** la URL pública se detecta, si existe, desde GitHub Pages. Puede especificarse manualmente en la misma sección de Portada cuando la galería usa dominio propio; esta dirección tiene prioridad. **ZIP alojado por cuenta propia:** para que las redes sociales carguen la miniatura, escriba antes de generar el ZIP la **dirección final y pública de la carpeta de la galería**. Si todavía no conoce la URL, el ZIP contiene la imagen social, pero deberá completar la URL y regenerar el ZIP para disponer de un `og:image` absoluto.

La vista previa social no altera las fotografías, portada ni diseño de la galería. La selección se recupera en `config.json`. WhatsApp/Facebook pueden conservar la vista previa anterior por caché.

---

# Gallery Studio v1.4.25 · Galería desplegada o con apertura manual por capítulo

- Ajuste en **Capítulos y acomodos → cada capítulo → Cómo mostrar la galería completa**.
- **Presentación normal · enlace si hay Destacados**: conserva la galería cerrada debajo de los seis destacados; el lector la abre mediante texto centrado y una única línea fina superior. Sin contorno, flecha ni latido. Si el capítulo no usa Destacados, se mantiene la galería normal con bloques de 15 fotografías.
- **Siempre desplegada · sin controles**: todas las fotografías aparecen desde el principio, con o sin Destacados; no se muestran botones de apertura ni «Ver más». El editor sigue usando carga diferida de imágenes en la galería publicada.
- Configuración independiente para todos los capítulos: Getting Ready, Misa, Recepción, Vals y Fiesta. Se guarda y recupera en `config.json`.
- El aspecto de los destacados 3×2, su rotación automática, el reproductor y las funciones de generación ZIP/publicación GitHub se mantienen, sin cambios en el mecanismo de subida.
- Compatibilidad: los archivos `config.json` previos, que no conocen `galleryDisplay`, conservan el modo de presentación original.

---

## v1.4.22 · Texto limpio y latido suave para abrir la galería

- «Presiona aquí para ver la galería completa» aparece como texto sin marco, fondo ni pastilla.
- Latido visual mínimo y espaciado (3.1 s), detenido al abrir la galería o cuando el sistema pide menos movimiento.
- Sigue siendo un control accesible y táctil con área de clic suficiente; al abrir cambia a «Ocultar galería».
- Se conserva el motor de publicación/ZIP de v1.4.18 y las fotografías y sus destacados originales.

## v1.4.19 · Botón de galería completa más intuitivo

- Debajo de los seis destacados, el botón dice «Presiona aquí para ver la galería completa».
- Ahora tiene un contorno y fondo suaves, y un área táctil más clara. Al abrir, cambia a «Ocultar galería».
- Únicamente se modifica el texto y CSS de ese botón; el motor de publicación y exportación de v1.4.18 permanece intacto.

## v1.4.18 · Corrección de publicación y ZIP en Safari

- El ZIP y la publicación funcionan cuando WebCrypto (`crypto.subtle`) no está disponible al ejecutar la aplicación como archivo local.
- Se mantiene una copia de respaldo de vista previa de cada imagen al cargarla. Si Safari deja inaccesible el archivo original, se utiliza esa copia para poder completar la exportación y publicación.
- La música se respalda en memoria al cargarla para evitar la pérdida posterior de la referencia local.
- Se identifica por nombre el archivo que no se puede recuperar, en vez de mostrar únicamente un error genérico.
- No cambia el diseño, la disposición de Destacados ni el comportamiento de reproducción.
- Si fue necesario recuperar desde una miniatura, esa imagen se publicará a la resolución de la vista previa (hasta 1600–2000 px); conviene seleccionar de nuevo los originales antes de publicar para conservar la mejor calidad.

## v1.4.17 · Destacados verticales en escritorio

- Los seis destacados mantienen la cuadrícula de **tres columnas y dos filas** en escritorio y móvil.
- Los recuadros de escritorio adoptan la misma proporción **vertical 4:5** que ya usaba el móvil, evitando los recortes excesivos de los cuadros apaisados.
- Se conserva la rotación automática individual, los encuadres ajustados y la galería completa sin cambios.

# Gallery Studio v1.4.14 · Aura Exact

Reconstrucción desde cero de la plataforma de galerías.

## Principios de esta versión
- Una sola imagen publicada por fotografía.
- Vista previa interna + ventana externa.
- Portada 16:7 en escritorio; en móvil puede conservar el marco horizontal o usar una composición adaptada. Banners de sección 16:5.
- Secciones: Getting Ready, Misa, Recepción, Vals y Fiesta.
- Diseños generales, portadas y acomodos de fotografías se controlan por separado.
- Hasta 2 videos de YouTube.
- ZIP listo para GitHub Pages y publicación directa a GitHub.
- Recuperación mediante config.json.

## Optimización
El perfil **500 KB** usa literalmente la lógica de Aura Digital v5.6.4:
- objetivo: 500 KB
- máximo: 550 KB
- mínimo: 430 KB
- lado mayor inicial: 3000 px
- búsqueda binaria de calidad en 10 iteraciones
- hasta 8 pasadas reduciendo resolución solo si sigue superando el máximo
- archivos <= 550 KB se conservan sin recomprimir
- mantiene JPEG/PNG/WebP; GIF se conserva

Los perfiles 200 y 300 KB reutilizan el mismo algoritmo con límites proporcionales; no son el preset original de Aura.


## Corrección 1.0.1 — GitHub
- Repositorios nuevos se crean con `auto_init: true` para que exista una rama inicial.
- Se usa la rama predeterminada real del repositorio.
- La publicación espera a que GitHub exponga la referencia de la rama antes de escribir.
- GitHub Pages se activa con reintentos, igual que la lógica estable de Aura.
- Se incluye `.nojekyll` y mensajes de error más claros para permisos/token.


## Corrección 1.0.2 — repositorios vacíos

La versión 1.0.0 podía crear el repositorio y dejarlo sin ramas. GitHub devuelve 409 cuando se intenta usar Git Data API sobre un repositorio vacío. La 1.0.2 detecta ese estado y lo inicializa automáticamente mediante Contents API antes de publicar. Esto permite reutilizar el mismo nombre de repositorio sin borrarlo manualmente.


## v1.0.3
- Acomodo independiente por sección: Mosaico orgánico, Editorial · portada y dípticos, Carrusel deslizable y Secuencia limpia.
- Editorial conserva la proporción natural de las fotografías para evitar recortes agresivos.
- Carrusel usa scroll-snap y navegación táctil.
- Lightbox sin flechas visibles: desliza izquierda/derecha para navegar y hacia abajo para cerrar; teclado sigue disponible en escritorio.
- El estilo elegido de cada capítulo se guarda y recupera desde config.json.


## v1.0.6 — acomodos de Aura
- Se eliminaron las reinterpretaciones de Editorial, Carrusel y Secuencia de v1.0.3.
- **Editorial Aura · portada y dípticos** replica el patrón estable de Aura v5.6.4: portada, díptico, portada; el huérfano final ocupa ancho completo.
- **Carrusel Aura** usa marcos uniformes y `object-fit: cover`, por lo que mezclar fotos horizontales y verticales ya no genera huecos. Si la sección tiene mayoría horizontal, el marco se adapta a 4:3 sin perder el comportamiento del carrusel.
- **Orgánico adaptativo** conserva la fotografía completa y adapta el número de columnas cuando hay 1, 2 o 3 fotos para evitar espacios vacíos absurdos.
- **Álbum Aura · foto completa** sustituye a Secuencia limpia.
- Cada fotografía recupera el control de encuadre de Aura: Llenar espacio / Foto completa + posición X/Y.
- El acomodo sigue siendo independiente en Getting Ready, Misa, Recepción, Vals y Fiesta.
- No se modificaron el optimizador Aura ni la publicación estable de GitHub.


## v1.0.6 · móvil más compacto
- En móvil, Orgánico muestra inicialmente hasta 12 fotos, Editorial hasta 9 y Álbum hasta 6; si hay más aparece un control minimalista **Ver N fotos más**. En escritorio se siguen mostrando todas.
- Las fotos ocultas permanecen disponibles en el lightbox; al deslizar se puede recorrer toda la sección sin alargar la página.
- El lightbox muestra al abrirse una pista gestual mínima: una línea animada y la palabra **desliza**. Desaparece sola o en cuanto el usuario toca/arrastra.
- El carrusel no se colapsa porque ya es navegación horizontal.
- No se modificó el motor Aura de optimización ni la publicación GitHub de la base estable.


## v1.0.6 · Identidad del estudio
- La cabecera puede mostrar el nombre escrito o un logo PNG.
- El logo conserva su proporción y se limita automáticamente para no invadir la navegación en escritorio ni móvil.
- La elección y el logo se guardan en config.json y se recuperan desde una galería publicada.


## v1.0.7 · bloques de 15 + música
- En móvil, Orgánico, Editorial y Álbum muestran las fotografías en bloques de **15**. Cada toque en **Ver 15 fotos más** revela el siguiente bloque; el último muestra únicamente las fotos restantes. Carrusel mantiene su navegación horizontal.
- Se eligió 15 porque equilibra longitud de página y continuidad visual, y además respeta el ritmo de 3 fotografías del patrón Editorial Aura.
- Se puede cargar música ambiente en MP3, M4A, AAC u OGG. El archivo se publica tal cual, sin recomprimir.
- Opción para iniciar la música tras la primera interacción del visitante y para reproducirla en loop. Esto respeta la restricción de autoplay de los navegadores móviles.
- La galería muestra un control musical fijo, circular y minimalista; cuando suena cambia de la nota musical a un pequeño ecualizador animado.
- El peso de la música se muestra por separado en el reporte de exportación para no confundirlo con el peso de las fotografías.
- Optimización Aura y publicación estable en GitHub permanecen intactas.


## v1.0.9 · PNG transparente del estudio

- Corrige la vista previa del logo PNG: ya no se convierte a JPEG ni se rellena de blanco.
- El canal alfa se conserva tanto en el editor como en la galería publicada.
- La optimización Aura y GitHub permanecen sin cambios.


## Cambios 1.0.9
- La música intenta reproducirse desde la apertura; si el navegador bloquea autoplay con sonido, arranca con el primer gesto del visitante.
- La sección de videos permite editar etiqueta superior, título general y texto de cada video.

## v1.1.1

- El texto pequeño de portada “NUESTRA HISTORIA” ahora es editable y puede dejarse vacío para ocultarlo.
- El control flotante de música es más transparente y discreto.
- Los capítulos pueden reordenarse con ↑ y ↓; el orden se respeta en navegación y publicación.
- El editor funciona como acordeón: solo un bloque permanece abierto para evitar un formulario interminable.
- La navegación rápida del editor se reorganizó por Identidad, Portada, Capítulos, Fotos, Multimedia y Publicar.
- Optimización y recuperación quedan como ajustes avanzados, cerrados por defecto.


### v1.1.1
- Video ahora forma parte del orden general.
- Puede colocarse inmediatamente después de la portada, entre capítulos o al final.
- La navegación superior y la galería publicada respetan la posición elegida.
- Las configuraciones anteriores siguen funcionando; si no guardaban posición de Video, se añade al final.

## v1.2.0 · música en navegación + nuevos acomodos y diseños

- La música deja de intentar reproducirse sola. Si hay audio cargado, aparece **♪ Reproducir música** dentro de la navegación; al activarse cambia a **Pausar música**. El control flotante deja de formar parte de la galería publicada.
- Los acomodos por capítulo crecen a 10 opciones y se agrupan para no volver a enredar el formulario:
  - Recomendados: Orgánico adaptativo, Editorial, Carrusel y Álbum completo.
  - Editoriales: Narrativa editorial, Collage dinámico y Secuencia deslizable.
  - Geométricos: Horizontales 4:3, Cuadrícula 1:1 y Polaroid editorial.
- Narrativa, Collage, Secuencia, Cuadrícula, Rectangular y Polaroid parten de los patrones de galería ya probados en Aura; siguen siendo independientes por capítulo.
- El diseño general también se amplía: Orgánico editorial, Portafolio enmarcado, Minimal editorial, Capas editoriales, Doble panel y Cinemático.
- El diseño general no obliga un acomodo de fotografías: cada capítulo conserva su propio selector.
- Los estilos nuevos mantienen portada 16:7 y banners 16:5, con ajustes responsivos específicos para móvil.
- El optimizador 500 KB y la publicación GitHub no se modificaron.


## v1.3.0 · inspiración Pixieset / Pic-Time

- **Destacados por capítulo:** se puede mostrar una selección inicial de 6, 9 o 12 fotografías y mantener la galería completa cerrada detrás de un control minimalista “Ver galería completa”. La selección usa las primeras fotos del capítulo, por lo que se cambia reordenando las fotografías.
- Se mantiene la carga móvil por bloques de 15 cuando se abre una galería larga.
- Nuevos acomodos por capítulo:
  - **Editorial Pro:** secuencia de protagonista, dípticos y horizontales con ritmo tipo revista.
  - **Organizado:** usa orientación y `grid-auto-flow: dense` para aprovechar mejor el espacio.
  - **Sorted:** agrupa primero horizontales, después verticales y cuadradas, conservando orden relativo dentro de cada grupo.
  - **Vertical:** da prioridad a retratos; las horizontales funcionan como cortes amplios.
  - **Horizontal:** prioriza marcos 4:3 y protagonistas panorámicas.
  - **Scattered:** composición editorial con aire y asimetría controlada; en móvil se simplifica para no romper la lectura.
- Nuevos diseños generales: **Fine Art**, **Revista editorial** y **Editorial oscuro**.
- La portada ahora se elige de forma independiente al diseño general: **Clásica cinematográfica**, **Editorial centrada**, **Doble panel** o **Marco Fine Art**.
- Animación de entrada configurable: **Suave**, **Editorial** o **Sin animación**, respetando `prefers-reduced-motion`.
- Destacados no duplican archivos físicos: reutilizan la misma imagen publicada.
- El optimizador Aura v5.6.4 y el sistema estable de publicación GitHub no fueron modificados.


## v1.3.1 · bloques universales + nombres editables
- Todos los acomodos de fotografías, incluido Carrusel y Secuencia deslizable, se despliegan en bloques de 15.
- El sistema de “Ver 15 fotos más” funciona también en escritorio para evitar galerías interminables.
- Cada capítulo tiene ahora un nombre editable independiente del título del banner.
- El nombre personalizado se usa en navegación, selectores, banner y `config.json`.
- Al recuperar una galería, se conserva el nombre personalizado de cada capítulo.


## v1.3.2 · opacidad de rectángulo en portada
- Se añade un deslizador de **Opacidad del rectángulo de portada** de 0% a 100%.
- Afecta los diseños que usan una caja de texto encima de la fotografía de portada, especialmente Minimal editorial y Capas editoriales.
- En 0% también se elimina el desenfoque y el borde de la caja para que desaparezca realmente.
- El valor se guarda en `config.json` y se recupera al reabrir una galería publicada.
- No se modifican el optimizador Aura ni la publicación GitHub.
## v1.3.3 · portadas móviles rediseñadas

- La portada móvil deja de ser una simple reducción de la versión de escritorio.
- En móvil la fotografía usa una proporción 4:5 para recuperar presencia visual.
- Minimal editorial convierte la caja de texto en una tarjeta compacta en el tercio inferior.
- Capas editoriales usa un panel desplazado y angosto, dejando visible la mayor parte de la fotografía.
- Doble panel conserva el concepto con 68% de fotografía y 32% de bloque editorial.
- Cinemático elimina cajas y sostiene el texto con un degradado inferior.
- Marco Fine Art conserva aire, marco y texto limpio sin rectángulo pesado.
- Editorial centrada mantiene texto centrado sobre la fotografía sin caja de color.
- El control de opacidad de v1.3.2 sigue funcionando en los estilos que usan panel superpuesto.
- Optimización Aura y publicación GitHub permanecen sin cambios.



## v1.3.4 · portadas móviles horizontales
- La portada móvil ya no se fuerza siempre a vertical.
- Nuevo selector **Portada en móvil**: Según el diseño / Conservar marco horizontal / Adaptarla al móvil.
- En **Según el diseño**, Clásica cinematográfica y Marco Fine Art conservan un marco horizontal real en móvil; Editorial centrada y Doble panel mantienen su adaptación específica.
- El modo horizontal compacta la tipografía y, en Minimal/Capas, conserva la placa de color sin tapar la foto.
- Se guarda y recupera mediante `config.json`.


## v1.3.5 · editor estable

- Se corrigió el salto del formulario durante las actualizaciones de la vista previa.
- El preview interno ya no usa `scrollIntoView()` para navegar a una sección, evitando que el navegador desplace también la página del editor.
- Se conserva la posición de scroll del editor, el foco del campo activo y la selección de texto mientras se refresca el iframe.
- Los cambios rápidos se agrupan ligeramente (220 ms) para reducir repintados innecesarios sin perder la vista en vivo.
- No se modificaron el optimizador Aura ni la publicación GitHub.


## v1.3.7 · responsive predecible

- En móvil ya no se ocultan automáticamente subtítulo ni descripción de la portada. Todo texto escrito por el usuario permanece visible.
- Se eliminaron alturas máximas y recortes de texto en las placas de Minimal y Capas; el bloque se ajusta al contenido.
- En portadas horizontales el texto se compacta de forma tipográfica, pero no se elimina.
- Todos los banners de capítulos tienen ahora una composición móvil real en 16:9, conservando su encuadre X/Y y haciendo que título/etiqueta respiren mejor.
- Los banners de capítulos mantienen el mismo contenido entre escritorio y móvil; solo cambian escala, proporción y posición.
- Doble panel afecta solo a la portada y deja de alterar la composición de los banners de capítulos en móvil.
- El objetivo es que la vista móvil sea predecible: ningún texto desaparece ni cambia de significado al cambiar de dispositivo.
- El optimizador Aura y la publicación GitHub permanecen sin cambios.


## v1.3.7 · Preview móvil en popup
- La vista de escritorio permanece integrada en el editor.
- Al tocar **Móvil ↗** o **Vista móvil ↗** se abre un popup real con mockup de teléfono 393 × 852, siguiendo la experiencia del preview externo de Aura.
- El popup se escala automáticamente a la pantalla disponible, se actualiza en vivo al editar y conserva la posición de desplazamiento dentro del teléfono.
- No se modificaron el optimizador Aura ni el módulo de publicación en GitHub.


## v1.3.8 · Safe area realista en preview móvil
- El popup móvil conserva el mockup de iPhone de 393 × 852.
- Se añadió una zona superior de 62 px para representar la barra de estado / isla dinámica.
- La galería dentro del mockup comienza debajo de esa zona, como en un iPhone real.
- Este ajuste afecta únicamente al preview del editor; no agrega espacio artificial a la galería publicada.


## v1.3.9 · Navegación única y contextual

- Elimina el menú duplicado debajo de la portada.
- Barra superior mínima: identidad del estudio + música + menú.
- Al desplazarse aparece el capítulo actual y una línea fina de progreso.
- El menú abre un panel lateral en escritorio y una vista amplia en móvil.
- Los capítulos se resaltan conforme avanza la lectura.
- La música queda como icono discreto y se transforma en barras al reproducirse.
- No se modificó el optimizador Aura ni la publicación GitHub.


## v1.4.3 · Menú móvil ultracompacto

- Se conserva el indicador de capítulo actual y la línea de progreso.
- El panel lateral de pantalla completa se sustituyó por un popover compacto.
- El selector de capítulos ya no bloquea ni oscurece toda la galería.
- Nuevo icono de cuatro puntos, más discreto que el menú tradicional.
- El capítulo activo se señala con un punto de acento y una superficie apenas visible.
- En móvil y escritorio mantiene el mismo lenguaje visual, con ancho máximo de 248 px.


### Ajuste v1.4.3
- Menú móvil más corto y estrecho.
- Se eliminan los números de los capítulos.
- Fondo más transparente con blur suave.
- Se elimina el encabezado “CAPÍTULOS” en móvil para reducir altura.
- El capítulo activo conserva un punto mínimo de acento.


## v1.4.3 · navegación inferior y descarga
- Se eliminó por completo el menú emergente/popup de capítulos.
- La única navegación queda inmediatamente debajo de la portada y se vuelve sticky al hacer scroll.
- Los capítulos se recorren horizontalmente en móvil; la sección activa se centra y recibe una animación/indicador fino.
- Logo o nombre del estudio queda reservado a la izquierda y música/descarga a la derecha para evitar choques.
- Descarga de fotos opcional mediante URL externa (por ejemplo WeTransfer), con icono minimalista y control mostrar/ocultar.
- El enlace de descarga se guarda en config.json y se recupera con la galería.


## v1.4.3 · Navegación limpia restaurada
- Se revierte el experimento de barra sticky compacta de v1.4.2.
- La marca del estudio vuelve a una franja superior limpia, sin capítulos.
- Los capítulos viven únicamente debajo de la portada y no se quedan pegados arriba.
- La sección activa conserva una animación editorial mínima y subrayado fino.
- Música y descarga opcional quedan aisladas a la derecha de la marca para no competir con los capítulos.
- El enlace de descarga sigue siendo opcional y acepta enlaces externos como WeTransfer.


## v1.4.4 · Navegación más limpia

- Se elimina “Presentación” de la barra de capítulos.
- La descarga deja de ocupar un icono independiente en la cabecera.
- Cuando está activa y tiene un enlace válido, aparece como **Descargar** dentro de la navegación de capítulos, con un icono pequeño.
- El enlace abre WeTransfer (u otro enlace http/https) en una pestaña nueva.
- No se modifican el optimizador Aura ni la publicación en GitHub.


## v1.4.5 · Portada sin franja superior

- Se elimina el espacio/capa visual que quedaba encima de la portada.
- La cabecera de identidad y música ahora flota sobre la fotografía sin fondo ni blur.
- La navegación de capítulos permanece únicamente debajo de la portada.
- Descargar sigue integrado como opción de esa navegación.
- No cambia el optimizador Aura ni el publicador GitHub.


## v1.4.6 · Limpieza de portadas y marcos
- Editorial limpio y Capas suaves ya no colocan rectángulos de color encima de la fotografía.
- El texto se apoya con un degradado regulable, no con una caja.
- Portafolio tonal y Fine Art usan líneas de apenas contraste con la paleta activa.
- Capas conserva profundidad con una lámina tonal casi neutra y sombras más suaves.
- Doble panel se conserva como composición principal y baja ligeramente el contraste del panel.
- El antiguo control de opacidad de caja ahora regula el apoyo/degradado de lectura.
- Optimización Aura v5.6.4 y publicación GitHub permanecen sin cambios.


## v1.4.7 · Cabecera fuera de la portada

- Corrige la superposición introducida en v1.4.5/v1.4.6.
- Logo/nombre del estudio y música vuelven a una cabecera independiente, compacta y sin fondo pesado.
- La cabecera no es sticky ni se mete dentro del banner principal.
- La portada comienza inmediatamente debajo de la cabecera, sin velo, blur ni franja translúcida.
- La navegación de capítulos permanece únicamente debajo de la portada.
- Se conserva la limpieza editorial de v1.4.6, la descarga dentro de navegación, el optimizador Aura y GitHub.


## Novedad v1.4.8 — Reproductor opcional bajo la portada

En **05 · Multimedia** activa o desactiva «Mostrar reproductor estilizado debajo de la portada». Con un archivo de música cargado aparece al lado de la navegación (debajo en móviles) e incluye título, artista, barra de progreso, duración, silencio y play/pausa. Se leen las etiquetas ID3 TIT2/TPE1 de MP3, con opción de corregir los textos; para M4A/AAC/OGG se usa el nombre del archivo como sugerencia. Si se oculta el reproductor, se mantiene el botón compacto de música en la cabecera. No hay reproducción automática. Los ajustes se exportan y recuperan mediante config.json.


## v1.4.10 — Cristal líquido compacto sobre la portada
Reproductor reducido a ~286 px de ancho en escritorio (~270 px en móvil), fondo RGBA realmente translúcido, blur suave y onda de audio inspirada en el reproductor de Aura Invitaciones. Conserva ID3, play/pausa, volumen, progreso, ocultar, carga de MP3 y publicación.


## v1.4.13 — Reproductor compacto entre portada y menú

- Conserva el reproductor slim liquid glass de v1.4.11, desplazado ligeramente hacia el centro.
- El menú de capítulos queda inmediatamente debajo, con separación visual moderada.
- El reproductor permanece fuera de la fotografía de portada.
- Sin cambios en música, metadatos, exportación ni repositorios.


## v1.4.14 — Navegación agrupada y centrada

- El contenedor del menú tiene ancho de contenido (`fit-content`), no el ancho total del sitio.
- Los enlaces se agrupan con 3 píxeles de separación y letras de espaciado más cerrado.
- Se mantiene el reproductor al centro y encima del menú.
- En pantallas pequeñas se permite el desplazamiento horizontal del menú si hiciera falta.


## v1.4.15 · Destacados dinámicos

- Seis destacados por capítulo en cuadrícula 3 × 2 (móvil y escritorio), inmediatamente después del banner del capítulo.
- Una foto cambia automáticamente cada 3.8 segundos con transición suave cuando existen más de seis fotos.
- Rotación pausada fuera de pantalla, durante interacciones y con movimiento reducido.
- El botón de galería completa y la selección de foto en el visor permanecen disponibles.
- Se activa por capítulo desde su casilla «Destacados dinámicos».


## v1.4.29 — Reproductor editorial y sin botón Compartir
- Se eliminó el botón Compartir de todos los capítulos, la vista previa y las páginas exportadas.
- Se conserva el reproductor editorial, la miniatura social y las mejoras anteriores.
- No se modifica la lógica de publicación ni los archivos de la galería.

## v1.4.28 — Reproductor editorial y compartir
- Reproductor completo con estilo minimalista, transparente y adaptado al color de texto de cada diseño; controles sin fondo ni efectos de botón abultado.
- Compartir desde la galería pública utiliza el menú nativo cuando está disponible, copia el enlace del capítulo como alternativa y muestra un campo de copia manual si el navegador bloquea el portapapeles.
- En la vista previa se informa que el enlace estará disponible al publicarse; nunca se comparte la URL del editor.
- No se modifica la lógica de publicación, el ZIP ni las galerías previamente publicadas.
