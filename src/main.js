import './ui/styles.css';
import * as THREE from 'three';
import { createSetup, isHeadless } from './scene/setup.js';
import { createLab, BEAKER } from './scene/lab.js';
import { createBottles } from './scene/bottles.js';
import { createEffects } from './scene/effects.js';
import { createMicroscope } from './scene/microscope.js';
import { createCallouts } from './scene/callouts.js';
import { createDrag } from './interact/drag.js';
import { createPourController } from './interact/pour.js';
import { createPanels } from './ui/panels.js';
import { createStore } from './state.js';
import { SCENARIOS } from './chem/scenarios.js';

const viewport = document.getElementById('viewport');
const { renderer, scene, camera, controls } = createSetup(viewport);
const lab = createLab(scene);
const { bottles, showFor } = createBottles(scene);
const effects = createEffects(scene, lab);

// Pointer cursor feedback: grab over a bottle, grabbing while carrying.
const hoverRay = new THREE.Raycaster();
const hoverPt = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag.held) { renderer.domElement.style.cursor = 'grabbing'; return; }
  const r = renderer.domElement.getBoundingClientRect();
  hoverPt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  hoverRay.setFromCamera(hoverPt, camera);
  const groups = [...bottles.values()].filter((b) => b.group.visible).map((b) => b.group);
  renderer.domElement.style.cursor = hoverRay.intersectObjects(groups, true).length ? 'grab' : '';
});
const microscope = createMicroscope(renderer, document.getElementById('microscope-frame'));
const store = createStore();
const pour = createPourController(store);
const drag = createDrag({ camera, dom: renderer.domElement, controls, bottles, lab, pour });
createPanels(document.getElementById('left'), document.getElementById('right'), store);

let snap = store.get();
let shownScenario = null;
const microEmpty = document.getElementById('microscope-empty');
function onSnapshot(s) {
  snap = s;
  microEmpty.hidden = Object.values(s.beaker.species).some((n) => n > 0);
  if (s.scenarioId !== shownScenario) {
    shownScenario = s.scenarioId;
    drag.reset();
    showFor(SCENARIOS[s.scenarioId].reagents);
  }
}
store.subscribe(onSnapshot);
onSnapshot(snap);

const callouts = createCallouts(document.getElementById('callouts'), camera, [
  {
    num: 1,
    title: 'Cốc phản ứng',
    text: 'Thành phần tính theo tổng số mol đã thêm, không phụ thuộc thứ tự rót.',
    offset: [60, -120],
    anchor: () => lab.mouth.clone().add(new THREE.Vector3(BEAKER.radius, 0, 0)),
  },
  {
    num: 2,
    title: 'Kết tủa',
    text: 'Số hạt tỉ lệ với số mol kết tủa.',
    offset: [-140, 20],
    anchor: () => (snap.beaker.precipitate > 0 ? BEAKER.position.clone().add(new THREE.Vector3(-0.08, 0.03, 0.08)) : null),
  },
  {
    num: 3,
    title: 'Thuốc thử',
    text: 'Kéo tới miệng cốc, giữ để rót.',
    offset: [-200, -70],
    anchor: () => {
      const b = bottles.get(SCENARIOS[snap.scenarioId].reagents[0]);
      return b ? b.home.clone().setY(b.home.y + b.mouthHeight) : null;
    },
  },
]);

const keys = { slow: false };
addEventListener('keydown', (e) => { if (e.key === 'Shift') keys.slow = true; });
addEventListener('keyup', (e) => { if (e.key === 'Shift') keys.slow = false; });
addEventListener('blur', () => { keys.slow = false; });

const clock = new THREE.Clock();
const mouth = new THREE.Vector3();
let lastRenderTime = 0;

renderer.setAnimationLoop((time) => {
  if (isHeadless && time - lastRenderTime < 66) { // ~15 fps in headless software renderer
    return;
  }
  lastRenderTime = time;
  const dt = Math.min(clock.getDelta(), 0.1);
  pour.update(dt, keys.slow);
  drag.update(dt);
  const pourFrom = pour.active && drag.held ? drag.mouthWorld(drag.held, mouth) : null;
  effects.update(snap, dt, pourFrom);
  lab.update(dt, !!snap.pouring);
  microscope.update(snap.beaker.species, dt);
  controls.update();
  renderer.render(scene, camera);
  microscope.render();
  callouts.update();
});

if (import.meta.env.DEV || typeof window !== 'undefined') {
  window.__lab = { renderer, scene, store, camera, controls, getSnap: () => snap };
}
