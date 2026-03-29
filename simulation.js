const CONFIG = {
  ENTITY_SIZE: 32,
  GRASS_ENERGY: 10,
  GRASS_GROWTH_RATE: 0.03,
  GRASS_EAT_AMOUNT: 5,
  PREY_SPEED: 2,
  PREY_ENERGY_INITIAL: 100,
  PREY_ENERGY_GAIN: 20,
  PREY_ENERGY_LOSS: 0.5,
  PREY_REPRODUCE_THRESHOLD: 150,
  PREY_REPRODUCE_COST: 50,
  PREY_REPRODUCE_RATE: 0.005,
  PREY_DIRECTION_CHANGE: 100,
  PREDATOR_SPEED: 2.5,
  PREDATOR_ENERGY_INITIAL: 100,
  PREDATOR_ENERGY_GAIN: 40,
  PREDATOR_ENERGY_LOSS: 0.8,
  PREDATOR_REPRODUCE_THRESHOLD: 150,
  PREDATOR_REPRODUCE_COST: 60,
  PREDATOR_REPRODUCE_RATE: 0.003,
  PREDATOR_DIRECTION_CHANGE: 100,
  SPAWN_OFFSET: 16,
  LV_DT: 0.5,
  DATA_SAMPLE_INTERVAL: 10,
  EXTINCTION_DELAY: 500,
  TREE_COUNT: 30,
  LOG_COUNT: 15,
  EFFECT_MAX_AGE: 12,
  SPAWN_COLOR: "#FAB14A",
  DEATH_COLOR: "#E63946",
};

const sim = {
  running: false,
  paused: false,
  speed: 1,
  time: 0,
  extinctionTimer: 0,
  extinctionMessage: "",
  grassArray: [],
  preyArray: [],
  predatorArray: [],
  trees: [],
  logs: [],
  effects: [],
  populationData: [],
  lvData: [],
  animationFrameId: null,
  initialPrey: 50,
  initialPredator: 20,
  alpha: 0.1,
  beta: 0.02,
  delta: 0.01,
  gamma: 0.1,
};

const domRefs = {};

function initDomRefs() {
  domRefs.time = document.getElementById("time");
  domRefs.preyCount = document.getElementById("prey-count");
  domRefs.predatorCount = document.getElementById("predator-count");
  domRefs.grassCount = document.getElementById("grass-count");
  domRefs.speedIndicator = document.getElementById("speed-indicator");
  domRefs.populationChart = document.getElementById("population-chart");
  domRefs.temporalChart = document.getElementById("temporal-chart");
  domRefs.phaseChart = document.getElementById("phase-chart");
  domRefs.extinctionMsg = document.getElementById("extinction-message");
  domRefs.totalTime = document.getElementById("total-time");
}

function addEffect(x, y, type) {
  sim.effects.push({ x, y, type, age: 0, maxAge: CONFIG.EFFECT_MAX_AGE });
}

function drawEffects() {
  for (let i = sim.effects.length - 1; i >= 0; i--) {
    const e = sim.effects[i];
    const color = e.type === "spawn" ? CONFIG.SPAWN_COLOR : CONFIG.DEATH_COLOR;
    const alphaVal = 1 - e.age / e.maxAge;
    const half = e.maxAge / 2;
    const size =
      e.age < half ? (e.age / half) * 16 : ((e.maxAge - e.age) / half) * 16;

    ctx.save();
    ctx.globalAlpha = alphaVal;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x - size / 2, e.y - size / 2, size, size);
    ctx.restore();

    e.age++;
    if (e.age >= e.maxAge) sim.effects.splice(i, 1);
  }
}

class Grass {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = CONFIG.ENTITY_SIZE;
    this.height = CONFIG.ENTITY_SIZE;
    this.energy = CONFIG.GRASS_ENERGY;
    this.growthRate = CONFIG.GRASS_GROWTH_RATE;
    this.currentEnergy = this.energy;
    this.state = 2;
  }

  update() {
    if (this.currentEnergy < this.energy) {
      this.currentEnergy += this.growthRate;
      if (this.currentEnergy > this.energy * 0.6) this.state = 2;
      else if (this.currentEnergy > this.energy * 0.3) this.state = 1;
      else this.state = 0;
    }
  }

  eat(amount) {
    this.currentEnergy = Math.max(0, this.currentEnergy - amount);
    if (this.currentEnergy <= 0) this.state = 0;
  }

  draw() {
    const img =
      this.state === 2
        ? images.lightGrass
        : this.state === 1
          ? images.darkGrass
          : images.land;
    ctx.drawImage(img, this.x, this.y, this.width, this.height);
  }
}

class Prey {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = CONFIG.ENTITY_SIZE;
    this.height = CONFIG.ENTITY_SIZE;
    this.energy = CONFIG.PREY_ENERGY_INITIAL;
    this.speed = CONFIG.PREY_SPEED;
    this.reproductionRate = CONFIG.PREY_REPRODUCE_RATE;
    this.direction = Math.random() * Math.PI * 2;
    this.moveCounter = 0;
  }

  update() {
    this.x += Math.cos(this.direction) * this.speed;
    this.y += Math.sin(this.direction) * this.speed;
    this.moveCounter++;
    if (this.moveCounter > CONFIG.PREY_DIRECTION_CHANGE) {
      this.direction = Math.random() * Math.PI * 2;
      this.moveCounter = 0;
    }
    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
    this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

    let ate = false;
    for (const grass of sim.grassArray) {
      if (
        grass.currentEnergy > 0 &&
        this.x < grass.x + grass.width &&
        this.x + this.width > grass.x &&
        this.y < grass.y + grass.height &&
        this.y + this.height > grass.y
      ) {
        grass.eat(CONFIG.GRASS_EAT_AMOUNT);
        this.energy += CONFIG.PREY_ENERGY_GAIN;
        ate = true;
        break;
      }
    }
    if (!ate) this.energy -= CONFIG.PREY_ENERGY_LOSS;

    if (
      this.energy > CONFIG.PREY_REPRODUCE_THRESHOLD &&
      Math.random() < this.reproductionRate
    ) {
      const nx = this.x + Math.random() * 20 - 10;
      const ny = this.y + Math.random() * 20 - 10;
      sim.preyArray.push(new Prey(nx, ny));
      addEffect(nx + CONFIG.SPAWN_OFFSET, ny + CONFIG.SPAWN_OFFSET, "spawn");
      this.energy -= CONFIG.PREY_REPRODUCE_COST;
    }

    if (this.energy <= 0) {
      addEffect(
        this.x + CONFIG.SPAWN_OFFSET,
        this.y + CONFIG.SPAWN_OFFSET,
        "death",
      );
      return false;
    }
    return true;
  }

  draw() {
    ctx.drawImage(images.prey, this.x, this.y, this.width, this.height);
  }
}

class Predator {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = CONFIG.ENTITY_SIZE;
    this.height = CONFIG.ENTITY_SIZE;
    this.energy = CONFIG.PREDATOR_ENERGY_INITIAL;
    this.speed = CONFIG.PREDATOR_SPEED;
    this.reproductionRate = CONFIG.PREDATOR_REPRODUCE_RATE;
    this.direction = Math.random() * Math.PI * 2;
    this.moveCounter = 0;
  }

  update() {
    this.x += Math.cos(this.direction) * this.speed;
    this.y += Math.sin(this.direction) * this.speed;
    this.moveCounter++;
    if (this.moveCounter > CONFIG.PREDATOR_DIRECTION_CHANGE) {
      this.direction = Math.random() * Math.PI * 2;
      this.moveCounter = 0;
    }
    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
    this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

    let ate = false;
    for (let i = sim.preyArray.length - 1; i >= 0; i--) {
      const prey = sim.preyArray[i];
      if (
        this.x < prey.x + prey.width &&
        this.x + this.width > prey.x &&
        this.y < prey.y + prey.height &&
        this.y + this.height > prey.y
      ) {
        addEffect(
          prey.x + CONFIG.SPAWN_OFFSET,
          prey.y + CONFIG.SPAWN_OFFSET,
          "death",
        );
        sim.preyArray.splice(i, 1);
        this.energy += CONFIG.PREDATOR_ENERGY_GAIN;
        ate = true;
        break;
      }
    }
    if (!ate) this.energy -= CONFIG.PREDATOR_ENERGY_LOSS;

    if (
      this.energy > CONFIG.PREDATOR_REPRODUCE_THRESHOLD &&
      Math.random() < this.reproductionRate
    ) {
      const nx = this.x + Math.random() * 20 - 10;
      const ny = this.y + Math.random() * 20 - 10;
      sim.predatorArray.push(new Predator(nx, ny));
      addEffect(nx + CONFIG.SPAWN_OFFSET, ny + CONFIG.SPAWN_OFFSET, "spawn");
      this.energy -= CONFIG.PREDATOR_REPRODUCE_COST;
    }

    if (this.energy <= 0) {
      addEffect(
        this.x + CONFIG.SPAWN_OFFSET,
        this.y + CONFIG.SPAWN_OFFSET,
        "death",
      );
      return false;
    }
    return true;
  }

  draw() {
    ctx.drawImage(images.predator, this.x, this.y, this.width, this.height);
  }
}

function initSimulation() {
  Object.assign(sim, {
    grassArray: [],
    preyArray: [],
    predatorArray: [],
    trees: [],
    logs: [],
    populationData: [],
    lvData: [],
    effects: [],
    time: 0,
    extinctionTimer: 0,
  });

  for (let y = 0; y < canvas.height; y += CONFIG.ENTITY_SIZE) {
    for (let x = 0; x < canvas.width; x += CONFIG.ENTITY_SIZE) {
      sim.grassArray.push(new Grass(x, y));
    }
  }

  placeRandomDecorations();

  for (let i = 0; i < sim.initialPrey; i++) {
    sim.preyArray.push(
      new Prey(
        Math.random() * (canvas.width - CONFIG.ENTITY_SIZE),
        Math.random() * (canvas.height - CONFIG.ENTITY_SIZE),
      ),
    );
  }
  for (let i = 0; i < sim.initialPredator; i++) {
    sim.predatorArray.push(
      new Predator(
        Math.random() * (canvas.width - CONFIG.ENTITY_SIZE),
        Math.random() * (canvas.height - CONFIG.ENTITY_SIZE),
      ),
    );
  }

  initDomRefs();
}

function placeRandomDecorations() {
  const treeImages = [
    images.tree,
    images.alternateTree,
    images.smallTree,
    images.threeTrees,
  ];
  for (let i = 0; i < CONFIG.TREE_COUNT; i++) {
    const img = treeImages[Math.floor(Math.random() * treeImages.length)];
    sim.trees.push({
      x: Math.random() * (canvas.width - img.naturalWidth),
      y: Math.random() * (canvas.height - img.naturalHeight),
      img,
      w: img.naturalWidth,
      h: img.naturalHeight,
    });
  }
  for (let i = 0; i < CONFIG.LOG_COUNT; i++) {
    const img = images.fallenLog;
    sim.logs.push({
      x: Math.random() * (canvas.width - img.naturalWidth),
      y: Math.random() * (canvas.height - img.naturalHeight),
      img,
      w: img.naturalWidth,
      h: img.naturalHeight,
    });
  }
}

function integrateLotkaVolterra() {
  const last = sim.populationData[sim.populationData.length - 1];
  if (!last || last.prey <= 0 || last.predator <= 0) return;

  const dx = sim.alpha * last.prey - sim.beta * last.prey * last.predator;
  const dy = sim.delta * last.prey * last.predator - sim.gamma * last.predator;

  sim.lvData.push({
    time: last.time + CONFIG.LV_DT,
    prey: Math.max(0, last.prey + dx * CONFIG.LV_DT),
    predator: Math.max(0, last.predator + dy * CONFIG.LV_DT),
  });
}

function updateEntities() {
  sim.grassArray.forEach((g) => g.update());
  for (let i = sim.preyArray.length - 1; i >= 0; i--) {
    if (!sim.preyArray[i].update()) sim.preyArray.splice(i, 1);
  }
  for (let i = sim.predatorArray.length - 1; i >= 0; i--) {
    if (!sim.predatorArray[i].update()) sim.predatorArray.splice(i, 1);
  }
}

function updateDOMCounters() {
  const aliveGrass = sim.grassArray.filter((g) => g.state > 0).length;
  domRefs.time.textContent = Math.floor(sim.time / CONFIG.DATA_SAMPLE_INTERVAL);
  domRefs.preyCount.textContent = sim.preyArray.length;
  domRefs.predatorCount.textContent = sim.predatorArray.length;
  domRefs.grassCount.textContent = Math.round(
    (aliveGrass / sim.grassArray.length) * 100,
  );
  domRefs.speedIndicator.textContent = sim.speed;
}

function checkExtinction() {
  if (sim.preyArray.length === 0 || sim.predatorArray.length === 0) {
    sim.extinctionTimer++;
    if (sim.extinctionTimer > CONFIG.EXTINCTION_DELAY) endSimulation();
  } else {
    sim.extinctionTimer = 0;
  }
}

function update() {
  sim.time++;
  checkExtinction();
  if (!sim.running) return;
  updateEntities();
  updateDOMCounters();

  if (sim.time % CONFIG.DATA_SAMPLE_INTERVAL === 0) {
    sim.populationData.push({
      time: sim.time / CONFIG.DATA_SAMPLE_INTERVAL,
      prey: sim.preyArray.length,
      predator: sim.predatorArray.length,
    });
    integrateLotkaVolterra();
    updatePopulationChart();
  }
}

function drawBackground() {
  sim.grassArray.forEach((g) => g.draw());
  sim.logs.forEach((l) => ctx.drawImage(l.img, l.x, l.y, l.w, l.h));
  sim.trees.forEach((t) => ctx.drawImage(t.img, t.x, t.y, t.w, t.h));
}

function drawEntities() {
  sim.preyArray.forEach((p) => p.draw());
  sim.predatorArray.forEach((p) => p.draw());
  drawEffects();
}

function drawExtinctionOverlay() {
  if (sim.extinctionTimer <= 0) return;
  ctx.fillStyle = "rgba(230,57,70,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '24px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.fillText(
    "¡ECOSISTEMA EN PELIGRO!",
    canvas.width / 2,
    canvas.height / 2 - 20,
  );
  const msg =
    sim.preyArray.length === 0
      ? "PRESAS EXTINGUIDAS"
      : "DEPREDADORES EXTINGUIDOS";
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2 + 20);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawEntities();
  drawExtinctionOverlay();
}

function updatePopulationChart() {
  const c = domRefs.populationChart;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, c.width, c.height);
  if (sim.populationData.length < 2) return;

  const maxPrey = Math.max(...sim.populationData.map((d) => d.prey));
  const maxPredator = Math.max(...sim.populationData.map((d) => d.predator));
  const maxY = Math.max(maxPrey, maxPredator, 50);
  const pLen = sim.populationData.length;
  const lLen = sim.lvData.length;

  cx.fillStyle = "rgba(0,0,0,0.5)";
  cx.fillRect(0, 0, c.width, c.height);

  cx.strokeStyle = "rgba(255,255,255,0.15)";
  cx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const gy = c.height - 20 - i * ((c.height - 20) / 5);
    cx.moveTo(10, gy);
    cx.lineTo(c.width - 10, gy);
  }
  cx.stroke();

  cx.strokeStyle = "#F48023";
  cx.lineWidth = 2;
  cx.setLineDash([]);
  cx.beginPath();
  sim.populationData.forEach((d, i) => {
    const x = 10 + (i / (pLen - 1)) * (c.width - 20);
    const y = c.height - 10 - (d.prey / maxY) * (c.height - 20);
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  });
  cx.stroke();

  cx.strokeStyle = "#E63946";
  cx.beginPath();
  sim.populationData.forEach((d, i) => {
    const x = 10 + (i / (pLen - 1)) * (c.width - 20);
    const y = c.height - 10 - (d.predator / maxY) * (c.height - 20);
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  });
  cx.stroke();

  if (lLen > 1) {
    cx.setLineDash([5, 5]);
    cx.strokeStyle = "#CCCCCC";
    cx.beginPath();
    sim.lvData.forEach((d, i) => {
      const x = 10 + (i / (lLen - 1)) * (c.width - 20);
      const y = c.height - 10 - (d.prey / maxY) * (c.height - 20);
      i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
    });
    cx.stroke();

    cx.strokeStyle = "#77CC77";
    cx.beginPath();
    sim.lvData.forEach((d, i) => {
      const x = 10 + (i / (lLen - 1)) * (c.width - 20);
      const y = c.height - 10 - (d.predator / maxY) * (c.height - 20);
      i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
    });
    cx.stroke();
    cx.setLineDash([]);
  }
}

function loop() {
  if (!sim.running || sim.paused) return;
  for (let i = 0; i < sim.speed; i++) update();
  draw();
  sim.animationFrameId = requestAnimationFrame(loop);
}

function endSimulation() {
  sim.running = false;
  sim.paused = true;
  cancelAnimationFrame(sim.animationFrameId);

  if (sim.preyArray.length === 0 && sim.predatorArray.length === 0) {
    sim.extinctionMessage = "¡Ambas especies se extinguieron!";
  } else if (sim.preyArray.length === 0) {
    sim.extinctionMessage = "¡Las presas se extinguieron!";
  } else {
    sim.extinctionMessage = "¡Los depredadores se extinguieron!";
  }

  domRefs.extinctionMsg.textContent = sim.extinctionMessage;
  domRefs.totalTime.textContent = Math.floor(
    sim.time / CONFIG.DATA_SAMPLE_INTERVAL,
  );

  showScreen(summaryScreen);
  drawTemporalChart();
  drawPhaseChart();
}

function drawTemporalChart() {
  const c = domRefs.temporalChart;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, c.width, c.height);
  if (sim.populationData.length < 2) return;

  const maxTime = Math.max(...sim.populationData.map((d) => d.time));
  const maxPrey = Math.max(...sim.populationData.map((d) => d.prey));
  const maxPredator = Math.max(...sim.populationData.map((d) => d.predator));
  const maxY = Math.max(maxPrey, maxPredator, 50);

  cx.fillStyle = "#2D1A4C";
  cx.fillRect(0, 0, c.width, c.height);

  cx.strokeStyle = "#F48023";
  cx.lineWidth = 2;
  cx.beginPath();
  sim.populationData.forEach((d, i) => {
    const x = 10 + (d.time / maxTime) * (c.width - 20);
    const y = c.height - 10 - (d.prey / maxY) * (c.height - 20);
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  });
  cx.stroke();

  cx.strokeStyle = "#E63946";
  cx.beginPath();
  sim.populationData.forEach((d, i) => {
    const x = 10 + (d.time / maxTime) * (c.width - 20);
    const y = c.height - 10 - (d.predator / maxY) * (c.height - 20);
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  });
  cx.stroke();

  cx.strokeStyle = "rgba(255,255,255,0.4)";
  cx.beginPath();
  cx.moveTo(10, 10);
  cx.lineTo(10, c.height - 10);
  cx.lineTo(c.width - 10, c.height - 10);
  cx.stroke();

  cx.font = '8px "Press Start 2P"';
  cx.fillStyle = "#F48023";
  cx.fillText("Presas", 14, 18);
  cx.fillStyle = "#E63946";
  cx.fillText("Depredadores", 14, 30);
}

function drawPhaseChart() {
  const c = domRefs.phaseChart;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, c.width, c.height);
  if (sim.populationData.length < 2) return;

  const maxPrey = Math.max(...sim.populationData.map((d) => d.prey));
  const maxPredator = Math.max(...sim.populationData.map((d) => d.predator));

  cx.fillStyle = "#2D1A4C";
  cx.fillRect(0, 0, c.width, c.height);

  cx.strokeStyle = "#7BB662";
  cx.lineWidth = 1.5;
  cx.beginPath();
  for (let i = 0; i < sim.populationData.length - 1; i++) {
    const a = sim.populationData[i];
    const b = sim.populationData[i + 1];
    const x1 = 10 + (a.prey / maxPrey) * (c.width - 20);
    const y1 = c.height - 10 - (a.predator / maxPredator) * (c.height - 20);
    const x2 = 10 + (b.prey / maxPrey) * (c.width - 20);
    const y2 = c.height - 10 - (b.predator / maxPredator) * (c.height - 20);
    cx.moveTo(x1, y1);
    cx.lineTo(x2, y2);
  }
  cx.stroke();

  cx.strokeStyle = "rgba(255,255,255,0.4)";
  cx.beginPath();
  cx.moveTo(10, 10);
  cx.lineTo(10, c.height - 10);
  cx.lineTo(c.width - 10, c.height - 10);
  cx.stroke();

  cx.font = '8px "Press Start 2P"';
  cx.fillStyle = "#E0E0E0";
  cx.fillText("Presas", c.width / 2 - 20, c.height - 2);
  cx.save();
  cx.rotate(-Math.PI / 2);
  cx.fillText("Depredadores", -c.height + 20, 12);
  cx.restore();
}
