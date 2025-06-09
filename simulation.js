/*
 * Simulador de Ecosistemas basado en el modelo presa-depredador de Lotka-Volterra.
 *
 * Ecuaciones de Lotka-Volterra:
 *   dx/dt = α·x - β·x·y      (tasa de crecimiento de presas menos depredación)
 *   dy/dt = δ·x·y - γ·y      (ganancia de depredadores por consumo menos muerte natural)
 *
 * Implementación:
 * - Simulación discreta basada en agentes (presas y depredadores móviles).
 * - Crecimiento de pasto regenerativo.
 * - Integración numérica (Euler explícito) para comparar con datos reales.
 */

let simulationRunning = false;
let simulationPaused  = false;
let simulationSpeed   = 1;  // Factor de aceleración de la simulación (1x, 2x, etc.)
let time              = 0;  // Contador de tiempo general (actualizaciones)
let extinctionTimer   = 0;  // Contador para detectar extinción prolongada
let extinctionMessage = ""; // Mensaje de extinción para la pantalla final

// Arrays de entidades del ecosistema
let grassArray    = [];  // Pasto (base alimenticia)
let preyArray     = [];  // Presas (consumen pasto)
let predatorArray = [];  // Depredadores (consumen presas)
let trees         = [];  // Elementos decorativos estáticos
let logs          = [];  // Elementos decorativos estáticos
let effects       = [];  // Efectos visuales temporales (nacimientos/muertes)

// Datos para gráficos comparativos
let populationData = []; // Datos REALES de población (presas/depredadores)
let lvData         = []; // Datos TEÓRICOS del modelo Lotka-Volterra

let animationFrameId;

let initialPrey     = 50;
let initialPredator = 20;

// Parámetros del modelo Lotka-Volterra (α, β, δ, γ)
let alpha = 0.1;  // Tasa de crecimiento presas
let beta  = 0.02;  // Tasa de depredación
let delta = 0.01;   // Tasa de conversión presa->depredador
let gamma = 0.1;    // Tasa de mortalidad depredadores

function addEffect(x, y, type) {
    effects.push({ x, y, type, age: 0, maxAge: 12 });
}

function drawEffects() {
    for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        const color = e.type === 'spawn' ? '#FAB14A' : '#E63946';
        const alphaVal = 1 - e.age / e.maxAge;
        const size = e.age < e.maxAge/2
            ? (e.age/(e.maxAge/2))*16
            : ((e.maxAge - e.age)/(e.maxAge/2))*16;
        ctx.save();
        ctx.globalAlpha = alphaVal;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(e.x - size/2, e.y - size/2, size, size);
        ctx.restore();
        e.age++;
        if (e.age >= e.maxAge) effects.splice(i, 1);
    }
}

class Grass {
    constructor(x, y) {
        // Configuración inicial del pasto
        this.x = x; this.y = y;
        this.width = 32; this.height = 32;
        this.energy = 10;     // Energía máxima
        this.growthRate = 0.03;    // Tasa de regeneración por frame
        this.currentEnergy = this.energy;     // Energía actual
        this.state = 2;      // 0=agotado, 1=recuperándose, 2=completo
    }
    update() {
        // Regenera energía si no está al máximo
        if (this.currentEnergy < this.energy) {
            this.currentEnergy += this.growthRate;

             // Actualiza estado visual según nivel de energía
            if (this.currentEnergy > this.energy*0.6)       this.state = 2;
            else if (this.currentEnergy > this.energy*0.3)  this.state = 1;
            else                                            this.state = 0;
        }
    }
    eat(amount) {
        // Reduce energía al ser consumido
        this.currentEnergy = Math.max(0, this.currentEnergy - amount);
        if (this.currentEnergy <= 0) this.state = 0;
    }
    draw() {
        // Selecciona sprite según estado energético
        const img = this.state === 2
            ? images.lightGrass
            : this.state === 1
                ? images.darkGrass
                : images.land;
        ctx.drawImage(img, this.x, this.y, this.width, this.height);
    }
}

class Prey {
    constructor(x, y) {
        // Configuración inicial de presa
        this.x = x; this.y = y;
        this.width = 32; this.height = 32;
        this.energy = 100;     // Energía inicial
        this.speed  = 2;       // Velocidad de movimiento
        this.reproductionRate = 0.005;     // Probabilidad de reproducción por frame
        this.direction = Math.random()*Math.PI*2;     // Ángulo de movimiento (radianes)
        this.moveCounter = 0;    // Contador para cambios de dirección
    }
    update() {
        // Movimiento basado en dirección actual
        this.x += Math.cos(this.direction)*this.speed;   // Componente X
        this.y += Math.sin(this.direction)*this.speed;   // Componente Y
        this.moveCounter++;

        // Cambio aleatorio de dirección periódico
        if (this.moveCounter > 100) {
            this.direction = Math.random()*Math.PI*2;
            this.moveCounter = 0;
        }

        // Confina al área de simulación
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
        
        // Detección de colisión con pasto (alimentación)
        let ate = false;
        for (let grass of grassArray) {
            if (grass.currentEnergy>0 &&
                this.x < grass.x+grass.width && this.x+this.width>grass.x &&
                this.y < grass.y+grass.height && this.y+this.height>grass.y) {
                grass.eat(5);   // Consume 5 unidades de energía del pasto
                this.energy += 20;   // Gana energía por alimentación
                ate = true;
                break;
            }
        }

        // Pérdida de energía si no comió
        if (!ate) this.energy -= 0.5;

        // Reproducción con probabilidad y costo energético
        if (this.energy > 150 && Math.random() < this.reproductionRate) {
            const nx = this.x + Math.random()*20 - 10; // Posición cercana aleatoria
            const ny = this.y + Math.random()*20 - 10;
            preyArray.push(new Prey(nx, ny));  // Crea nueva presa
            addEffect(nx+16, ny+16, 'spawn'); 
            this.energy -= 50;  // Costo energético por reproducción
        }

        // Muerte por energía agotada
        if (this.energy <= 0) {
            addEffect(this.x+16, this.y+16, 'death');
            return false;  // Indica que debe ser eliminado
        }
        return true;
    }
    draw() {
        ctx.drawImage(images.prey, this.x, this.y, this.width, this.height);
    }
}

class Predator {
    constructor(x, y) {

        // Configuración similar a presa con ajustes para depredador
        this.x = x; this.y = y;
        this.width = 32; this.height = 32;
        this.energy = 100;
        this.speed  = 2.5;  // Más rápido que presas
        this.reproductionRate = 0.003; // Menor tasa de reproducción
        this.direction = Math.random()*Math.PI*2;
        this.moveCounter = 0;
    }
    update() {
        // Mecánica de movimiento idéntica a presas
        this.x += Math.cos(this.direction)*this.speed;
        this.y += Math.sin(this.direction)*this.speed;
        this.moveCounter++;
        if (this.moveCounter > 100) {
            this.direction = Math.random()*Math.PI*2;
            this.moveCounter = 0;
        }
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
        
        // Detección de colisión con presas (caza)
        let ate = false;
        for (let i = preyArray.length - 1; i >= 0; i--) {
            const prey = preyArray[i];
            if (this.x < prey.x+prey.width && this.x+this.width>prey.x &&
                this.y < prey.y+prey.height && this.y+this.height>prey.y) {
                addEffect(prey.x+16, prey.y+16, 'death');
                preyArray.splice(i, 1);  // Elimina presa cazada
                this.energy += 40;  // Gana energía por caza	
                ate = true;
                break;
            }
        }

        // Mayor gasto energético si no caza
        if (!ate) this.energy -= 0.8;
        
        // Reproducción con mayor costo energético
        if (this.energy > 150 && Math.random() < this.reproductionRate) {
            const nx = this.x + Math.random()*20 - 10;
            const ny = this.y + Math.random()*20 - 10;
            predatorArray.push(new Predator(nx, ny));
            addEffect(nx+16, ny+16, 'spawn');
            this.energy -= 60;
        }

        // Muerte por energía agotada
        if (this.energy <= 0) {
            addEffect(this.x+16, this.y+16, 'death');
            return false;
        }
        return true;
    }
    draw() {
        ctx.drawImage(images.predator, this.x, this.y, this.width, this.height);
    }
}

function initSimulation() {

    // Reinicia todos los estados y poblaciones
    grassArray = [];
    preyArray = [];
    predatorArray = [];
    trees = [];
    logs = [];
    populationData = [];
    lvData = [];
    effects = [];
    for (let y=0; y<canvas.height; y+=32) {
        for (let x=0; x<canvas.width; x+=32) {
            grassArray.push(new Grass(x, y));
        }
    }

    // Crea cuadrícula de pasto
    placeRandomDecorations();

    // Población inicial de presas
    for (let i=0; i<initialPrey; i++) {
        preyArray.push(new Prey(
            Math.random()*(canvas.width-32),
            Math.random()*(canvas.height-32)
        ));
    }

    // Población inicial de depredadores
    for (let i=0; i<initialPredator; i++) {
        predatorArray.push(new Predator(
            Math.random()*(canvas.width-32),
            Math.random()*(canvas.height-32)
        ));
    }
}

function placeRandomDecorations() {
    // Añade árboles y troncos decorativos aleatorios
    const treeImages = [images.tree, images.alternateTree, images.smallTree, images.threeTrees];
    for (let i=0; i<30; i++) {
        const img = treeImages[Math.floor(Math.random()*treeImages.length)];
        trees.push({ x: Math.random()*(canvas.width-img.naturalWidth),
                     y: Math.random()*(canvas.height-img.naturalHeight),
                     img, w: img.naturalWidth, h: img.naturalHeight });
    }
    for (let i=0; i<15; i++) {
        const img = images.fallenLog;
        logs.push({ x: Math.random()*(canvas.width-img.naturalWidth),
                    y: Math.random()*(canvas.height-img.naturalHeight),
                    img, w: img.naturalWidth, h: img.naturalHeight });
    }
}

function integrateLotkaVolterra(dt) {
    /* 
     * Resuelve numéricamente las ecuaciones de Lotka-Volterra usando método de Euler.
     * dt: Paso de tiempo (delta time)
     * 
     * Ecuaciones:
     *   dx/dt = α·x - β·x·y
     *   dy/dt = δ·x·y - γ·y
     * 
     * Aproximación de Euler:
     *   x_{n+1} = x_n + (α·x_n - β·x_n·y_n) * dt
     *   y_{n+1} = y_n + (δ·x_n·y_n - γ·y_n) * dt
     */
    const last = populationData[populationData.length - 1];
    if (!last) return;

    // Cálculo de derivadas
    const dx = alpha*last.prey - beta*last.prey*last.predator;
    const dy = delta*last.prey*last.predator - gamma*last.predator;

    // Aplicación de Euler
    const newPrey     = Math.max(0, last.prey + dx*dt);
    const newPredator = Math.max(0, last.predator + dy*dt);

    // Añade nuevos valores al array de datos (punto teoricos)
    lvData.push({ time: last.time+dt, prey: newPrey, predator: newPredator });
}

function updatePopulationChart() {
    /* Actualiza gráfico en tiempo real comparando simulación vs modelo teórico */
    const c = document.getElementById('population-chart');
    const cx = c.getContext('2d');
    cx.clearRect(0, 0, c.width, c.height);
    if (populationData.length < 2) return;
    const maxPrey     = Math.max(...populationData.map(d => d.prey));
    const maxPredator = Math.max(...populationData.map(d => d.predator));
    const maxY        = Math.max(maxPrey, maxPredator, 50);

    // Ejes de fondo
    cx.fillStyle = 'rgba(0, 0, 0, 0.5)'; cx.fillRect(0,0,c.width,c.height);
    cx.strokeStyle = 'rgba(255,255,255,0.15)'; cx.beginPath();
    for (let i=0; i<=5; i++) {
        const y = (c.height-20) - i*((c.height-20)/5);
        cx.moveTo(10,y); cx.lineTo(c.width-10,y);
    }
    cx.stroke();

    // Presa real
    cx.strokeStyle = '#F48023'; cx.lineWidth=2; cx.beginPath();
    populationData.forEach((d,i)=>{
        const x = 10 + (i/(populationData.length-1))*(c.width-20);
        const y = (c.height-10) - (d.prey/maxY)*(c.height-20);
        i===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }); cx.stroke();

    // Depredador real
    cx.strokeStyle = '#E63946'; cx.beginPath();
    populationData.forEach((d,i)=>{
        const x = 10 + (i/(populationData.length-1))*(c.width-20);
        const y = (c.height-10) - (d.predator/maxY)*(c.height-20);
        i===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }); cx.stroke();

    // Presa LV (punteada)
    cx.setLineDash([5,5]); cx.strokeStyle = '#CCCCCC'; cx.beginPath();
    lvData.forEach((d,i)=>{
        const x = 10 + (i/(lvData.length-1))*(c.width-20);
        const y = (c.height-10) - (d.prey/maxY)*(c.height-20);
        i===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }); cx.stroke();

    // Depredador LV
    cx.setLineDash([]); cx.strokeStyle = '#77CC77'; cx.beginPath();
    lvData.forEach((d,i)=>{
        const x = 10 + (i/(lvData.length-1))*(c.width-20);
        const y = (c.height-10) - (d.predator/maxY)*(c.height-20);
        i===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }); cx.stroke();
}

function update() {
    time += 1;
    if (preyArray.length===0 || predatorArray.length===0) {
        extinctionTimer++;
        if (extinctionTimer>500) { endSimulation(); return; }
    } else extinctionTimer=0;

    grassArray.forEach(g=>g.update());
    for (let i=preyArray.length-1;i>=0;i--) if (!preyArray[i].update()) preyArray.splice(i,1);
    for (let i=predatorArray.length-1;i>=0;i--) if (!predatorArray[i].update()) predatorArray.splice(i,1);

    document.getElementById('time').textContent = Math.floor(time/10);
    document.getElementById('prey-count').textContent = preyArray.length;
    document.getElementById('predator-count').textContent = predatorArray.length;
    const aliveGrass = grassArray.filter(g=>g.state>0).length;
    document.getElementById('grass-count').textContent = Math.round(aliveGrass/grassArray.length*100);
    document.getElementById('speed-indicator').textContent = simulationSpeed;

    if (time%10===0) {
        populationData.push({ time: time/10, prey: preyArray.length, predator: predatorArray.length });
        integrateLotkaVolterra(0.5);
        updatePopulationChart();
    }
}

function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    grassArray.forEach(g=>g.draw());
    logs.forEach(l=>ctx.drawImage(l.img,l.x,l.y,l.w,l.h));
    trees.forEach(t=>ctx.drawImage(t.img,t.x,t.y,t.w,t.h));
    preyArray.forEach(p=>p.draw());
    predatorArray.forEach(p=>p.draw());
    drawEffects();

    if (extinctionTimer>0) {
        ctx.fillStyle = 'rgba(230,57,70,0.7)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#FFFFFF'; ctx.font='24px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('¡ECOSISTEMA EN PELIGRO!', canvas.width/2, canvas.height/2-20);
        const msg = preyArray.length===0
            ? 'PRESAS EXTINGUIDAS' : 'DEPREDADORES EXTINGUIDOS';
        ctx.fillText(msg, canvas.width/2, canvas.height/2+20);
    }
}

function loop() {
    if (!simulationRunning || simulationPaused) return;
    for (let i=0;i<simulationSpeed;i++) update();
    draw();
    animationFrameId = requestAnimationFrame(loop);
}

function endSimulation() {
    simulationRunning=false; simulationPaused=true;
    cancelAnimationFrame(animationFrameId);
    if (preyArray.length===0 && predatorArray.length===0) extinctionMessage="¡Ambas especies se extinguieron!";
    else if (preyArray.length===0) extinctionMessage="¡Las presas se extinguieron!";
    else extinctionMessage="¡Los depredadores se extinguieron!";
    document.getElementById('extinction-message').textContent = extinctionMessage;
    document.getElementById('total-time').textContent = Math.floor(time/10);
    showScreen(summaryScreen);
    drawTemporalChart();
    drawPhaseChart();
}

function drawTemporalChart() {
    const c = document.getElementById('temporal-chart');
    const cx = c.getContext('2d');
    cx.clearRect(0,0,c.width,c.height);
    if (populationData.length<2) return;
    const maxTime     = Math.max(...populationData.map(d=>d.time));
    const maxPrey     = Math.max(...populationData.map(d=>d.prey));
    const maxPredator = Math.max(...populationData.map(d=>d.predator));
    const maxY        = Math.max(maxPrey, maxPredator, 50);

    cx.fillStyle = '#2D1A4C'; cx.fillRect(0,0,c.width,c.height);
    cx.strokeStyle = '#F48023'; cx.lineWidth=2; cx.beginPath();
    populationData.forEach((d,i)=>{
        const x = 10 + (d.time/maxTime)*(c.width-20);
        const y = (c.height-10) - (d.prey/maxY)*(c.height-20);
        i===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }); cx.stroke();

    cx.strokeStyle = '#E63946'; cx.beginPath();
    populationData.forEach((d,i)=>{
        const x = 10 + (d.time/maxTime)*(c.width-20);
        const y = (c.height-10) - (d.predator/maxY)*(c.height-20);
        i===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }); cx.stroke();

    cx.strokeStyle = 'rgba(255,255,255,0.4)'; cx.beginPath();
    cx.moveTo(10,10); cx.lineTo(10,c.height-10); cx.lineTo(c.width-10,c.height-10); cx.stroke();

    cx.font='8px "Press Start 2P"'; cx.fillStyle='#F48023'; cx.fillText('Presas',14,18);
    cx.fillStyle='#E63946'; cx.fillText('Depredadores',14,30);
}

function drawPhaseChart() {
    const c = document.getElementById('phase-chart');
    const cx = c.getContext('2d');
    cx.clearRect(0,0,c.width,c.height);
    if (populationData.length<2) return;
    const maxPrey     = Math.max(...populationData.map(d=>d.prey));
    const maxPredator = Math.max(...populationData.map(d=>d.predator));

    cx.fillStyle='#2D1A4C'; cx.fillRect(0,0,c.width,c.height);
    cx.strokeStyle='#7BB662'; cx.lineWidth=1.5; cx.beginPath();
    for (let i=0; i<populationData.length-1; i++) {
        const a = populationData[i]; const b = populationData[i+1];
        const x1 = 10 + (a.prey/maxPrey)*(c.width-20);
        const y1 = (c.height-10) - (a.predator/maxPredator)*(c.height-20);
        const x2 = 10 + (b.prey/maxPrey)*(c.width-20);
        const y2 = (c.height-10) - (b.predator/maxPredator)*(c.height-20);
        cx.moveTo(x1,y1); cx.lineTo(x2,y2);
    }
    cx.stroke();

    cx.strokeStyle='rgba(255,255,255,0.4)'; cx.beginPath();
    cx.moveTo(10,10); cx.lineTo(10,c.height-10); cx.lineTo(c.width-10,c.height-10); cx.stroke();

    cx.font='8px "Press Start 2P"'; cx.fillStyle='#E0E0E0'; cx.fillText('Presas',c.width/2-20,c.height-2);
    cx.save(); cx.rotate(-Math.PI/2);
    cx.fillText('Depredadores',-c.height+20,12);
    cx.restore();
}
