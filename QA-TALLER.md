# Actualización y QA de ESTRUCTURAS PRO 7

## Alcance de esta entrega

La app queda enfocada en el taller constructivo: perfiles, chapas, piezas paramétricas, encuentros, rigidizadores, pernos, soldaduras, mediciones en mm, planos ortográficos, aula y captura PNG. Se retiraron del flujo activo las pantallas de cálculo de esfuerzos y el estudio avanzado de render. La escena usa color plano y geometría de malla.

Incluye edición dimensional paramétrica, colocación por coordenadas/caras, ajuste a geometría visible con control de oclusión, zoom al cursor, pivote de órbita, conexiones constructivas, uniones soldadas, cotas 3D, exportación SVG y 13 plantillas didácticas. El aula contiene 32 lecciones vinculadas a sus referencias disponibles.

## Verificación realizada

- `npm test`: 271 pruebas aprobadas, 0 fallidas.
- `npm run build`: compilación de producción completada.
- Las pruebas cubren perfiles del catálogo, edición, guardado y restauración, cotas, taladros, soldaduras, holguras, vistas SVG, 13 montajes y 32 lecciones.
- En navegador: zoom sobre el punto bajo el cursor (error proyectado 0 px en las vistas probadas), vistas ortográficas, captura PNG, selección de vértices visibles, descarte de geometría ocluida, cota diagonal y el ciclo real de crear/cambiar longitud/confirmar perfil. No hubo errores de consola en esa pasada.
- Escenas de 100, 500 y 1.000 piezas: construcción 54, 213 y 405 ms; envío de cada frame a WebGL 0,6, 4,5 y 9,6 ms de mediana; ajuste del cursor P95 1,7, 5,8 y 5,9 ms. El tiempo de envío no incluye espera de pantalla ni finalización de GPU: no es una promesa de FPS. La medición corresponde a este navegador y equipo.
- El filtro de captura evita raycasts repetidos por cada arista candidata; el QA ejercita puntos, aristas, oclusión y rendimiento con esas mismas escenas.

## Límites conocidos que deben quedar claros

1. **No es CAD de fabricación certificado.** Las piezas son geometría de malla Three.js; no se incorporó un núcleo B-rep/CSG que garantice booleanas y tolerancias de taller en todos los casos.
2. **La interfaz trabaja en mm, pero no equivale a exactitud metrológica absoluta.** El motor usa geometría GPU de precisión simple en partes del flujo. Se requiere definir tolerancias, cotas y exportaciones verificables antes de prometer fabricación milimétrica.
3. **Uniones inteligentes requieren más validación constructiva.** Las plantillas y casos probados son una base didáctica. El patrón de pernos, bordes, soldaduras y rigidizadores debe contrastarse por combinación de perfiles y norma aplicable; el programa no certifica una unión.
4. **El aula no reproduce exactamente todos los 32 nodos originales.** Hay 32 lecciones y referencias disponibles, pero falta reconciliar cada modelo paramétrico con la geometría dimensional completa de su fuente.
5. **El paquete JavaScript principal supera 500 kB minificado** (aprox. 877 kB; 241 kB gzip). El build funciona, pero Vite advierte que conviene dividir el código para acelerar la carga inicial.
6. **Rendimiento por dispositivo pendiente.** El ensayo de hasta 1.000 piezas no sustituye pruebas en ordenadores modestos, móviles y proyectos mucho mayores.

## Siguiente orden recomendado

1. Comparar dimensiones, taladros, cartelas y detalles de montaje de cada lección contra planos o tablas de fabricante autorizados.
2. Incorporar formato de exportación CAD interoperable y validación geométrica robusta antes de llamar “fabricables” a las piezas.
3. Añadir una matriz de tolerancias explícita para snaps, holguras, uniones y mediciones; incluir errores y cotas de referencia en la interfaz.
4. Completar el recorrido automatizado de creación, edición, ensamblaje, soldadura, deshacer/rehacer, proyecto, aula, plano y captura en varios navegadores.
5. Dividir el bundle y perfilar proyectos grandes en equipos representativos.

La app resultante es un entorno didáctico de montaje y documentación geométrica. Las verificaciones de esta entrega comprueban el software y su geometría de malla; no sustituyen la revisión de un ingeniero ni la normativa local para diseño o fabricación.
