import * as THREE from 'three';
import { BEAKER } from './lab.js';
import { REAGENTS } from '../chem/scenarios.js';
import { createLiquidMaterial, createStream, setMilk } from './liquid.js';

const GRAVITY = 9.8;
const MAX_DROPS = 80;
const MAX_BUBBLES = 120;

// Each precipitate looks like the real thing:
//  CaCO3   – fine white powder: many tiny, opaque, matte grains that settle into a dense layer.
//  Al(OH)3 – gelatinous floc: fewer, larger, irregular translucent clumps that sink slowly.
const PRECIP = {
  CaCO3: { max: 1400, perMol: 9000, size: 0.0042, sink: 0.07, layer: 0.012 },
  AlOH3: { max: 220, perMol: 1800, size: 0.016, sink: 0.022, layer: 0.05 },
};

function flocGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.28 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7 - v.x * 2.1);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y * 0.75, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createEffects(scene, lab) {
  const dummy = new THREE.Object3D();
  const base = BEAKER.position;
  const inner = BEAKER.radius - BEAKER.wall - 0.02;

  function precipLayer(kind, geometry, material) {
    const cfg = PRECIP[kind];
    const mesh = new THREE.InstancedMesh(geometry, material, cfg.max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    const state = Array.from({ length: cfg.max }, () => ({
      x: 0, y: 0, z: 0, restY: 0, scale: 0, size: 1, alive: false, rot: new THREE.Euler(), spin: 0,
    }));
    return { kind, cfg, mesh, state };
  }

  const powder = precipLayer('CaCO3',
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: '#f7f6f1', roughness: 1, metalness: 0 }));
  const floc = precipLayer('AlOH3',
    flocGeometry(),
    new THREE.MeshPhysicalMaterial({
      color: '#eef4f7', roughness: 0.3, transparent: true, opacity: 0.72, depthWrite: false,
      clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 1.1, emissive: '#d9e2e6', emissiveIntensity: 0.15,
    }));
  const layers = [powder, floc];

  function spawn(L, p, topY) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * inner;
    p.x = base.x + Math.cos(a) * r;
    p.z = base.z + Math.sin(a) * r;
    p.y = topY - Math.random() * Math.max(0.01, (topY - BEAKER.wall) * 0.6); // forms throughout the bulk
    // Settled layer is thicker in the middle, like a real sediment mound.
    p.restY = BEAKER.wall + 0.004 + Math.random() * L.cfg.layer * (1 - 0.6 * (r / inner));
    p.size = L.cfg.size * (0.6 + Math.random() * 0.8);
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.spin = (Math.random() - 0.5) * 0.6;
    p.alive = true;
  }

  function updateLayer(L, amountMol, active, topY, dt, t) {
    const target = active ? Math.min(L.cfg.max, Math.round(amountMol * L.cfg.perMol)) : 0;
    let any = false;
    for (let i = 0; i < L.cfg.max; i++) {
      const p = L.state[i];
      const want = i < target;
      if (want && !p.alive) spawn(L, p, topY);
      if (p.alive) {
        any = true;
        if (p.y > p.restY) {
          p.y = Math.max(p.restY, p.y - dt * L.cfg.sink * (0.7 + 0.6 * ((i * 7919) % 100) / 100));
          p.x += Math.sin(t * 0.7 + i) * dt * 0.004; // gentle convection drift while sinking
          p.rot.y += p.spin * dt;
        }
        p.scale += ((want ? 1 : 0) - p.scale) * Math.min(1, dt * 3);
        if (!want && p.scale < 0.02) { p.alive = false; p.scale = 0; }
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.scale * p.size);
      dummy.updateMatrix();
      L.mesh.setMatrixAt(i, dummy.matrix);
    }
    L.mesh.visible = any;
    L.mesh.instanceMatrix.needsUpdate = true;
  }

  // CO2 bubbles: small, clear, with a bright rim (reflection only).
  const bubbles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0, envMapIntensity: 2.5, depthWrite: false,
    }),
    MAX_BUBBLES,
  );
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 2;
  const bState = Array.from({ length: MAX_BUBBLES }, () => ({ x: 0, y: 0, z: 0, v: 0, size: 0, alive: false }));
  let bubbleBudget = 0;

  // Pour stream + splash droplets share a water-like look tinted per reagent.
  const streamMat = createLiquidMaterial({ thickness: 0.02 });
  const stream = createStream(streamMat);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', transparent: true, opacity: 0.6, roughness: 0, ior: 1.333, envMapIntensity: 2, depthWrite: false,
  });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dropMat, MAX_DROPS);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  const dState = Array.from({ length: MAX_DROPS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), size: 0, alive: false }));
  let dropBudget = 0;

  let flow = 0; // 0..1: stream head grows in on start
  let tail = 0; // 0..1: stream falls away after stop
  let streamOn = false;
  const lastFrom = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const impact = new THREE.Vector3();
  let streamReagent = null;

  // Gas tube from the cylinder valve down to the beaker bottom.
  const tube = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.6 }));
  tube.visible = false;
  const lastTubeFrom = new THREE.Vector3(Infinity, 0, 0);

  scene.add(powder.mesh, floc.mesh, bubbles, stream.mesh, drops, tube);

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

  // Volume-weighted optical mix of the liquids added so far.
  const mixTint = new THREE.Color();
  const tmp = new THREE.Color();
  function mixture(snap) {
    let total = 0;
    let milk = 0;
    mixTint.setRGB(0, 0, 0);
    for (const [key, r] of Object.entries(REAGENTS)) {
      if (r.kind !== 'liquid' || !snap.added[key]) continue;
      const vol = snap.added[key] / snap.conc[key];
      total += vol;
      milk += vol * r.milk;
      mixTint.add(tmp.set(r.attenuation).multiplyScalar(vol));
    }
    if (total > 0) mixTint.multiplyScalar(1 / total);
    else mixTint.set('#eef8fb');
    return total > 0 ? milk / total : 0;
  }

  let t = 0;
  return {
    update(snap, dt, pourFrom) {
      const { beaker, volumeL, pouring } = snap;
      t += dt;
      const baseMilk = mixture(snap);
      lab.setLevel(volumeL / BEAKER.maxVolumeL);
      // Gelatinous Al(OH)3 flocs leave the liquid between them fairly clear; CaCO3 powder clouds it.
      const cloud = beaker.turbidity * (beaker.precipitateKind === 'AlOH3' ? 0.12 : 0.8);
      lab.setTurbidity(Math.min(1, baseMilk + cloud), `#${mixTint.getHexString()}`);
      const topY = lab.liquidTopY();

      for (const L of layers) updateLayer(L, beaker.precipitate, beaker.precipitateKind === L.kind, topY, dt, t);

      // Bubbles grow as they rise (lower pressure) and wobble.
      const gasIntoLiquid = pouring === 'CO2' && topY > BEAKER.wall + 0.01;
      if (gasIntoLiquid) bubbleBudget = Math.min(5, bubbleBudget + dt * 80);
      for (let i = 0; i < MAX_BUBBLES; i++) {
        const b = bState[i];
        if (!b.alive && bubbleBudget >= 1) {
          bubbleBudget -= 1;
          b.alive = true;
          b.x = base.x + (Math.random() - 0.5) * 0.02;
          b.z = base.z + (Math.random() - 0.5) * 0.02;
          b.y = BEAKER.wall + 0.03;
          b.v = 0.15 + Math.random() * 0.15;
          b.size = 0.003 + Math.random() * 0.004;
        }
        if (b.alive) {
          b.y += b.v * dt;
          b.x += Math.sin(t * 12 + i) * 0.0015;
          b.z += Math.cos(t * 10 + i) * 0.0015;
          if (b.y >= topY) b.alive = false;
        }
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(b.alive ? b.size * (1 + (b.y - BEAKER.wall) * 2.5) : 0);
        dummy.updateMatrix();
        bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;

      // Liquid stream: a ballistic jet from the bottle mouth to the liquid surface.
      const reagent = pouring ? REAGENTS[pouring] : null;
      const liquidPour = !!(reagent && reagent.kind === 'liquid' && pourFrom);
      if (liquidPour) {
        if (!streamOn) { flow = 0; tail = 0; }
        streamOn = true;
        streamReagent = reagent;
        lastFrom.copy(pourFrom);
        vel.set(base.x - pourFrom.x, 0, base.z - pourFrom.z);
        const d = vel.length();
        vel.multiplyScalar(d > 1e-4 ? Math.min(0.35, d * 3) / d : 0);
        flow = Math.min(1, flow + dt * 8);
      } else if (streamOn) {
        tail = Math.min(1, tail + dt * 6); // the last of the jet keeps falling
        if (tail >= 1) streamOn = false;
      }
      stream.mesh.visible = streamOn;
      let hitting = false;
      if (streamOn) {
        streamMat.attenuationColor.set(streamReagent.attenuation);
        setMilk(streamMat, streamReagent.milk, streamMat.attenuationColor);
        const floorY = base.y + topY;
        impact.copy(stream.update(lastFrom, vel, floorY, flow, tail, 0.0065, t));
        hitting = flow >= 1 && tail === 0;
        if (hitting) dropBudget = Math.min(6, dropBudget + dt * 70);
        dropMat.color.set(streamReagent.attenuation);
      }
      lab.setImpact(hitting ? impact : null);

      for (let i = 0; i < MAX_DROPS; i++) {
        const dp = dState[i];
        if (!dp.alive && dropBudget >= 1) {
          dropBudget -= 1;
          dp.alive = true;
          dp.p.copy(impact);
          const a = Math.random() * Math.PI * 2;
          const s = 0.08 + Math.random() * 0.18;
          dp.v.set(Math.cos(a) * s, 0.35 + Math.random() * 0.45, Math.sin(a) * s);
          dp.size = 0.0018 + Math.random() * 0.003;
        }
        if (dp.alive) {
          dp.v.y -= GRAVITY * dt;
          dp.p.addScaledVector(dp.v, dt);
          if (dp.p.y < base.y + topY && dp.v.y < 0) dp.alive = false;
        }
        dummy.position.copy(dp.p);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(dp.alive ? dp.size : 0);
        dummy.updateMatrix();
        drops.setMatrixAt(i, dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;

      tube.visible = !!(reagent && reagent.kind === 'gas' && pourFrom);
      if (tube.visible) updateTube(pourFrom);
    },
  };
}
