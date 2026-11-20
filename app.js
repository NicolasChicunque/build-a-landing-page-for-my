/**
 * PlayForm 3D — Core Application Script
 * Live Form-to-3D Engine, Three.js WebGL Arena, and Interactive UI
 */

// Quiz Presets Database
const QUIZ_PRESETS = {
  science: {
    title: "Solar Science Odyssey",
    theme: "space",
    question: "Which planet is known as the 'Red Planet' due to iron oxide on its surface?",
    answers: ["Venus", "Mars", "Jupiter", "Mercury"],
    correctIndex: 1
  },
  math: {
    title: "Speed Math Galaxy",
    theme: "cyber",
    question: "Calculate the expression: (14 × 5) + 30 ÷ 3 = ?",
    answers: ["80", "75", "100", "70"],
    correctIndex: 0
  },
  history: {
    title: "World History Legends",
    theme: "island",
    question: "In which ancient civilization was the Great Pyramid of Giza constructed?",
    answers: ["Ancient Rome", "Mesopotamia", "Ancient Egypt", "Classical Greece"],
    correctIndex: 2
  },
  geography: {
    title: "Earth & Geography Quest",
    theme: "island",
    question: "What is the longest river system on planet Earth?",
    answers: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"],
    correctIndex: 1
  }
};

// Global App State
const state = {
  activePreset: "science",
  activeTheme: "space",
  question: QUIZ_PRESETS.science.question,
  answers: [...QUIZ_PRESETS.science.answers],
  correctIndex: QUIZ_PRESETS.science.correctIndex,
  score: 0,
  soundEnabled: true,
  billingCycle: "annual"
};

// Web Audio API Synthesizer (No external sound files required)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, type, duration, delay = 0, gainLevel = 0.15) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gain.gain.setValueAtTime(gainLevel, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch (e) {
    // Audio context may require user gesture on some browsers
  }
}

function playSuccessSound() {
  // Joyful ascending arpeggio (C5, E5, G5, C6)
  playTone(523.25, "sine", 0.15, 0, 0.15);
  playTone(659.25, "sine", 0.15, 0.08, 0.15);
  playTone(783.99, "sine", 0.2, 0.16, 0.15);
  playTone(1046.50, "triangle", 0.45, 0.24, 0.2);
}

function playWrongSound() {
  // Gentle low boop
  playTone(220, "sawtooth", 0.25, 0, 0.1);
  playTone(180, "sawtooth", 0.35, 0.12, 0.08);
}

function playClickSound() {
  playTone(600, "sine", 0.04, 0, 0.05);
}

function toggleAudio() {
  state.soundEnabled = !state.soundEnabled;
  const icon = document.getElementById("sound-icon");
  if (icon) {
    icon.setAttribute("data-lucide", state.soundEnabled ? "volume-2" : "volume-x");
    lucide.createIcons();
  }
  if (state.soundEnabled) {
    playClickSound();
  }
}

// -------------------------------------------------------------
// THREE.JS 3D ARENA ENGINE
// -------------------------------------------------------------
let scene, camera, renderer, animationFrameId;
let crystals = [];
let crystalSprites = [];
let starParticles, centralShip, groundMesh;
let raycaster, mouse;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotationY = 0;
let currentRotationY = 0;

function initThreeJS() {
  const container = document.getElementById("threejs-canvas-container");
  if (!container) return;

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 450;

  // Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050816);
  scene.fog = new THREE.FogExp2(0x050816, 0.025);

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 5, 12);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainLight.position.set(5, 12, 7);
  mainLight.castShadow = true;
  scene.add(mainLight);

  const pointLight = new THREE.PointLight(0x38bdf8, 2.5, 30);
  pointLight.position.set(0, 3, 0);
  scene.add(pointLight);

  // Raycasting for interactive clicks
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Build World Elements
  buildEnvironment();
  buildCrystals();

  // Mouse & Touch Orbit Listeners
  setupCanvasControls(container);

  // Resize Handler
  window.addEventListener("resize", onWindowResize);

  // Start Animation Loop
  animateThreeJS();
}

function buildEnvironment() {
  // Clean up existing environment meshes
  if (starParticles) scene.remove(starParticles);
  if (centralShip) scene.remove(centralShip);
  if (groundMesh) scene.remove(groundMesh);

  const theme = state.activeTheme;

  if (theme === "space") {
    scene.background = new THREE.Color(0x050714);
    scene.fog.color = new THREE.Color(0x050714);

    // Starfield
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 60;
      positions[i + 1] = (Math.random() - 0.5) * 40;
      positions[i + 2] = (Math.random() - 0.5) * 60;
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.15, transparent: true, opacity: 0.8 });
    starParticles = new THREE.Points(starsGeo, starMat);
    scene.add(starParticles);

    // Floating Space Platform Grid
    const platformGeo = new THREE.CylinderGeometry(5.5, 5.5, 0.5, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8
    });
    groundMesh = new THREE.Mesh(platformGeo, platformMat);
    groundMesh.position.y = -1.2;
    scene.add(groundMesh);

    // Glowing Neon Ring around platform
    const ringGeo = new THREE.TorusGeometry(5.6, 0.08, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -1.0;
    scene.add(ringMesh);

    // Central Futuristic Spaceship Model
    buildCentralSpaceship();

  } else if (theme === "island") {
    scene.background = new THREE.Color(0x061e24);
    scene.fog.color = new THREE.Color(0x061e24);

    // Floating Green Island Hexagon
    const islandGeo = new THREE.CylinderGeometry(6, 4.5, 2, 6);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x065f46,
      roughness: 0.6
    });
    groundMesh = new THREE.Mesh(islandGeo, islandMat);
    groundMesh.position.y = -1.8;
    scene.add(groundMesh);

    // Stylized Island Trees / Crystals
    buildIslandFlora();
    buildCentralExplorerBot();

  } else if (theme === "cyber") {
    scene.background = new THREE.Color(0x110726);
    scene.fog.color = new THREE.Color(0x110726);

    // Neon Cyber Grid
    const gridHelper = new THREE.GridHelper(24, 24, 0xec4899, 0x8b5cf6);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);
    groundMesh = gridHelper;

    buildCentralCyberSpeedster();
  }
}

function buildCentralSpaceship() {
  centralShip = new THREE.Group();

  // Ship Hull
  const hullGeo = new THREE.ConeGeometry(0.8, 2.2, 5);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.7,
    roughness: 0.2
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = Math.PI / 2;
  centralShip.add(hull);

  // Wings
  const wingGeo = new THREE.BoxGeometry(2.4, 0.06, 0.9);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8 });
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, 0, -0.2);
  centralShip.add(wings);

  // Cockpit glow
  const cockpitGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const cockpitMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, 0.25, 0.2);
  centralShip.add(cockpit);

  // Thruster Light
  const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.05, 0.5, 16);
  const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
  thruster.rotation.x = Math.PI / 2;
  thruster.position.set(0, 0, -1.3);
  centralShip.add(thruster);

  centralShip.position.set(0, 0.2, 0);
  scene.add(centralShip);
}

function buildIslandFlora() {
  centralShip = new THREE.Group();
  // Central beacon stone
  const stoneGeo = new THREE.DodecahedronGeometry(0.9, 0);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, emissive: 0x064e3b });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  centralShip.add(stone);

  const ringGeo = new THREE.TorusGeometry(1.6, 0.06, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 3;
  centralShip.add(ring);

  centralShip.position.set(0, 0.4, 0);
  scene.add(centralShip);
}

function buildCentralExplorerBot() {
  // Added directly into central beacon
}

function buildCentralCyberSpeedster() {
  centralShip = new THREE.Group();
  // Neon Hovercraft
  const hoverGeo = new THREE.BoxGeometry(1.2, 0.3, 2.2);
  const hoverMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.9, roughness: 0.1 });
  const body = new THREE.Mesh(hoverGeo, hoverMat);
  centralShip.add(body);

  const neonStripeGeo = new THREE.BoxGeometry(1.25, 0.05, 2.25);
  const neonStripeMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
  const stripe = new THREE.Mesh(neonStripeGeo, neonStripeMat);
  centralShip.add(stripe);

  centralShip.position.set(0, 0.2, 0);
  scene.add(centralShip);
}

// Build 4 3D Answer Crystals with dynamic text sprites
function buildCrystals() {
  // Remove existing
  crystals.forEach(c => scene.remove(c));
  crystalSprites.forEach(s => scene.remove(s));
  crystals = [];
  crystalSprites = [];

  const crystalColors = [
    { main: 0x3b82f6, emissive: 0x1d4ed8, label: "A" }, // Blue
    { main: 0xa855f7, emissive: 0x7e22ce, label: "B" }, // Purple
    { main: 0x10b981, emissive: 0x047857, label: "C" }, // Green
    { main: 0xf59e0b, emissive: 0xb45309, label: "D" }  // Amber
  ];

  // Distribute 4 crystals in an arc in front of the camera
  // Positions: left, center-left, center-right, right
  const radius = 4.2;
  const angles = [
    Math.PI * 0.72,  // A (Left)
    Math.PI * 0.58,  // B (Center Left)
    Math.PI * 0.42,  // C (Center Right)
    Math.PI * 0.28   // D (Right)
  ];

  for (let i = 0; i < 4; i++) {
    const angle = angles[i];
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 0.5;

    // Crystal Geometry: Octahedron
    const crystalGeo = new THREE.OctahedronGeometry(0.65, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: crystalColors[i].main,
      emissive: crystalColors[i].emissive,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.95
    });

    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(x, 0.8, z);
    crystal.userData = {
      index: i,
      baseY: 0.8,
      floatOffset: i * 0.7,
      color: crystalColors[i].main
    };

    scene.add(crystal);
    crystals.push(crystal);

    // Floating Text Sprite above crystal
    const textSprite = createTextSprite(crystalColors[i].label, state.answers[i] || `Choice ${i + 1}`);
    textSprite.position.set(x, 2.0, z);
    scene.add(textSprite);
    crystalSprites.push(textSprite);
  }
}

// Create 2D canvas sprite for 3D label
function createTextSprite(letter, text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");

  // Rounded bubble background
  ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 4;
  roundRect(ctx, 10, 10, 492, 120, 24);
  ctx.fill();
  ctx.stroke();

  // Badge Letter circle
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(60, 70, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 60, 70);

  // Answer Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const truncated = text.length > 20 ? text.substring(0, 19) + "..." : text;
  ctx.fillText(truncated, 110, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(2.4, 0.65, 1);
  sprite.userData = { canvas, ctx, letter };
  return sprite;
}

function updateSpriteText(index, text) {
  if (!crystalSprites[index]) return;
  const sprite = crystalSprites[index];
  const { canvas, ctx, letter } = sprite.userData;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 4;
  roundRect(ctx, 10, 10, 492, 120, 24);
  ctx.fill();
  ctx.stroke();

  // Badge
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(60, 70, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 60, 70);

  // Truncated Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const truncated = text.length > 20 ? text.substring(0, 19) + "..." : text;
  ctx.fillText(truncated, 110, 70);

  sprite.material.map.needsUpdate = true;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Controls: Orbit / Rotate Canvas & Click on 3D Crystals
function setupCanvasControls(container) {
  let touchStartX = 0;

  const onPointerDown = (clientX, clientY) => {
    isDragging = true;
    previousMousePosition = { x: clientX, y: clientY };
  };

  const onPointerMove = (clientX, clientY) => {
    if (!isDragging) return;
    const deltaX = clientX - previousMousePosition.x;
    targetRotationY += deltaX * 0.005;
    previousMousePosition = { x: clientX, y: clientY };
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  // Mouse Listeners
  container.addEventListener("mousedown", (e) => {
    onPointerDown(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", (e) => {
    onPointerMove(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", onPointerUp);

  // Touch Listeners
  container.addEventListener("touchstart", (e) => {
    if (e.touches.length > 0) {
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener("touchend", onPointerUp);

  // Click on Canvas for 3D Raycasting
  container.addEventListener("click", (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(crystals);

    if (intersects.length > 0) {
      const hitCrystal = intersects[0].object;
      const index = hitCrystal.userData.index;
      handleSelectAnswer(index);
    }
  });
}

function onWindowResize() {
  const container = document.getElementById("threejs-canvas-container");
  if (!container || !renderer || !camera) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Reset camera view
function reset3DCamera() {
  targetRotationY = 0;
  camera.position.set(0, 5, 12);
  camera.lookAt(0, 0, 0);
  playClickSound();
}

// Main 3D Animation Loop
function animateThreeJS() {
  animationFrameId = requestAnimationFrame(animateThreeJS);

  const time = performance.now() * 0.0015;

  // Smooth Orbit Rotation
  currentRotationY += (targetRotationY - currentRotationY) * 0.08;
  scene.rotation.y = currentRotationY;

  // Central Ship / Object gentle float & bob
  if (centralShip) {
    centralShip.position.y = 0.2 + Math.sin(time * 2) * 0.15;
    centralShip.rotation.y = time * 0.4;
    centralShip.rotation.z = Math.sin(time) * 0.06;
  }

  // Floating Crystals animation
  crystals.forEach((crystal, i) => {
    const offset = crystal.userData.floatOffset;
    crystal.position.y = crystal.userData.baseY + Math.sin(time * 2.5 + offset) * 0.22;
    crystal.rotation.x = time * 0.8 + offset;
    crystal.rotation.y = time * 1.2 + offset;

    // Sprite follows position
    if (crystalSprites[i]) {
      crystalSprites[i].position.y = crystal.position.y + 1.1;
    }
  });

  // Star Particles gentle drift
  if (starParticles) {
    starParticles.rotation.y = time * 0.03;
  }

  renderer.render(scene, camera);
}

// -------------------------------------------------------------
// USER INTERACTION & QUESTION FORM LOGIC
// -------------------------------------------------------------

// Load a subject preset
function loadQuizPreset(presetKey) {
  const preset = QUIZ_PRESETS[presetKey];
  if (!preset) return;

  state.activePreset = presetKey;
  state.question = preset.question;
  state.answers = [...preset.answers];
  state.correctIndex = preset.correctIndex;
  state.activeTheme = preset.theme;

  // Update preset buttons styling
  document.querySelectorAll(".preset-btn").forEach(btn => {
    if (btn.dataset.preset === presetKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update Theme buttons styling
  setWorldTheme(preset.theme, false);

  // Sync Form UI
  syncFormUI();

  // Rebuild 3D world for theme and answers
  buildEnvironment();
  buildCrystals();

  flashSyncIndicator();
  playClickSound();
}

// Change 3D theme (space, island, cyber)
function setWorldTheme(theme, rebuild = true) {
  state.activeTheme = theme;

  document.querySelectorAll(".theme-btn").forEach(btn => {
    if (btn.dataset.theme === theme) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const titleMap = {
    space: "Space Orbit 3D",
    island: "Island Run 3D",
    cyber: "Cyber Grid 3D"
  };
  const titleElem = document.getElementById("arena-title");
  if (titleElem) titleElem.textContent = titleMap[theme] || "3D Game Arena";

  if (rebuild) {
    buildEnvironment();
    buildCrystals();
    flashSyncIndicator();
  }
}

// Preview template from card in the 3D simulator
function previewTemplateInSimulator(theme) {
  setWorldTheme(theme, true);
  const element = document.getElementById("interactive-engine");
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
}

// Update UI fields from state
function syncFormUI() {
  const qInput = document.getElementById("form-question");
  if (qInput) qInput.value = state.question;

  const overlayQ = document.getElementById("overlay-question-text");
  if (overlayQ) overlayQ.textContent = state.question;

  state.answers.forEach((ans, idx) => {
    const textInput = document.getElementById(`opt-text-${idx}`);
    if (textInput) textInput.value = ans;

    const radio = document.getElementById(`opt-radio-${idx}`);
    if (radio) radio.checked = (idx === state.correctIndex);

    const btnLabel = document.getElementById(`answer-label-${idx}`);
    if (btnLabel) btnLabel.textContent = ans;

    updateSpriteText(idx, ans);
  });
}

// Live typing sync listeners
function initFormListeners() {
  const qInput = document.getElementById("form-question");
  if (qInput) {
    qInput.addEventListener("input", (e) => {
      state.question = e.target.value;
      const overlayQ = document.getElementById("overlay-question-text");
      if (overlayQ) overlayQ.textContent = state.question || "Enter question prompt above...";
      flashSyncIndicator();
    });
  }

  for (let i = 0; i < 4; i++) {
    const optInput = document.getElementById(`opt-text-${i}`);
    if (optInput) {
      optInput.addEventListener("input", (e) => {
        state.answers[i] = e.target.value || `Option ${String.fromCharCode(65 + i)}`;
        const btnLabel = document.getElementById(`answer-label-${i}`);
        if (btnLabel) btnLabel.textContent = state.answers[i];
        updateSpriteText(i, state.answers[i]);
        flashSyncIndicator();
      });
    }

    const radio = document.getElementById(`opt-radio-${i}`);
    if (radio) {
      radio.addEventListener("change", () => {
        state.correctIndex = i;
        flashSyncIndicator();
        playClickSound();
      });
    }
  }
}

function flashSyncIndicator() {
  const indicator = document.getElementById("sync-indicator");
  if (!indicator) return;
  indicator.classList.remove("fade-in");
  void indicator.offsetWidth; // trigger reflow
  indicator.classList.add("fade-in");
}

// -------------------------------------------------------------
// GAMEPLAY ANSWER SELECTION & FEEDBACK
// -------------------------------------------------------------
function handleSelectAnswer(index) {
  const isCorrect = (index === state.correctIndex);
  const feedbackBanner = document.getElementById("game-feedback-banner");
  const feedbackMessage = document.getElementById("feedback-message");
  const scoreElem = document.getElementById("game-score");

  // Animate chosen crystal
  if (crystals[index]) {
    const targetScale = isCorrect ? 1.4 : 0.8;
    crystals[index].scale.set(targetScale, targetScale, targetScale);
    setTimeout(() => {
      if (crystals[index]) crystals[index].scale.set(1, 1, 1);
    }, 400);
  }

  if (isCorrect) {
    state.score += 100;
    if (scoreElem) scoreElem.textContent = state.score;

    playSuccessSound();
    triggerConfetti();

    if (feedbackBanner && feedbackMessage) {
      feedbackMessage.innerHTML = "✨ <strong>CORRECT! +100 XP</strong> — Excellent work!";
      feedbackBanner.className = "absolute top-20 z-20 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-2xl bg-emerald-600/90 border border-emerald-400 backdrop-blur-md transform transition-all duration-300 block";
    }

    // Highlight button in green
    const btn = document.getElementById(`answer-btn-${index}`);
    if (btn) {
      btn.classList.add("bg-emerald-600", "border-emerald-400");
      setTimeout(() => {
        btn.classList.remove("bg-emerald-600", "border-emerald-400");
      }, 1500);
    }

  } else {
    playWrongSound();

    if (feedbackBanner && feedbackMessage) {
      feedbackMessage.innerHTML = "❌ <strong>Almost!</strong> Check the correct answer or try again!";
      feedbackBanner.className = "absolute top-20 z-20 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-2xl bg-rose-600/90 border border-rose-400 backdrop-blur-md transform transition-all duration-300 block";
    }

    // Shake button
    const btn = document.getElementById(`answer-btn-${index}`);
    if (btn) {
      btn.classList.add("bg-rose-700", "border-rose-500");
      setTimeout(() => {
        btn.classList.remove("bg-rose-700", "border-rose-500");
      }, 1200);
    }
  }

  // Auto-hide feedback after 2.8s
  setTimeout(() => {
    if (feedbackBanner) feedbackBanner.classList.add("hidden");
  }, 2800);
}

// Confetti Cannon Trigger
function triggerConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

// -------------------------------------------------------------
// AUDIENCE TABS SWITCHING
// -------------------------------------------------------------
function switchAudience(tabKey) {
  playClickSound();

  // Reset tab buttons
  const tabs = ["teachers", "schools", "students", "parents"];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);

    if (t === tabKey) {
      if (btn) btn.classList.add("active");
      if (panel) {
        panel.classList.remove("hidden");
        panel.classList.add("fade-in");
      }
    } else {
      if (btn) btn.classList.remove("active");
      if (panel) panel.classList.add("hidden");
    }
  });
}

// -------------------------------------------------------------
// ROI CALCULATOR LOGIC
// -------------------------------------------------------------
function initCalculator() {
  const studentsSlider = document.getElementById("calc-students");
  const quizzesSlider = document.getElementById("calc-quizzes");

  const updateCalc = () => {
    const students = parseInt(studentsSlider.value, 10);
    const quizzes = parseInt(quizzesSlider.value, 10);

    const studentsVal = document.getElementById("calc-students-val");
    const quizzesVal = document.getElementById("calc-quizzes-val");
    const hoursSavedElem = document.getElementById("calc-hours-saved");
    const engHoursElem = document.getElementById("calc-engagement-hours");

    if (studentsVal) studentsVal.textContent = `${students} Students`;
    if (quizzesVal) quizzesVal.textContent = `${quizzes} Quizzes / mo`;

    // 1.5 minutes saved per student per quiz via automated grading & 3D telemetry
    const hoursSaved = ((students * quizzes * 1.5) / 60).toFixed(1);
    // Average 20 mins spent eagerly replaying & mastering
    const engagementHours = Math.round((students * quizzes * 22) / 60);

    if (hoursSavedElem) hoursSavedElem.textContent = `${hoursSaved} Hours`;
    if (engHoursElem) engHoursElem.textContent = `${engagementHours}+ Hours`;
  };

  if (studentsSlider && quizzesSlider) {
    studentsSlider.addEventListener("input", updateCalc);
    quizzesSlider.addEventListener("input", updateCalc);
    updateCalc();
  }
}

// -------------------------------------------------------------
// PRICING BILLING TOGGLE
// -------------------------------------------------------------
function setBilling(cycle) {
  state.billingCycle = cycle;
  playClickSound();

  const monthlyBtn = document.getElementById("toggle-monthly");
  const annualBtn = document.getElementById("toggle-annual");
  const priceElem = document.getElementById("pro-price");
  const periodElem = document.getElementById("pro-period");

  if (cycle === "annual") {
    annualBtn.className = "px-4 py-2 rounded-lg text-xs font-bold bg-brand-600 text-white shadow transition flex items-center gap-1.5";
    monthlyBtn.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition";
    if (priceElem) priceElem.textContent = "$8";
    if (periodElem) periodElem.textContent = "/ month (billed annually)";
  } else {
    monthlyBtn.className = "px-4 py-2 rounded-lg text-xs font-bold bg-brand-600 text-white shadow transition";
    annualBtn.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5";
    if (priceElem) priceElem.textContent = "$10";
    if (periodElem) periodElem.textContent = "/ month";
  }
}

// -------------------------------------------------------------
// FAQ ACCORDION
// -------------------------------------------------------------
function toggleFaq(button) {
  playClickSound();
  const parent = button.parentElement;
  const content = parent.querySelector(".faq-content");
  const icon = parent.querySelector(".faq-icon");

  if (content.classList.contains("hidden")) {
    content.classList.remove("hidden");
    if (icon) icon.style.transform = "rotate(180deg)";
  } else {
    content.classList.add("hidden");
    if (icon) icon.style.transform = "rotate(0deg)";
  }
}

// -------------------------------------------------------------
// MODALS LOGIC
// -------------------------------------------------------------
function openSignupModal(role = "Teacher") {
  playClickSound();
  const modal = document.getElementById("signup-modal");
  const roleSelect = document.getElementById("modal-role-select");
  const roleTitle = document.getElementById("modal-role-title");

  if (roleSelect) {
    if (role.toLowerCase().includes("school")) roleSelect.value = "School Admin";
    else if (role.toLowerCase().includes("parent")) roleSelect.value = "Parent";
    else if (role.toLowerCase().includes("student")) roleSelect.value = "Student";
    else roleSelect.value = "Teacher";
  }

  if (roleTitle) roleTitle.textContent = `Get Started Free (${role})`;
  if (modal) modal.classList.remove("hidden");
}

function closeSignupModal() {
  const modal = document.getElementById("signup-modal");
  if (modal) modal.classList.add("hidden");
}

function handleSignupSubmit(e) {
  e.preventDefault();
  playSuccessSound();
  triggerConfetti();

  const form = document.getElementById("signup-form");
  const successState = document.getElementById("signup-success-state");

  if (form) form.classList.add("hidden");
  if (successState) successState.classList.remove("hidden");
}

function openJoinModal() {
  playClickSound();
  const modal = document.getElementById("join-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeJoinModal() {
  const modal = document.getElementById("join-modal");
  if (modal) modal.classList.add("hidden");
}

function handleJoinGame(e) {
  e.preventDefault();
  playSuccessSound();
  const status = document.getElementById("join-modal-status");
  if (status) {
    status.classList.remove("hidden");
    status.textContent = "Connecting to 3D Arena Server... Verified PIN!";
    setTimeout(() => {
      closeJoinModal();
      scrollToDemo();
    }, 1200);
  }
}

function testQuickPin() {
  const pinInput = document.getElementById("demo-pin-input");
  const pin = pinInput ? pinInput.value : "";
  openJoinModal();
  const modalPin = document.getElementById("modal-pin-input");
  if (modalPin && pin) modalPin.value = pin;
}

function scrollToDemo() {
  const elem = document.getElementById("interactive-engine");
  if (elem) elem.scrollIntoView({ behavior: "smooth" });
}

// -------------------------------------------------------------
// MOBILE MENU TOGGLE
// -------------------------------------------------------------
function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
    playClickSound();
  });

  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      menu.classList.add("hidden");
    });
  });
}

// -------------------------------------------------------------
// INITIALIZATION ON DOM READY
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Initialize Three.js 3D engine
  initThreeJS();

  // Initialize UI forms & interactions
  syncFormUI();
  initFormListeners();
  initCalculator();
  initMobileMenu();
});
