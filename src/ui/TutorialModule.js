export class TutorialModule {
  constructor() {
    this.overlay = document.getElementById('tut-overlay');
    this.closeBtn = document.getElementById('tut-close-btn');
    this.tabs = document.querySelectorAll('.tut-tab');
    this.panes = document.querySelectorAll('.tut-pane');
    this.progFill = document.getElementById('tut-prog-fill');
    this.scoreText = document.getElementById('tut-score');
    
    // Quiz state
    this.currentQ = 0;
    this.score = 0;
    
    this.questions = [
      {
        topic: "Clasificación de secciones",
        q: "Según el Anejo 22 (EN 1993-1-1), ¿qué caracteriza a una sección de Clase 1?",
        opts: [
          "Puede formar una rótula plástica con capacidad de rotación suficiente",
          "Solo alcanza el momento elástico antes de abollar",
          "Debe calcularse siempre con propiedades efectivas",
          "No puede trabajar a compresión"
        ],
        ans: 0,
        explanation: "Una sección Clase 1 puede desarrollar una rótula plástica y mantener la rotación exigida por un análisis plástico."
      },
      {
        topic: "Clasificación de secciones",
        q: "En una sección de Clase 4 sometida a compresión o flexión, el pandeo local se considera mediante:",
        opts: [
          "El área y módulo resistentes brutos sin reducción",
          "Propiedades eficaces, como Aeff o Weff",
          "Un aumento del límite elástico",
          "La reducción exclusiva del módulo E"
        ],
        ans: 1,
        explanation: "Las secciones Clase 4 requieren propiedades eficaces que descuentan las zonas esbeltas afectadas por pandeo local."
      },
      {
        topic: "Clasificación de secciones",
        q: "El parámetro ε = √(235/fy) interviene en los límites ancho/espesor. Si aumenta fy manteniendo la geometría:",
        opts: [
          "ε aumenta y la clasificación mejora",
          "ε disminuye y la clasificación puede ser más desfavorable",
          "ε no cambia",
          "La sección pasa automáticamente a Clase 1"
        ],
        ans: 1,
        explanation: "Al aumentar fy disminuye ε; para la misma relación c/t, los límites de clasificación resultan más exigentes."
      },
      {
        topic: "Clasificación de secciones",
        q: "¿Qué módulo resistente corresponde normalmente al cálculo de My,Rd?",
        opts: [
          "Wpl,y en Clases 1-2; Wel,y en Clase 3; Weff,y en Clase 4",
          "Wel,y en todas las clases",
          "Wpl,y únicamente en Clase 1 y cero en las demás",
          "Iy directamente, sin dividir por una distancia"
        ],
        ans: 0,
        explanation: "El Anejo 22 selecciona el módulo plástico, elástico o eficaz según la clase de la sección."
      },
      {
        topic: "Pandeo",
        q: "Para una barra biarticulada, E = 210 000 MPa, I = 80·10⁶ mm⁴ y Lcr = 4 000 mm. ¿Cuál es aproximadamente Ncr = π²EI/Lcr²?",
        opts: ["1,04 MN", "10,36 MN", "103,6 MN", "0,104 MN"],
        ans: 1,
        explanation: "Ncr = π²·210000·80·10⁶/4000² ≈ 10,36·10⁶ N = 10,36 MN."
      },
      {
        topic: "Pandeo",
        q: "Para una sección de Clase 1-3, la esbeltez adimensional de pandeo por flexión se expresa como:",
        opts: [
          "λ̄ = √(A·fy/Ncr)",
          "λ̄ = NEd/Ncr",
          "λ̄ = Lcr/I",
          "λ̄ = √(Ncr/(A·fy))"
        ],
        ans: 0,
        explanation: "La esbeltez adimensional compara la resistencia de la sección A·fy con la carga crítica elástica Ncr."
      },
      {
        topic: "Pandeo",
        q: "La resistencia de cálculo a pandeo de una barra comprimida de Clase 1-3 es:",
        opts: [
          "Nb,Rd = A·fy·γM1",
          "Nb,Rd = χ·A·fy/γM1",
          "Nb,Rd = Ncr/χ",
          "Nb,Rd = χ·E·I/Lcr"
        ],
        ans: 1,
        explanation: "El coeficiente reductor χ recoge la pérdida de resistencia por esbeltez e imperfecciones: Nb,Rd = χAfy/γM1."
      },
      {
        topic: "Pandeo",
        q: "En un perfil HEB comprimido, ¿por qué deben comprobarse los ejes y-y y z-z por separado?",
        opts: [
          "Porque fy cambia con el eje",
          "Porque I, Lcr y la curva de pandeo pueden ser distintos en cada eje",
          "Porque γM1 vale siempre 1,0 en y-y y 1,25 en z-z",
          "Porque solo el eje fuerte puede pandear"
        ],
        ans: 1,
        explanation: "La inercia, la longitud eficaz y la curva de pandeo pueden diferir; suele gobernar el eje con menor resistencia, pero debe verificarse."
      },
      {
        topic: "Vuelco lateral",
        q: "El vuelco lateral de una viga flectada combina principalmente:",
        opts: [
          "Desplazamiento lateral del ala comprimida y torsión de la sección",
          "Aplastamiento del alma y tracción de los tornillos",
          "Pandeo local exclusivo del ala traccionada",
          "Retracción térmica y fluencia"
        ],
        ans: 0,
        explanation: "El pandeo lateral-torsional aparece cuando la zona comprimida puede desplazarse lateralmente y la sección gira."
      },
      {
        topic: "Vuelco lateral",
        q: "Una viga con arriostramiento lateral continuo y eficaz del ala comprimida:",
        opts: [
          "Siempre tiene χLT = 0",
          "Puede considerar no relevante el vuelco lateral si el arriostramiento se justifica",
          "Debe duplicar MEd",
          "Solo puede comprobarse como sección Clase 4"
        ],
        ans: 1,
        explanation: "Un arriostramiento continuo adecuado puede impedir el modo lateral-torsional, pero su eficacia debe estar justificada."
      },
      {
        topic: "ELU / ELS",
        q: "¿Qué pareja relaciona correctamente los estados límite?",
        opts: [
          "ELU: resistencia y estabilidad; ELS: flecha, vibración y uso",
          "ELU: confort; ELS: rotura",
          "ELU: solo soldaduras; ELS: solo perfiles",
          "ELU y ELS son comprobaciones idénticas"
        ],
        ans: 0,
        explanation: "ELU controla seguridad frente a rotura o inestabilidad; ELS controla funcionamiento, deformaciones y confort."
      },
      {
        topic: "ELU / ELS",
        q: "Si el aprovechamiento η = Ed/Rd vale 1,08, la interpretación correcta es:",
        opts: [
          "Cumple con una reserva del 8 %",
          "No cumple: la solicitación supera la resistencia",
          "Cumple únicamente en ELS",
          "No puede interpretarse porque η siempre debe ser negativo"
        ],
        ans: 1,
        explanation: "La condición de resistencia es η ≤ 1,00. Un valor 1,08 supera la capacidad en un 8 %."
      },
      {
        topic: "ELU / ELS",
        q: "Para estimar de forma coherente la flecha de una viga no basta con conocer MEd. También se necesita:",
        opts: [
          "El modelo de apoyos, la distribución de carga y la rigidez E·I",
          "Solo el color del material",
          "Únicamente la resistencia última fu",
          "El diámetro de los tornillos de la unión"
        ],
        ans: 0,
        explanation: "La deformada depende de apoyos, cargas de servicio, longitud y rigidez flexional; MEd de ELU por sí solo no define la flecha."
      },
      {
        topic: "Uniones atornilladas",
        q: "Para un tornillo métrico M16 de rosca normal, el área resistente a tracción As es aproximadamente:",
        opts: ["84,3 mm²", "157 mm²", "201 mm²", "245 mm²"],
        ans: 1,
        explanation: "El área resistente de la rosca de un M16 es As = 157 mm²; 201 mm² es aproximadamente el área bruta del vástago."
      },
      {
        topic: "Uniones atornilladas",
        q: "Para un M16 8.8 no avellanado, con k2 = 0,9 y γM2 = 1,25, ¿cuál es Ft,Rd = k2·fub·As/γM2?",
        opts: ["45,2 kN", "67,8 kN", "90,4 kN", "120,6 kN"],
        ans: 2,
        explanation: "Ft,Rd = 0,9·800·157/1,25 = 90 432 N ≈ 90,4 kN."
      },
      {
        topic: "Uniones atornilladas",
        q: "En la resistencia a cortante Fv,Rd de un tornillo, si el plano de corte atraviesa la rosca se utiliza normalmente:",
        opts: [
          "El área resistente As",
          "Siempre el área bruta πd²/4",
          "El área de la chapa",
          "El módulo resistente del perfil"
        ],
        ans: 0,
        explanation: "Cuando la rosca queda en el plano de corte se emplea As; si el plano atraviesa el vástago liso puede emplearse el área bruta."
      },
      {
        topic: "Uniones atornilladas",
        q: "La resistencia a aplastamiento Fb,Rd = k1·αb·fu·d·t/γM2 depende de:",
        opts: [
          "Distancias a borde, separaciones, fu de la chapa, diámetro y espesor",
          "Solo de fy del tornillo",
          "Únicamente de E y ν",
          "La longitud total de la viga"
        ],
        ans: 0,
        explanation: "Los coeficientes k1 y αb incorporan bordes, separaciones y relación de resistencias; además intervienen fu, d y t."
      },
      {
        topic: "Uniones atornilladas",
        q: "La interacción simplificada de Anejo 26 (EN 1993-1-8) para un tornillo sometido a cortante y tracción es:",
        opts: [
          "Fv,Ed/Fv,Rd + Ft,Ed/(1,4·Ft,Rd) ≤ 1",
          "Fv,Ed + Ft,Ed ≤ 1 kN",
          "Fv,Rd/Fv,Ed − Ft,Rd/Ft,Ed ≤ 0",
          "(Fv,Ed·Ft,Ed)² ≤ 1"
        ],
        ans: 0,
        explanation: "La comprobación combina los dos aprovechamientos e incluye el factor 1,4 en el término de tracción."
      },
      {
        topic: "Grupos de tornillos",
        q: "En una matriz de tornillos, un momento Mx que abre la unión se reparte elásticamente como una tracción adicional:",
        opts: [
          "Igual en todos los tornillos, independientemente de su posición",
          "Proporcional a yi/Σy²",
          "Proporcional a 1/yi",
          "Solo en el tornillo más próximo al centro"
        ],
        ans: 1,
        explanation: "En el reparto elástico, Ft,i incluye Mx·yi/Σy²; los tornillos más alejados del centro reciben mayor incremento."
      },
      {
        topic: "Soldaduras",
        q: "En el método simplificado para un cordón de ángulo, la resistencia total se obtiene con:",
        opts: [
          "fvw,d = fu/(√3·βw·γM2) y Fw,Rd = fvw,d·a·Leff",
          "Fw,Rd = E·I/L²",
          "Fw,Rd = fy·d²",
          "Fw,Rd = fu/(a·Leff)"
        ],
        ans: 0,
        explanation: "La resistencia por unidad de longitud es fvw,d·a; multiplicarla por Leff proporciona la resistencia del cordón comprobado."
      },
      {
        topic: "Soldaduras",
        q: "Según Anejo 26 (EN 1993-1-8), un cordón resistente con garganta a debe tener una longitud eficaz no inferior a:",
        opts: [
          "max(30 mm, 6a)",
          "2a",
          "10 mm sin depender de a",
          "La mitad del diámetro del tornillo"
        ],
        ans: 0,
        explanation: "Los cordones con Leff menor que 30 mm o menor que 6a no deben considerarse resistentes; gobierna el mayor límite."
      }
    ];

    this._initEvents();
    this.loadProgress();
  }

  _initEvents() {
    if(!this.overlay) return;

    this.closeBtn.addEventListener('click', () => this.hide());
    
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const targetId = e.currentTarget.dataset.tab;
        this.panes.forEach(p => {
          if(p.id === targetId) p.classList.remove('hidden');
          else p.classList.add('hidden');
        });
        
        if(targetId === 'tut-quiz') {
          this.loadQuiz();
        }
      });
    });
  }

  show() {
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }

  loadQuiz() {
    const qLabel = document.getElementById('q-title');
    const qText = document.getElementById('q-text');
    const qOpts = document.getElementById('q-options');
    const qFeed = document.getElementById('q-feedback');
    if (!qLabel || !qText || !qOpts || !qFeed) return;

    if (this.currentQ >= this.questions.length) {
      const perfect = this.score === this.questions.length;
      qLabel.innerText = perfect ? '¡Dominio completo!' : 'Test finalizado';
      qText.innerText = `Resultado: ${this.score} de ${this.questions.length} respuestas correctas.`;
      qOpts.innerHTML = '';
      qFeed.style.color = perfect ? 'var(--success)' : 'var(--warning)';
      qFeed.innerText = perfect
        ? 'Has resuelto correctamente todo el banco ETSIE.'
        : 'Puedes repetir el test para consolidar los temas pendientes. ';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'q-btn-next';
      retryBtn.innerText = 'Repetir test';
      retryBtn.onclick = () => {
        this.currentQ = 0;
        this.score = 0;
        this.saveProgress();
        this.loadQuiz();
      };
      qFeed.appendChild(retryBtn);
      return;
    }

    qFeed.innerText = '';
    const q = this.questions[this.currentQ];
    const topicPrefix = q.topic ? `${q.topic} · ` : '';
    qLabel.innerText = `${topicPrefix}Pregunta ${this.currentQ + 1} de ${this.questions.length}`;
    qText.innerText = q.q;

    qOpts.innerHTML = '';
    q.opts.forEach((txt, i) => {
      const btn = document.createElement('button');
      btn.className = 'q-opt';
      btn.innerText = txt;
      btn.onclick = () => this.answerQuiz(i, btn);
      qOpts.appendChild(btn);
    });
  }

  answerQuiz(idx, btn) {
    const opts = document.querySelectorAll('.q-opt');
    const question = this.questions[this.currentQ];
    const qFeed = document.getElementById('q-feedback');
    if (!question || !qFeed) return;

    opts.forEach(o => o.style.pointerEvents = 'none');
    const correctIdx = question.ans;
    const explanation = question.explanation ? ` ${question.explanation}` : '';

    if (idx === correctIdx) {
      btn.classList.add('correct');
      qFeed.style.color = 'var(--success)';
      qFeed.innerText = `¡Correcto!${explanation}`;
      this.score++;
    } else {
      btn.classList.add('wrong');
      opts[correctIdx]?.classList.add('correct');
      qFeed.style.color = 'var(--danger)';
      qFeed.innerText = `Incorrecto.${explanation}`;
    }

    const nxtBtn = document.createElement('button');
    nxtBtn.className = 'q-btn-next';
    nxtBtn.innerText = 'Siguiente';
    nxtBtn.onclick = () => {
      this.currentQ++;
      this.saveProgress();
      this.loadQuiz();
    };
    qFeed.appendChild(nxtBtn);
  }

  saveProgress() {
    localStorage.setItem('comet_upv_score', this.score);
    localStorage.setItem('comet_upv_q', this.currentQ);
    this.updateBar();
  }

  loadProgress() {
    const savedScore = Number.parseInt(localStorage.getItem('comet_upv_score'), 10);
    const savedQuestion = Number.parseInt(localStorage.getItem('comet_upv_q'), 10);

    this.currentQ = Number.isInteger(savedQuestion) && savedQuestion >= 0
      ? Math.min(savedQuestion, this.questions.length)
      : 0;
    this.score = Number.isInteger(savedScore) && savedScore >= 0
      ? Math.min(savedScore, this.currentQ, this.questions.length)
      : 0;

    this.updateBar();
  }

  updateBar() {
    if(!this.progFill) return;
    const pct = (this.score / this.questions.length) * 100;
    this.progFill.style.width = `${pct}%`;
    this.scoreText.innerText = `${this.score} / ${this.questions.length} pts`;
  }
}
