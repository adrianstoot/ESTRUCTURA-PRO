/**
 * Inventario visual de PLANTILLAS.
 *
 * `observed` describe únicamente lo visible. `inferred` interpreta la función
 * constructiva. Todo lo que no puede medirse o confirmarse en una fotografía
 * queda listado en `speculative`; no debe tratarse como dato normativo.
 */
export const REFERENCE_IMAGE_INVENTORY = Object.freeze([
  { file: '0 bases.JPG', observed: ['Dos pilares con placas base, rigidizadores y herrajes superiores visibles.', 'Barras de anclaje prolongadas dentro del hormigón.'], inferred: ['Conjunto de placa base rigidizada.'], speculative: ['Dimensiones, métrica, grado y geometría J de los anclajes.'] },
  { file: '1 cercha.JPG', observed: ['Cercha a dos aguas con cordones, montantes, diagonales y cartelas rojas.'], inferred: ['Tipología Pratt/Warren editable.'], speculative: ['Secciones, modulación, espesores y método soldado/atornillado.'] },
  { file: '2 chapa grecada-conectores.JPG', observed: ['Chapa grecada sobre vigas I con filas de conectores de cabeza.'], inferred: ['Forjado colaborante con pernos conectores.'], speculative: ['Canto/paso de greca, calibre y diámetro/separación de conectores.'] },
  { file: '3 CHAPA METALICA.JPG', observed: ['Paños de chapa grecada apoyados sobre vigas metálicas.'], inferred: ['Deck metálico de forjado.'], speculative: ['Perfil exacto de greca, solapes y fijaciones.'] },
  { file: '4 chapa-cartela.JPG', observed: ['Viga-pilar con chapa vertical, seis fijaciones visibles y cartela triangular.'], inferred: ['Unión atornillada rigidizada.'], speculative: ['Transmisión resistente, cotas, soldaduras y clase de tornillo.'] },
  { file: '5 encuentro 2.JPG', observed: ['Vigas opuestas en pilar y refuerzo inferior de geometría ahusada.'], inferred: ['Nudo de momento con cartela inferior.'], speculative: ['Continuidad interna, espesores y detalle de soldadura.'] },
  { file: '6 encuentro 3.JPG', observed: ['Nudo simétrico con vigas, refuerzos inferiores y chapas de continuidad.'], inferred: ['Encuentro rígido acartelado.'], speculative: ['Cotas, soldaduras, rigidez y resistencia real.'] },
  { file: '7 encuentro 4.JPG', observed: ['Vigas a ambos lados y continuidad superior mediante chapa/conectores.'], inferred: ['Nudo de continuidad de pilar.'], speculative: ['Topología oculta y secuencia de montaje.'] },
  { file: '8 encuentro viga-pilar.JPG', observed: ['Variantes de encuentro con pequeño tirante/cartela o casquillo de apoyo.'], inferred: ['Uniones articuladas o semirrígidas.'], speculative: ['Clasificación rotacional y fijaciones ocultas.'] },
  { file: '9 general 2.JPG', observed: ['Estructura de varios vanos/niveles con pórticos, cerchas y cruces de arriostramiento.'], inferred: ['Modelo estructural completo modular.'], speculative: ['Luces, alturas, perfiles, cargas y sistema resistente global.'] },
  { file: '10 junta dilatacion estructura.JPG', observed: ['Dos alineaciones de pilares y vigas separadas por un hueco.'], inferred: ['Junta de dilatación estructural.'], speculative: ['Anchura de junta, grados de libertad y apoyo deslizante.'] },
  { file: '11 junta dilatacion.JPG', observed: ['Extremo de viga junto a pilar con asiento/accesorio terminal.'], inferred: ['Apoyo que permite movimiento relativo.'], speculative: ['Dirección de movimiento, holgura, neopreno y retención.'] },
  { file: '12 nudo rigido.JPG', observed: ['Zona de pilar encamisada con diafragmas horizontales y vigas en varias caras.'], inferred: ['Nudo rígido reforzado.'], speculative: ['Chapas internas, penetración de soldadura y secuencia constructiva.'] },
  { file: '13 pilar compuesto.JPG', observed: ['Dos perfiles verticales separados unidos mediante presillas; viga conectada a media altura.'], inferred: ['Pilar compuesto empresillado.'], speculative: ['Separación, perfil, paso de presillas y modelo de pandeo.'] },
  { file: '14 triangulación.JPG', observed: ['Pórtico con dos diagonales cruzadas, cartelas de esquina y bases ancladas.'], inferred: ['Vano arriostrado en X.'], speculative: ['Conexión en cruce, pretensado y capacidad de compresión de tirantes.'] },
  { file: '15 vigacortada.JPG', observed: ['Viga de alma profunda y canto variable/ahusado.'], inferred: ['Viga armada o recortada.'], speculative: ['Proceso de fabricación, espesor de alma y clasificación seccional.'] },
  { file: '16 void.JPG', observed: ['Viga con repetición de huecos hexagonales entre pilares.'], inferred: ['Viga alveolar/castellated.'], speculative: ['Paso, diámetro equivalente, soldadura de fabricación y comprobación Vierendeel.'] },
]);

export const PRESET_REFERENCE_NOTES = Object.freeze({
  'portal-duopitch': { sources: ['0 bases.JPG', '1 cercha.JPG', '9 general 2.JPG'], confidence: 'reference-informed', speculative: ['Dimensiones de cartelas, anclajes y perfiles por defecto.'] },
  truss: { sources: ['1 cercha.JPG'], confidence: 'reference-informed', speculative: ['Canto de talón, perfiles y espesor/tamaño de cartelas.'] },
  'portal-flat': { sources: ['8 encuentro viga-pilar.JPG', '9 general 2.JPG'], confidence: 'reference-informed', speculative: ['Casquillos, apoyos y perfiles por defecto.'] },
  'endplate-rigid': { sources: ['4 chapa-cartela.JPG', '12 nudo rigido.JPG'], confidence: 'reference-informed', speculative: ['Disposición 4/8, separaciones y rigidizadores.'] },
  'double-cleat': { sources: ['8 encuentro viga-pilar.JPG'], confidence: 'reference-informed', speculative: ['Fijación del ala al soporte y holgura de montaje.'] },
  'baseplate-rigid': { sources: ['0 bases.JPG'], confidence: 'reference-informed', speculative: ['Anclajes J, empotramiento y cartelas por defecto.'] },
  'beam-splice': { sources: ['7 encuentro 4.JPG'], confidence: 'concept-derived', speculative: ['Cubrejuntas, patrón y separación de extremos.'] },
  'braced-bay-x': { sources: ['14 triangulación.JPG'], confidence: 'reference-informed', speculative: ['Conexión del cruce y sección de diagonales.'] },
  'castellated-beam': { sources: ['16 void.JPG'], confidence: 'reference-informed', speculative: ['Paso, tamaño y fabricación de aberturas.'] },
  'composite-column-batten': { sources: ['13 pilar compuesto.JPG'], confidence: 'reference-informed', speculative: ['Separación y paso de presillas.'] },
  'expansion-joint-frame': { sources: ['10 junta dilatacion estructura.JPG', '11 junta dilatacion.JPG'], confidence: 'reference-informed', speculative: ['Holgura y mecanismo de deslizamiento.'] },
  'steel-deck-studs': { sources: ['2 chapa grecada-conectores.JPG', '3 CHAPA METALICA.JPG'], confidence: 'reference-informed', speculative: ['Geometría de greca, calibre y paso de conectores.'] },
  'rigid-haunched-node': { sources: ['5 encuentro 2.JPG', '6 encuentro 3.JPG', '12 nudo rigido.JPG'], confidence: 'reference-informed', speculative: ['Espesores, soldaduras y rigidez real del nudo.'] },
});