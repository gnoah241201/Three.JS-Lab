import * as THREE from 'three';

// CPK-ish colors and display radii.
const ELEMENTS = {
  H: ['#ffffff', 0.22], C: ['#3a3a3a', 0.32], O: ['#e0312b', 0.32], Na: ['#9b5de5', 0.42],
  Ca: ['#3fae5a', 0.45], Al: ['#b8a2a2', 0.4], Cl: ['#4fd16b', 0.4],
};

const OH = { el: 'O', children: [{ el: 'H' }] };
const HCO3 = { el: 'O', children: [{ el: 'C', children: [{ el: 'O' }, OH] }] };
const TREES = {
  CO2: { el: 'C', children: [{ el: 'O' }, { el: 'O' }] },
  NaOH: { el: 'O', children: [{ el: 'Na' }, { el: 'H' }] },
  NaCl: { el: 'Na', children: [{ el: 'Cl' }] },
  Na2CO3: { el: 'C', children: [{ el: 'O', children: [{ el: 'Na' }] }, { el: 'O', children: [{ el: 'Na' }] }, { el: 'O' }] },
  NaHCO3: { el: 'C', children: [{ el: 'O', children: [{ el: 'Na' }] }, OH, { el: 'O' }] },
  CaOH2: { el: 'Ca', children: [OH, OH] },
  CaCO3: { el: 'C', children: [{ el: 'O', children: [{ el: 'Ca' }] }, { el: 'O' }, { el: 'O' }] },
  CaHCO32: { el: 'Ca', children: [HCO3, HCO3] },
  AlCl3: { el: 'Al', children: [{ el: 'Cl' }, { el: 'Cl' }, { el: 'Cl' }] },
  AlOH3: { el: 'Al', children: [OH, OH, OH] },
  NaAlOH4: { el: 'Al', children: [OH, OH, OH, { el: 'O', children: [{ el: 'H' }, { el: 'Na' }] }] },
};

const ROOT_DIRS = {
  1: [[0, 1, 0]],
  2: [[-1, 0, 0], [1, 0, 0]],
  3: [[0, 1, 0], [0.866, -0.5, 0], [-0.866, -0.5, 0]],
  4: [[0, 1, 0], [0.943, -0.333, 0], [-0.471, -0.333, 0.816], [-0.471, -0.333, -0.816]],
};
const BOND = 0.75;
const MAX_ATOMS = 700;
const MAX_BONDS = 700;
const TOTAL_MOLECULES = 30;
const BOX = 3.2;

// Children of a non-root atom fan out in a cone around the incoming bond direction.
function childDirs(n, inDir) {
  if (!inDir) return ROOT_DIRS[n].map((d) => new THREE.Vector3(...d).normalize());
  if (n === 1) return [inDir.clone()];
  const helper = Math.abs(inDir.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const u = new THREE.Vector3().crossVectors(inDir, helper).normalize();
  const v = new THREE.Vector3().crossVectors(inDir, u);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const offset = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)).multiplyScalar(0.9);
    return inDir.clone().add(offset).normalize();
  });
}

function buildTemplate(node, pos = new THREE.Vector3(), inDir = null, atoms = [], bonds = []) {
  const index = atoms.length;
  atoms.push({ el: node.el, pos: pos.clone() });
  const kids = node.children ?? [];
  if (kids.length) {
    childDirs(kids.length, inDir).forEach((dir, i) => {
      const childIndex = atoms.length;
      buildTemplate(kids[i], pos.clone().addScaledVector(dir, BOND), dir, atoms, bonds);
      bonds.push([index, childIndex]);
    });
  }
  return { atoms, bonds };
}

export function createMicroscope(renderer, frameEl) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7f70', 1.2));
  const light = new THREE.DirectionalLight('#ffffff', 1.5);
  light.position.set(3, 5, 4);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 12.5);

  const templates = Object.fromEntries(Object.entries(TREES).map(([k, tree]) => [k, buildTemplate(tree)]));
  const color = new THREE.Color();
  const atomMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ roughness: 0.4 }), MAX_ATOMS);
  atomMesh.setColorAt(0, color.set('#ffffff')); // allocate instanceColor before the first compile
  const bondMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), new THREE.MeshStandardMaterial({ color: '#9a9187', roughness: 0.5 }), MAX_BONDS);
  for (const m of [atomMesh, bondMesh]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
  }
  scene.add(atomMesh, bondMesh);

  let molecules = [];
  let signature = '';
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const spinStep = new THREE.Quaternion();
  const euler = new THREE.Euler();

  function spawnMolecule(key) {
    return {
      key,
      pos: new THREE.Vector3((Math.random() - 0.5) * 2 * BOX, (Math.random() - 0.5) * 2 * BOX, (Math.random() - 0.5) * 2 * BOX),
      vel: new THREE.Vector3().randomDirection().multiplyScalar(0.6),
      quat: new THREE.Quaternion().random(),
      spin: new THREE.Vector3().randomDirection().multiplyScalar(0.8),
    };
  }

  // Molecule counts proportional to mole fractions; every present species shows at least one.
  function counts(species) {
    const entries = Object.entries(species).filter(([k, n]) => n > 0 && templates[k]);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);
    return entries.map(([k, n]) => [k, Math.max(1, Math.round((n / total) * TOTAL_MOLECULES))]);
  }

  function rebuild(list) {
    const pool = {};
    for (const m of molecules) (pool[m.key] ??= []).push(m);
    molecules = [];
    for (const [key, n] of list) for (let i = 0; i < n; i++) molecules.push(pool[key]?.pop() ?? spawnMolecule(key));
  }

  function toWorld(out, local, m) {
    return out.copy(local).applyQuaternion(m.quat).add(m.pos);
  }

  // Layout is read only when something resized, never per frame (avoids forced reflow).
  const rect = { x: 0, y: 0, w: 0, h: 0, cw: 0, ch: 0 };
  let rectDirty = true;
  function measure() {
    rectDirty = false;
    const c = renderer.domElement.getBoundingClientRect();
    const f = frameEl.getBoundingClientRect();
    Object.assign(rect, { x: f.left - c.left, y: c.bottom - f.bottom, w: f.width, h: f.height, cw: c.width, ch: c.height });
  }
  if (frameEl) {
    const ro = new ResizeObserver(() => { rectDirty = true; });
    ro.observe(frameEl);
    ro.observe(renderer.domElement);
    addEventListener('resize', () => { rectDirty = true; });
  }

  return {
    update(species, dt) {
      const list = counts(species);
      const sig = list.map(([k, n]) => `${k}${n}`).join('|');
      if (sig !== signature) {
        signature = sig;
        rebuild(list);
      }
      let ai = 0;
      let bi = 0;
      for (const m of molecules) {
        m.vel.x += (Math.random() - 0.5) * dt * 2;
        m.vel.y += (Math.random() - 0.5) * dt * 2;
        m.vel.z += (Math.random() - 0.5) * dt * 2;
        m.vel.clampLength(0.2, 1.2);
        m.pos.addScaledVector(m.vel, dt);
        for (const axis of ['x', 'y', 'z']) {
          if (Math.abs(m.pos[axis]) > BOX) {
            m.pos[axis] = Math.sign(m.pos[axis]) * BOX;
            m.vel[axis] *= -1;
          }
        }
        m.quat.multiply(spinStep.setFromEuler(euler.set(m.spin.x * dt, m.spin.y * dt, m.spin.z * dt)));

        const t = templates[m.key];
        for (const atom of t.atoms) {
          if (ai >= MAX_ATOMS) break;
          const [hex, radius] = ELEMENTS[atom.el];
          dummy.position.copy(toWorld(a, atom.pos, m));
          dummy.quaternion.identity();
          dummy.scale.setScalar(radius);
          dummy.updateMatrix();
          atomMesh.setMatrixAt(ai, dummy.matrix);
          atomMesh.setColorAt(ai, color.set(hex));
          ai++;
        }
        for (const [i, j] of t.bonds) {
          if (bi >= MAX_BONDS) break;
          toWorld(a, t.atoms[i].pos, m);
          toWorld(b, t.atoms[j].pos, m);
          dir.subVectors(b, a);
          dummy.position.addVectors(a, b).multiplyScalar(0.5);
          const len = dir.length();
          dummy.quaternion.setFromUnitVectors(up, dir.divideScalar(len));
          dummy.scale.set(1, len, 1);
          dummy.updateMatrix();
          bondMesh.setMatrixAt(bi++, dummy.matrix);
        }
      }
      atomMesh.count = ai;
      bondMesh.count = bi;
      atomMesh.instanceMatrix.needsUpdate = true;
      if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true;
      bondMesh.instanceMatrix.needsUpdate = true;
    },

    // Draws into the rectangle covered by #microscope-frame (CSS pixels; three applies pixelRatio).
    render() {
      if (!frameEl) return;
      if (rectDirty) measure();
      const { x, y, w, h, cw, ch } = rect;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setScissorTest(true);
      renderer.setScissor(x, y, w, h);
      renderer.setViewport(x, y, w, h);
      renderer.setClearColor('#f6efe0', 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 0);
      renderer.setViewport(0, 0, cw, ch);
    },
  };
}
