import * as THREE from 'three';

const HOVER_Y = 0.35; // bottle base height while carried
const SNAP_DISTANCE = 0.4; // xz distance from the beaker mouth that snaps into pour pose
const POUR_DELAY = 0.25; // seconds at the beaker before pouring starts
const TILT = Math.PI / 3;

export function createDrag({ camera, dom, controls, bottles, lab, pour }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOVER_Y);
  const hit = new THREE.Vector3();
  const targetPos = new THREE.Vector3();
  const returning = new Set();
  let targetTilt = 0;
  let held = null;
  let snapped = false;
  let snapTime = 0;

  function setPointer(e) {
    const r = dom.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }

  function pickBottle() {
    const groups = [...bottles.values()].filter((b) => b.group.visible).map((b) => b.group);
    const intersects = raycaster.intersectObjects(groups, true);
    if (!intersects.length) return null;
    let obj = intersects[0].object;
    while (obj && !obj.userData?.reagent) {
      obj = obj.parent;
    }
    const reagentKey = obj ? obj.userData.reagent : intersects[0].object.userData.reagent;
    return reagentKey ? bottles.get(reagentKey) : null;
  }

  // Liquids tilt so the mouth sits just above the beaker; gas stands beside it (a tube does the rest).
  function pourPose(bottle) {
    if (bottle.kind === 'gas') {
      return { position: new THREE.Vector3(lab.mouth.x - 0.5, 0.25, lab.mouth.z), tilt: 0 };
    }
    const mouthTarget = lab.mouth.clone().add(new THREE.Vector3(-0.05, 0.22, 0));
    const dir = new THREE.Vector3(Math.sin(TILT), Math.cos(TILT), 0);
    return { position: mouthTarget.sub(dir.multiplyScalar(bottle.mouthHeight)), tilt: TILT };
  }

  function onDown(e) {
    setPointer(e);
    const b = pickBottle();
    if (!b) return;
    held = b;
    snapped = false;
    snapTime = 0;
    returning.delete(b);
    controls.enabled = false; // runs before OrbitControls thanks to capture phase
    dom.setPointerCapture(e.pointerId);
    onMove(e);
  }

  function onMove(e) {
    if (!held) return;
    setPointer(e);
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    const near = Math.hypot(hit.x - lab.mouth.x, hit.z - lab.mouth.z) < SNAP_DISTANCE;
    if (near) {
      const pose = pourPose(held);
      targetPos.copy(pose.position);
      targetTilt = pose.tilt;
    } else {
      targetPos.set(hit.x, HOVER_Y, hit.z);
      targetTilt = 0;
      pour.stop();
    }
    if (near !== snapped) {
      snapped = near;
      snapTime = 0;
    }
  }

  function onUp(e) {
    if (!held) return;
    pour.stop();
    returning.add(held);
    held = null;
    snapped = false;
    controls.enabled = true;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
  }

  dom.addEventListener('pointerdown', onDown, { capture: true });
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);

  return {
    get held() { return held; },
    get snapped() { return snapped; },
    update(dt) {
      const k = 1 - Math.exp(-dt * 14);
      if (held) {
        held.group.position.lerp(targetPos, k);
        held.group.rotation.z += (-targetTilt - held.group.rotation.z) * k;
        if (snapped) {
          snapTime += dt;
          if (snapTime >= POUR_DELAY) pour.start(held.key);
        }
      }
      for (const b of returning) {
        b.group.position.lerp(b.home, k);
        b.group.rotation.z -= b.group.rotation.z * k;
        if (b.group.position.distanceTo(b.home) < 0.002 && Math.abs(b.group.rotation.z) < 0.002) {
          b.group.position.copy(b.home);
          b.group.rotation.z = 0;
          returning.delete(b);
        }
      }
    },
    mouthWorld(bottle, out = new THREE.Vector3()) {
      return out.set(0, bottle.mouthHeight, 0).applyMatrix4(bottle.group.matrixWorld);
    },
    reset() {
      pour.stop();
      held = null;
      snapped = false;
      returning.clear();
      controls.enabled = true;
    },
  };
}
