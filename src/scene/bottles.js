import * as THREE from 'three';
import { REAGENTS } from '../chem/scenarios.js';
import { isHeadless } from './setup.js';

const RISER_TOP = 0.06;
const SHELF_Z = -0.5;
const SPACING = 0.9;

function labelMaterial(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#efe6d2';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#2b2420';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#2b2420';

  // Normalize Unicode subscripts so fonts without U+2082 don't show tofu
  const norm = text.replace(/₂/g, '2').replace(/₃/g, '3').replace(/₄/g, '4');
  const tokens = norm.split(/([0-9]+)/);
  const baseFont = '600 48px Georgia, "DejaVu Serif", serif';
  const subFont = '600 32px Georgia, "DejaVu Serif", serif';

  // Measure total width to center properly
  let totalW = 0;
  for (const t of tokens) {
    if (!t) continue;
    ctx.font = /^[0-9]+$/.test(t) ? subFont : baseFont;
    totalW += ctx.measureText(t).width;
  }

  let startX = (256 - totalW) / 2;
  for (const t of tokens) {
    if (!t) continue;
    if (/^[0-9]+$/.test(t)) {
      ctx.font = subFont;
      ctx.textBaseline = 'middle';
      ctx.fillText(t, startX, 78);
      startX += ctx.measureText(t).width;
    } else {
      ctx.font = baseFont;
      ctx.textBaseline = 'middle';
      ctx.fillText(t, startX, 66);
      startX += ctx.measureText(t).width;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
}

// Label wraps the front (+z) of a cylinder of the given radius.
function label(text, radius, y) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.1, 24, 1, true, -0.9, 1.8), labelMaterial(text));
  mesh.position.y = y;
  return mesh;
}

function liquidBottle(reagent) {
  const group = new THREE.Group();
  const profile = [
    [0, 0], [0.09, 0], [0.095, 0.02], [0.095, 0.26], [0.05, 0.32], [0.035, 0.34], [0.035, 0.4], [0.042, 0.41], [0.042, 0.42], [0, 0.42],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 32),
    new THREE.MeshPhysicalMaterial({ color: '#a9c4b6', roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  const fill = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: reagent.color, roughness: 0.3 }),
  );
  fill.position.y = 0.11;
  group.add(glass, fill, label(reagent.label, 0.097, 0.15));
  return { group, mouthHeight: 0.42 };
}

function gasCylinder(reagent) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#5b6b70', metalness: 0.6, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 24), steel);
  body.position.y = 0.18;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  dome.position.y = 0.36;
  const valve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.8, roughness: 0.3 }),
  );
  valve.position.y = 0.46;
  group.add(body, dome, valve, label(reagent.label, 0.082, 0.2));
  return { group, mouthHeight: 0.5 };
}

export function createBottles(scene) {
  const bottles = new Map();
  for (const [key, reagent] of Object.entries(REAGENTS)) {
    const built = reagent.kind === 'gas' ? gasCylinder(reagent) : liquidBottle(reagent);
    built.group.traverse((o) => {
      if (o.isMesh) {
        if (!isHeadless) o.castShadow = true;
        o.userData.reagent = key;
      }
    });
    built.group.visible = false;
    scene.add(built.group);
    bottles.set(key, { key, kind: reagent.kind, group: built.group, mouthHeight: built.mouthHeight, home: new THREE.Vector3() });
  }

  function showFor(reagentKeys) {
    for (const b of bottles.values()) b.group.visible = false;
    reagentKeys.forEach((key, i) => {
      const b = bottles.get(key);
      if (b) {
        b.home.set((i - (reagentKeys.length - 1) / 2) * SPACING, RISER_TOP, SHELF_Z);
        b.group.position.copy(b.home);
        b.group.rotation.set(0, 0, 0);
        b.group.visible = true;
      }
    });
  }

  return { bottles, showFor };
}
