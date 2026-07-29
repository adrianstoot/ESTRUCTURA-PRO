# ESTRUCTURAS PRO — inventario técnico y visual

Este inventario fija qué debe modelarse a partir de las imágenes de la carpeta
`PLANTILLAS` y qué datos no pueden deducirse de ellas. Las dimensiones no visibles
no se consideran información cierta: deben quedar como parámetros editables.

## Referencia principal del editor

- Sujeto: encuentro principal de una estructura metálica industrial.
- Cámara: perspectiva de tres cuartos, ligeramente elevada, focal media y verticales
  prácticamente rectas.
- Complejidad: alta. Se distinguen pilares y vigas I/H, tubo diagonal, chapas,
  cartelas, rigidizadores, placas base, pedestal de hormigón, pernos, tuercas,
  arandelas, soldaduras, forjado colaborante y barandilla.
- Jerarquía visual: marco general → barras → uniones → piezas de unión →
  fijaciones/soldaduras → anotaciones.
- Materiales: acero laminado oscuro satinado, tornillería cincada/dorada, hormigón
  mate, chapa grecada galvanizada y pintura de protección.
- Interfaz: barra de título y acceso rápido, pestañas, Ribbon densa, árbol de modelo
  izquierdo, viewport central, inspector derecho, navegador de conexión, barra de
  vista y barra de estado.

## Inventario por imagen

| Referencia | Elementos que deben existir como componentes independientes | Información no visible / especulativa |
|---|---|---|
| `bases.JPG` | Pedestales, dos pilares, placas base, cuatro pernos por apoyo, vástagos, ganchos J, tuercas, arandelas y cartelas triangulares | Profundidad de anclaje, mortero, armadura, métrica, calidad y soldadura exacta |
| `cercha.JPG` | Cordón inferior, dos faldones superiores, montantes, diagonales y una cartela independiente en cada nudo | Sección y orientación exacta de cada barra, tornillos/soldaduras ocultos y contraflecha |
| `chapa grecada-conectores.JPG` | Vigas soporte, chapa grecada, nervios y conectores de cabeza en filas | Paso, diámetro, altura, soldadura de conectores y canto exacto de la chapa |
| `CHAPA METALICA.JPG` | Chapa colaborante, vigas de borde y conectores de cortante | La fotografía no define el perfil inferior completo ni las dimensiones exactas |
| `chapa-cartela.JPG` | Pilar, viga, placa de alma/testa, tornillos, cartela y diagonal tubular | Placa posterior, soldaduras, pretensado y rigidización interior |
| `encuentro 2.JPG` | Pilar compuesto/doble, vigas opuestas, placas de testa y rigidizadores horizontales | Componentes traseros, continuidad interior y tamaño de soldaduras |
| `encuentro 3.JPG` | Pilar, viga continua, dos diagonales inferiores y cuatro cartelas de nudo | Unión trasera, simetría completa y sistema real de fijación |
| `encuentro 4.JPG` | Pilar inferior, tramo superior, viga transversal, placas de continuidad y cajón/sleeve | Geometría interna del empalme y secuencia de montaje |
| `encuentro viga-pilar.JPG` | Dos variantes viga–pilar, chapas/casquillos y cartela superior | Tornillos y cordones no legibles, espesores y rigidez real |
| `general 2.JPG` | Pórticos, correas, arriostramientos X, bases y cerchas de cubierta | Modulación, perfiles, juntas, cimentación y acciones |
| `junta dilatacion estructura.JPG` | Dos líneas de pilares independientes, placas base separadas y vigas sin continuidad | Separación normativa del proyecto y conexión de cubierta |
| `junta dilatacion.JPG` | Dos pilares próximos, viga rematada y unión unilateral | Holgura, tapa de junta, protección al fuego y fijación oculta |
| `nudo rigido.JPG` | Pilar, dos vigas, placas de continuidad, cartelas/haunches y chapas de testa | Método de componentes, soldaduras, tornillos y refuerzo del alma |
| `pilar compuesto.JPG` | Dos perfiles paralelos y presillas/batientes independientes a varios niveles | Separación exacta, soldadura/atornillado y placas de extremo |
| `triangulación.JPG` | Dos pilares, dintel, dos diagonales X, cuatro cartelas y placas base | Tensor o barra, pretensado, cruce central y uniones posteriores |
| `vigacortada.JPG` | Dos pilares y dintel a dos aguas de canto variable con corte/haunch real | Espesor de alma/alas, empalme de cumbrera y rigidizadores internos |
| `void.JPG` | Viga alveolar/castellated con huecos hexagonales, apoyos y pilar superior | Patrón de corte, soldadura longitudinal, refuerzos de huecos y clase de sección |

## Detalles obligatorios

- Perfiles con alas, alma, radios de acuerdo y orientación de eje local.
- Chapas con espesor real, bisel opcional, cantos redondeados y perforaciones reales.
- Tornillos como conjuntos jerárquicos: cabeza hexagonal, vástago, zona roscada,
  tuerca y arandelas independientes.
- Pernos de anclaje rectos o en J con placa, arandela y tuerca.
- Cartelas y rigidizadores como piezas separadas, nunca pintados sobre otro mesh.
- Soldaduras como cordones tridimensionales con garganta, longitud, extremos y
  material propio.
- Materiales separados para acero, galvanizado, pintura, neopreno y hormigón.
- Pivotes de barras en sus ejes; placas en su centro de inserción; tornillos sobre
  su eje; conjuntos agrupados por unión.

## Hipótesis controladas

Cuando la imagen no muestre una cara posterior se asumirá simetría únicamente si la
plantilla lo declara. La clase del tornillo, métrica, diámetro del agujero, espesores,
calidad de acero, garganta de soldadura, longitud de anclaje y tolerancias serán
parámetros editables. El valor por defecto se identifica como **hipótesis de
predimensionado** y no como una dimensión extraída de la imagen.

## Orden de reconstrucción

1. Contorno y proporciones globales.
2. Ejes, niveles, modulación y orientación de perfiles.
3. Chapas y cartelas principales.
4. Tornillería, arandelas, tuercas, pernos y soldaduras.
5. Radios, biseles, perforaciones, materiales e iluminación.
6. Comparación de cámara y silueta con la referencia.
