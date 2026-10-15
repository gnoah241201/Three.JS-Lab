import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const isHeadless = typeof navigator !== 'undefined' && (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

export function createSetup(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: !isHeadless, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !isHeadless;
  if (!isHeadless) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);

  // Opaque background: refraction (transmission) and additive glass reflections both need
  // something real behind them; a transparent canvas composites them wrongly.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ece3cf');
  scene.fog = new THREE.Fog('#ece3cf', 4.5, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(0.75, 1.25, 2.85);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.24, -0.05);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 5;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.46;

  const sun = new THREE.DirectionalLight('#fff4e2', 1.7);
  sun.position.set(2.2, 4, 2.5);
  if (!isHeadless) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 1, far: 9 });
  }
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.5);
  fill.position.set(-3, 2, 1);
  scene.add(sun, fill, new THREE.HemisphereLight('#fff8ee', '#6b5a48', 0.5));

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole bench in frame on narrow viewports.
    camera.fov = w / h < 1.2 ? 32 * Math.min(1.6, 1.2 / (w / h)) : 32;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  return { renderer, scene, camera, controls };
}
