import * as THREE from 'three';
import { BEAKER } from './lab.js';
import { REAGENTS } from '../chem/scenarios.js';

const MAX_PARTICLES = 400;
const PARTICLES_PER_MOL = 2000; // 0.1 mol precipitate → 200 particles
const MAX_BUBBLES = 120;
const PRECIP_COLORS = { CaCO3: '#f4f3ee', AlOH3: '#e9eef2' };

export function createEffects(scene, lab) {
  const dummy = new THREE.Object3D();
  const base = BEAKER.position;
  const inner = BEAKER.radius - BEAKER.wall - 0.03;

  // Precipitate: particles spawn near the surface, sink to a resting layer, shrink away when dissolving.
  const pMat = new THREE.MeshStandardMaterial({ color: PRECIP_COLORS.CaCO3, roughness: 0.9 });
  const particles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.009, 0), pMat, MAX_PARTICLES);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  const pState = Array.from({ length: MAX_PARTICLES }, () => ({ x: 0, y: 0, z: 0, restY: 0, scale: 0, alive: false }));

  function spawn(p, topY) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * inner;
    p.x = base.x + Math.cos(a) * r;
    p.z = base.z + Math.sin(a) * r;
    p.y = topY - Math.random() * 0.05;
    p.restY = BEAKER.wall + 0.008 + Math.random() * 0.025;
    p.alive = true;
  }

  // CO2 bubbles rising from the tube tip.
  const bubbles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.006, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.1 }),
    MAX_BUBBLES,
  );
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.frustumCulled = false;
  const bState = Array.from({ length: MAX_BUBBLES }, () => ({ x: 0, y: 0, z: 0, v: 0, alive: false }));
  let bubbleBudget = 0;
  let t = 0;

  // Liquid pour stream (origin at the top, scaled down to the surface).
  const streamMat = new THREE.MeshPhysicalMaterial({ color: '#d6ecf3', transparent: true, opacity: 0.75, roughness: 0.05, clearcoat: 1, depthWrite: false });
  const streamGeo = new THREE.CylinderGeometry(0.011, 0.007, 1, 16, 1, true);
  streamGeo.translate(0, -0.5, 0);
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.visible = false;

  // Gas tube from the cylinder valve down to the beaker bottom.
  const tube = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.6 }));
  tube.visible = false;
  const lastTubeFrom = new THREE.Vector3(Infinity, 0, 0);

  scene.add(particles, bubbles, stream, tube);

  function updateTube(from) {
    if (from.distanceTo(lastTubeFrom) < 0.002) return;
    lastTubeFrom.copy(from);
    const curve = new THREE.CatmullRomCurve3([
      from.clone(),
      from.clone().add(new THREE.Vector3(0, 0.12, 0)),
      new THREE.Vector3(base.x - 0.04, lab.mouth.y + 0.1, base.z),
      new THREE.Vector3(base.x, BEAKER.wall + 0.03, base.z),
    ]);
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(curve, 40, 0.008, 8);
  }

  return {
    update(snap, dt, pourFrom) {
      const { beaker, volumeL, pouring } = snap;
      t += dt;
      lab.setLevel(volumeL / BEAKER.maxVolumeL);
      lab.setTurbidity(beaker.turbidity, beaker.liquidColor);
      const topY = lab.liquidTopY();

      if (beaker.precipitateKind) pMat.color.set(PRECIP_COLORS[beaker.precipitateKind]);
      const target = Math.min(MAX_PARTICLES, Math.round(beaker.precipitate * PARTICLES_PER_MOL));
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = pState[i];
        const want = i < target;
        if (want && !p.alive) spawn(p, topY);
        if (p.alive) {
          p.y = Math.max(p.restY, p.y - dt * 0.06);
          p.scale += ((want ? 1 : 0) - p.scale) * Math.min(1, dt * 4);
          if (!want && p.scale < 0.02) {
            p.alive = false;
            p.scale = 0;
          }
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      const gasIntoLiquid = pouring === 'CO2' && topY > BEAKER.wall + 0.01;
      if (gasIntoLiquid) bubbleBudget = Math.min(5, bubbleBudget + dt * 80);
      for (let i = 0; i < MAX_BUBBLES; i++) {
        const b = bState[i];
        if (!b.alive && bubbleBudget >= 1) {
          bubbleBudget -= 1;
          b.alive = true;
          b.x = base.x + (Math.random() - 0.5) * 0.03;
          b.z = base.z + (Math.random() - 0.5) * 0.03;
          b.y = BEAKER.wall + 0.03;
          b.v = 0.15 + Math.random() * 0.15;
        }
        if (b.alive) {
          b.y += b.v * dt;
          b.x += Math.sin(t * 12 + i) * 0.0015;
          b.z += Math.cos(t * 10 + i) * 0.0015;
          if (b.y >= topY) b.alive = false;
        }
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.setScalar(b.alive ? 0.7 + (b.y - BEAKER.wall) * 2 : 0);
        dummy.updateMatrix();
        bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;

      const reagent = pouring ? REAGENTS[pouring] : null;
      stream.visible = !!(reagent && reagent.kind === 'liquid' && pourFrom);
      if (stream.visible) {
        streamMat.color.set(reagent.color);
        stream.position.copy(pourFrom);
        const w = 1 + Math.sin(t * 23) * 0.12;
        stream.scale.set(w, Math.max(0.01, pourFrom.y - BEAKER.position.y - topY), w);
      }
      tube.visible = !!(reagent && reagent.kind === 'gas' && pourFrom);
      if (tube.visible) updateTube(pourFrom);
    },
  };
}
