const PROGRESS_KEY = 'estructuras-pro:assembly-quiz:v1';

export class TutorialModule {
  constructor() {
    this.overlay = document.getElementById('tut-overlay');
    this.closeBtn = document.getElementById('tut-close-btn');
    this.tabs = document.querySelectorAll('.tut-tab');
    this.panes = document.querySelectorAll('.tut-pane');
    this.progFill = document.getElementById('tut-prog-fill');
    this.scoreText = document.getElementById('tut-score');
    this.currentQ = 0;
    this.score = 0;
    this.questions = [
      { topic: 'Uniones', q: '¿Cuál es la diferencia básica entre un nudo rígido y uno articulado?', opts: ['El rígido transmite giro y momento; el articulado permite el giro relativo', 'El rígido solo se monta con madera', 'El articulado no puede tener tornillos', 'No hay ninguna diferencia'], ans: 0, explanation: 'La clasificación describe cómo se restringe el giro entre las piezas.' },
      { topic: 'Uniones', q: '¿Qué debe conseguir una unión articulada de viga?', opts: ['Permitir el giro previsto y transferir las acciones que defina el detalle', 'Impedir cualquier movimiento en todos los ejes', 'Sustituir la viga por una chapa', 'Evitar que se monte el pilar'], ans: 0, explanation: 'El detalle constructivo define la rotación y la transferencia prevista.' },
      { topic: 'Apoyos', q: '¿Para qué se utiliza normalmente el neopreno en un apoyo?', opts: ['Para repartir el contacto y admitir pequeños giros o movimientos', 'Para sustituir los tornillos de alta resistencia', 'Para aumentar el canto de la viga', 'Para marcar los ejes de replanteo'], ans: 0, explanation: 'El neopreno forma una capa de apoyo deformable entre superficies.' },
      { topic: 'Placas base', q: '¿Qué función cumple una placa base bajo un pilar metálico?', opts: ['Apoyar el pilar y repartir la transmisión hacia el hormigón', 'Cerrar el extremo superior del pilar', 'Unir dos chapas de cubierta', 'Evitar el uso de una cimentación'], ans: 0, explanation: 'La placa base proporciona una superficie de apoyo y conexión con la cimentación.' },
      { topic: 'Anclajes', q: '¿Qué elemento fija habitualmente la placa base a la cimentación?', opts: ['Pernos de anclaje', 'Arandelas de plástico', 'Un perfil UPN suelto', 'Una cartela de cubierta'], ans: 0, explanation: 'Los anclajes se disponen en la cimentación y sujetan la placa base.' },
      { topic: 'Rigidizadores', q: '¿Para qué sirve un rigidizador unido al alma de una viga?', opts: ['Para limitar deformaciones locales y ayudar a transmitir cargas concentradas', 'Para alargar la viga sin empalme', 'Para tapar todos los agujeros', 'Para cambiar el grado del acero'], ans: 0, explanation: 'El rigidizador refuerza localmente el alma donde lo requiere el detalle.' },
      { topic: 'Cartelas', q: '¿Qué aporta una cartela en el encuentro de una diagonal?', opts: ['Una chapa de conexión para unir la diagonal con el resto del nudo', 'Un acabado decorativo sin contacto con las barras', 'Un apoyo de neopreno', 'Un agujero para izar el edificio'], ans: 0, explanation: 'La cartela crea la superficie donde se conectan una o varias barras.' },
      { topic: 'Placas de testa', q: '¿Dónde se coloca normalmente una chapa de testa?', opts: ['En el extremo de una viga para conectarla a otra pieza', 'Debajo del hormigón de limpieza', 'En mitad del alma sin conexión', 'En el interior de un tornillo'], ans: 0, explanation: 'La chapa de testa se fabrica en el extremo de la viga y se une a la pieza receptora.' },
      { topic: 'Tornillería', q: '¿Qué función principal tiene una arandela bajo una tuerca o una cabeza de tornillo?', opts: ['Repartir el apoyo local y proteger la superficie de contacto', 'Aumentar la longitud de la pieza', 'Sustituir la placa de conexión', 'Bloquear la cámara 3D'], ans: 0, explanation: 'La arandela ofrece una superficie de apoyo mayor que la tuerca o la cabeza.' },
      { topic: 'Tornillería', q: '¿Qué indica una designación como M16 en un tornillo?', opts: ['Un diámetro nominal de rosca de 16 mm', 'Una longitud de 16 m', 'Una resistencia de 16 kN', 'Un agujero de 16 cm'], ans: 0, explanation: 'M16 es una designación métrica; el diámetro nominal de la rosca es 16 mm.' },
      { topic: 'Montaje', q: 'Antes de apretar definitivamente los tornillos de un pórtico, conviene:', opts: ['Alinear las piezas y comprobar aplomado, nivel y geometría', 'Retirar todos los elementos de medida', 'Cortar los pernos sobrantes sin revisar', 'Pintar las superficies de contacto'], ans: 0, explanation: 'La comprobación geométrica previa evita fijar una estructura fuera de posición.' },
      { topic: 'Montaje', q: '¿Qué ayuda a mantener un pilar vertical durante el montaje?', opts: ['Comprobar su aplomado con una referencia o instrumento de medida', 'Medir solo el ancho de la placa base', 'Apretar un único tornillo sin revisar', 'Cambiar la vista a perspectiva'], ans: 0, explanation: 'El aplomado controla la verticalidad del pilar en dos direcciones.' },
      { topic: 'Agujeros', q: '¿Por qué se deja material suficiente entre un agujero y el borde de una chapa?', opts: ['Para reducir el riesgo de desgarro y permitir un montaje correcto', 'Para que la chapa pese más', 'Para ocultar la cabeza del tornillo', 'Para convertir el agujero en una soldadura'], ans: 0, explanation: 'Las distancias a borde son una condición geométrica y de fabricación de la unión.' },
      { topic: 'Agujeros', q: '¿Para qué se realiza una matriz de agujeros en una placa?', opts: ['Para colocar varios tornillos con una separación definida', 'Para cambiar el color de la placa', 'Para medir el ángulo de la cubierta', 'Para crear una rosca en el hormigón'], ans: 0, explanation: 'La matriz organiza las posiciones de los tornillos en filas y columnas.' },
      { topic: 'Tolerancias', q: '¿Qué ventaja da una holgura de montaje prevista en el detalle?', opts: ['Facilita presentar y encajar las piezas dentro de la tolerancia definida', 'Permite omitir la medición', 'Hace que las piezas no necesiten apoyo', 'Aumenta automáticamente la resistencia del acero'], ans: 0, explanation: 'La holgura facilita el montaje, pero debe respetar el detalle y la tolerancia especificados.' },
      { topic: 'Soldadura', q: 'Antes de ejecutar un cordón de soldadura, las superficies deben estar:', opts: ['Preparadas y limpias según el procedimiento de soldadura', 'Cubiertas de pintura y grasa', 'Separadas sin control', 'Marcadas únicamente con rotulador'], ans: 0, explanation: 'La preparación de bordes y la limpieza forman parte del procedimiento de unión.' },
      { topic: 'Soldadura', q: '¿Qué describe la garganta a de una soldadura de ángulo?', opts: ['La dimensión eficaz del cordón indicada en el detalle', 'La longitud total del pilar', 'El diámetro nominal de un perno', 'El espesor de la losa'], ans: 0, explanation: 'La garganta es una dimensión del cordón; no existe un único valor válido para todas las uniones.' },
      { topic: 'Planos', q: '¿Qué característica tiene un alzado ortográfico de taller?', opts: ['Proyecta la pieza sin perspectiva y conserva sus dimensiones en el plano de proyección', 'Inclina las líneas para dar sensación de profundidad', 'Muestra solo una fotografía', 'Cambia las medidas según la distancia a cámara'], ans: 0, explanation: 'La proyección ortográfica es adecuada para representar y acotar geometría técnica.' },
      { topic: 'Pieza libre', q: 'Al terminar una polilínea cerrada en la herramienta Pieza libre, ¿qué se debe definir para obtener una chapa 3D?', opts: ['El espesor y el plano de trabajo de la pieza', 'La velocidad de la cámara', 'El color del fondo', 'El número de plantas del edificio'], ans: 0, explanation: 'El contorno define la forma 2D y el espesor produce la pieza extruida.' },
      { topic: 'Control dimensional', q: 'En este editor, ¿qué unidad debe usarse para ajustar una pieza con precisión de taller?', opts: ['Milímetros (mm)', 'Kilómetros (km)', 'Hectáreas (ha)', 'Grados Celsius (°C)'], ans: 0, explanation: 'Las cotas y desplazamientos de montaje se expresan en milímetros.' },
    ];
    this._initEvents();
    this.loadProgress();
  }

  _initEvents() {
    if (!this.overlay) return;
    this.closeBtn?.addEventListener('click', () => this.hide());
    this.tabs.forEach(tab => tab.addEventListener('click', event => {
      this.tabs.forEach(item => item.classList.remove('active'));
      event.currentTarget.classList.add('active');
      const targetId = event.currentTarget.dataset.tab;
      this.panes.forEach(pane => pane.classList.toggle('hidden', pane.id !== targetId));
      if (targetId === 'tut-quiz') this.loadQuiz();
    }));
  }

  show() { this.overlay?.classList.remove('hidden'); }
  hide() { this.overlay?.classList.add('hidden'); }

  loadQuiz() {
    const label = document.getElementById('q-title');
    const text = document.getElementById('q-text');
    const options = document.getElementById('q-options');
    const feedback = document.getElementById('q-feedback');
    if (!label || !text || !options || !feedback) return;

    if (this.currentQ >= this.questions.length) {
      label.textContent = this.score === this.questions.length ? '¡Dominio completo!' : 'Test finalizado';
      text.textContent = `Resultado: ${this.score} de ${this.questions.length} respuestas correctas.`;
      options.replaceChildren();
      feedback.replaceChildren();
      feedback.style.color = this.score === this.questions.length ? 'var(--success)' : 'var(--warning)';
      feedback.append(this.score === this.questions.length ? 'Has completado el repaso de montaje.' : 'Puedes repetir el test para repasar las uniones.');
      const retry = document.createElement('button');
      retry.className = 'q-btn-next';
      retry.textContent = 'Repetir test';
      retry.addEventListener('click', () => { this.currentQ = 0; this.score = 0; this.saveProgress(); this.loadQuiz(); });
      feedback.append(retry);
      return;
    }

    const question = this.questions[this.currentQ];
    feedback.replaceChildren();
    feedback.style.color = '';
    label.textContent = `${question.topic} · Pregunta ${this.currentQ + 1} de ${this.questions.length}`;
    text.textContent = question.q;
    const answerOrder = question.opts.map((_, index) => index);
    for (let index = answerOrder.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [answerOrder[index], answerOrder[swapIndex]] = [answerOrder[swapIndex], answerOrder[index]];
    }
    options.replaceChildren(...answerOrder.map(index => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'q-opt';
      button.dataset.answerIndex = String(index);
      button.textContent = question.opts[index];
      button.addEventListener('click', () => this.answerQuiz(index, button));
      return button;
    }));
  }

  answerQuiz(index, button) {
    const question = this.questions[this.currentQ];
    const feedback = document.getElementById('q-feedback');
    if (!question || !feedback) return;
    const options = [...document.querySelectorAll('.q-opt')];
    options.forEach(option => { option.disabled = true; });
    const correct = index === question.ans;
    options.find(option => Number(option.dataset.answerIndex) === question.ans)?.classList.add('correct');
    if (correct) this.score += 1;
    else button.classList.add('wrong');
    feedback.replaceChildren();
    feedback.style.color = correct ? 'var(--success)' : 'var(--danger)';
    feedback.append(`${correct ? '¡Correcto!' : 'Incorrecto.'} ${question.explanation}`);
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'q-btn-next';
    next.textContent = 'Siguiente';
    next.addEventListener('click', () => { this.currentQ += 1; this.saveProgress(); this.loadQuiz(); });
    feedback.append(next);
    this.updateBar();
  }

  saveProgress() {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ score: this.score, question: this.currentQ }));
    this.updateBar();
  }

  loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      const question = Number(saved.question);
      const score = Number(saved.score);
      this.currentQ = Number.isInteger(question) ? Math.max(0, Math.min(question, this.questions.length)) : 0;
      this.score = Number.isInteger(score) ? Math.max(0, Math.min(score, this.currentQ, this.questions.length)) : 0;
    } catch (_) {
      this.currentQ = 0;
      this.score = 0;
    }
    this.updateBar();
  }

  updateBar() {
    if (!this.progFill || !this.scoreText) return;
    this.progFill.style.width = `${(this.score / this.questions.length) * 100}%`;
    this.scoreText.textContent = `${this.score} / ${this.questions.length} aciertos`;
  }
}
