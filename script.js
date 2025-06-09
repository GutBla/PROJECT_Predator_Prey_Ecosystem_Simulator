const startScreen    = document.getElementById('start-screen');
const settingsScreen = document.getElementById('settings-screen');
const tutorialScreen = document.getElementById('tutorial-screen');
const graphContainer = document.getElementById('graph-container');
const pauseScreen    = document.getElementById('pause-screen');
const summaryScreen  = document.getElementById('summary-screen');

const startBtn         = document.getElementById('start-btn');
const settingsBtn      = document.getElementById('settings-btn');
const tutorialBtn      = document.getElementById('tutorial-btn');
const applySettingsBtn = document.getElementById('apply-settings');
const settingsBackBtn  = document.getElementById('settings-back');
const tutorialBackBtn  = document.getElementById('tutorial-back');
const resumeBtn        = document.getElementById('resume-btn');
const restartBtn       = document.getElementById('restart-btn');
const mainMenuBtn      = document.getElementById('main-menu-btn');
const summaryRestart   = document.getElementById('summary-restart');
const summaryMenu      = document.getElementById('summary-menu');

const preySlider       = document.getElementById('prey-slider');
const predatorSlider   = document.getElementById('predator-slider');
const speedSlider      = document.getElementById('speed-slider');
const alphaSlider      = document.getElementById('alpha-slider');
const betaSlider       = document.getElementById('beta-slider');
const deltaSlider      = document.getElementById('delta-slider');
const gammaSlider      = document.getElementById('gamma-slider');

const preyValue        = document.getElementById('prey-value');
const predatorValue    = document.getElementById('predator-value');
const speedValue       = document.getElementById('speed-value');
const alphaValue       = document.getElementById('alpha-value');
const betaValue        = document.getElementById('beta-value');
const deltaValue       = document.getElementById('delta-value');
const gammaValue       = document.getElementById('gamma-value');

const canvas = document.getElementById('simulation-canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 1280;
canvas.height = 800;

const images = {
    lightGrass:    new Image(),
    darkGrass:     new Image(),
    land:          new Image(),
    tree:          new Image(),
    alternateTree: new Image(),
    smallTree:     new Image(),
    threeTrees:    new Image(),
    fallenLog:     new Image(),
    prey:          new Image(),
    predator:      new Image(),
    miniPrey:      new Image(),
    miniPredator:  new Image(),
    title:         new Image()
};

function loadImage(img, src) {
    return new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(`No se pudo cargar: ${src}`);
        img.src = src;
    });
}

Promise.all([
    loadImage(images.lightGrass,    'Images/light_grass.png'),
    loadImage(images.darkGrass,     'Images/dark_grass.png'),
    loadImage(images.land,          'Images/land.png'),
    loadImage(images.tree,          'Images/tree.png'),
    loadImage(images.alternateTree, 'Images/alternate_tree.png'),
    loadImage(images.smallTree,     'Images/small_tree.png'),
    loadImage(images.threeTrees,    'Images/three_trees_group.png'),
    loadImage(images.fallenLog,     'Images/fallen_log.png'),
    loadImage(images.prey,          'Images/MiniBunny.gif'),
    loadImage(images.predator,      'Images/MiniLynx.gif'),
    loadImage(images.miniPrey,      'Images/MiniBunny.png'),
    loadImage(images.miniPredator,  'Images/MiniLynx.png'),
    loadImage(images.title,         'Images/Title.png')
]).then(() => {
    initUI();
    showScreen(startScreen);
}).catch(err => {
    alert("Error al cargar imágenes. Revisa que existan en /Images.");
    console.error(err);
});

function showScreen(screen) {
    [startScreen, settingsScreen, tutorialScreen, pauseScreen, summaryScreen]
        .forEach(s => s.classList.add('hidden'));
    if (screen) screen.classList.remove('hidden');
}

function initUI() {
    preyValue.textContent      = preySlider.value;
    predatorValue.textContent  = predatorSlider.value;
    speedValue.textContent     = speedSlider.value;
    alphaValue.textContent     = parseFloat(alphaSlider.value).toFixed(2);
    betaValue.textContent      = parseFloat(betaSlider.value).toFixed(3);
    deltaValue.textContent     = parseFloat(deltaSlider.value).toFixed(3);
    gammaValue.textContent     = parseFloat(gammaSlider.value).toFixed(3);

    startBtn.addEventListener('click', startSimulation);
    settingsBtn.addEventListener('click', () => showScreen(settingsScreen));
    tutorialBtn.addEventListener('click', () => showScreen(tutorialScreen));
    applySettingsBtn.addEventListener('click', applySettings);
    settingsBackBtn.addEventListener('click', () => showScreen(startScreen));
    tutorialBackBtn.addEventListener('click', () => showScreen(startScreen));
    resumeBtn.addEventListener('click', resumeSimulation);
    restartBtn.addEventListener('click', restartSimulation);
    mainMenuBtn.addEventListener('click', returnToMainMenu);
    summaryRestart.addEventListener('click', restartSimulation);
    summaryMenu.addEventListener('click', returnToMainMenu);

    preySlider.addEventListener('input',      () => preyValue.textContent     = preySlider.value);
    predatorSlider.addEventListener('input',  () => predatorValue.textContent = predatorSlider.value);
    speedSlider.addEventListener('input',     () => speedValue.textContent    = speedSlider.value);
    alphaSlider.addEventListener('input',     () => alphaValue.textContent    = parseFloat(alphaSlider.value).toFixed(2));
    betaSlider.addEventListener('input',      () => betaValue.textContent     = parseFloat(betaSlider.value).toFixed(3));
    deltaSlider.addEventListener('input',     () => deltaValue.textContent    = parseFloat(deltaSlider.value).toFixed(3));
    gammaSlider.addEventListener('input',     () => gammaValue.textContent    = parseFloat(gammaSlider.value).toFixed(3));

    window.addEventListener('keydown', e => {
        if (!simulationRunning) return;
        if (e.key === 'p' || e.key === 'P' || e.code === 'Space') {
            simulationPaused = !simulationPaused;
            if (simulationPaused) {
                pauseScreen.classList.remove('hidden');
                cancelAnimationFrame(animationFrameId);
            } else {
                pauseScreen.classList.add('hidden');
                loop();
            }
        }
        else if (e.key === '+') {
            changeSpeed(1);
        }
        else if (e.key === '-') {
            changeSpeed(-1);
        }
        else if (e.key === 'r' || e.key === 'R') {
            restartSimulation();
        }
        else if (e.key === 'g' || e.key === 'G') {
            toggleGraphs();
        }
    });

    canvas.addEventListener('mousedown', e => {
        if (!simulationRunning || simulationPaused) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (e.button === 0) {
            predatorArray.push(new Predator(x - 16, y - 16));
            addEffect(x, y, 'spawn');
        }
        else if (e.button === 2) {
            preyArray.push(new Prey(x - 16, y - 16));
            addEffect(x, y, 'spawn');
        }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function changeSpeed(delta) {
    simulationSpeed = Math.min(10, Math.max(1, simulationSpeed + delta));
    speedSlider.value = simulationSpeed;
    speedValue.textContent = simulationSpeed;
}

function toggleGraphs() {
    const isGraphHidden = graphContainer.classList.contains('hidden');
    if (isGraphHidden) {
        graphContainer.classList.remove('hidden');
    } else {
        graphContainer.classList.add('hidden');
    }
    if (!summaryScreen.classList.contains('hidden')) {
        summaryScreen.classList.add('hidden');
    }
}

function startSimulation() {
    showScreen(null);
    simulationRunning = true;
    simulationPaused = false;
    extinctionTimer = 0;
    time = 0;
    populationData.length = 0;
    lvData.length = 0;
    document.getElementById('info-box').classList.remove('hidden');
    graphContainer.classList.remove('hidden');
    initSimulation();
    loop();
}

function applySettings() {
    initialPrey     = parseInt(preySlider.value);
    initialPredator = parseInt(predatorSlider.value);
    simulationSpeed = parseInt(speedSlider.value);
    alpha = parseFloat(alphaSlider.value);
    beta  = parseFloat(betaSlider.value);
    delta = parseFloat(deltaSlider.value);
    gamma = parseFloat(gammaSlider.value);
    showScreen(startScreen);
}

function resumeSimulation() {
    simulationPaused = false;
    pauseScreen.classList.add('hidden');
    loop();
}

function restartSimulation() {
    cancelAnimationFrame(animationFrameId);
    startSimulation();
}

function returnToMainMenu() {
    cancelAnimationFrame(animationFrameId);
    simulationRunning = false;
    simulationPaused = false;
    showScreen(startScreen);
}
