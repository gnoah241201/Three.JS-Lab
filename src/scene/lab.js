import * as THREE from 'three';
import { isHeadless } from './setup.js';
import { createLiquidMaterial, createSurfaceMaterial, setMilk } from './liquid.js';

export const BEAKER = {
  position: new THREE.Vector3(0, 0, 0.2),
  radius: 0.19,
  height: 0.46,
  wall: 0.008,
  maxVolumeL: 1.0,
};

// Real glass is mostly invisible: what you see is its reflection (strong at grazing angles)
// plus a faint green-grey body tint. Two layers model that: a dim tinted body, and an
// additive layer that contributes reflection only (black diffuse → fresnel comes for free).
export function createGlass(geometry, { tint = '#e8f2ee', bodyOpacity = 0.035 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    color: tint, transparent: true, opacity: bodyOpacity, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide,
  }));
  // FrontSide only: with DoubleSide the inner and outer walls both add reflection and the
  // glass blows out to white. No clearcoat either (it would be a second specular layer).
  const reflection = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    color: '#000000', roughness: 0.05, metalness: 0, specularIntensity: 0.6, ior: 1.52,
    envMapIntensity: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  body.renderOrder = 3;
  reflection.renderOrder = 4;
  group.add(body, reflection);
  return group;
}

export function createLab(scene) {
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.08, 1.7),
    new THREE.MeshStandardMaterial({ color: '#8a6446', roughness: 0.7 }),
  );
  bench.position.y = -0.04;
  bench.receiveShadow = !isHeadless;

  const riser = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.06, 0.36),
    new THREE.MeshStandardMaterial({ color: '#5e4330', roughness: 0.75 }),
  );
  riser.position.set(0, 0.03, -0.5);
  riser.castShadow = !isHeadless;
  riser.receiveShadow = !isHeadless;

  const { radius: r, height: h, wall } = BEAKER;
  // Closed lathe profile with real wall thickness, a rounded lip and a thick base.
  const profile = [
    [0, 0], [r - 0.01, 0], [r, 0.01], [r, h], [r + 0.004, h + 0.006], [r + 0.012, h + 0.01],
    [r - wall + 0.002, h + 0.004], [r - wall, h], [r - wall, wall + 0.012], [r - wall - 0.012, wall], [0, wall],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = createGlass(new THREE.LatheGeometry(profile, 96));

  // Graduation marks (white enamel, as printed on lab beakers).
  const marks = new THREE.Group();
  const markMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 });
  for (let i = 1; i <= 8; i++) {
    const long = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(long ? 0.05 : 0.028, 0.0035), markMat);
    m.position.set(-r * 0.62 - (long ? 0 : 0.011), wall + (i / 9) * (h - 0.05), r * 0.79 + 0.001);
    m.rotation.y = -0.66;
    m.renderOrder = 5;
    marks.add(m);
  }

  const innerR = r - wall - 0.001;
  const liquidMaterial = createLiquidMaterial({ thickness: innerR * 2 });
  const liquidGeometry = new THREE.CylinderGeometry(innerR, innerR, 1, 64, 1, true);
  liquidGeometry.translate(0, 0.5, 0); // origin at the bottom so scale.y = height
  const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
  liquid.position.y = wall;
  liquid.visible = false;

  const surfaceMaterial = createLiquidMaterial({ thickness: 0.05 });
  const surfaceUniforms = createSurfaceMaterial(surfaceMaterial);
  surfaceUniforms.uRadius.value = innerR;
  const surface = new THREE.Mesh(new THREE.RingGeometry(0.0005, innerR, 72, 24).rotateX(-Math.PI / 2), surfaceMaterial);
  surface.visible = false;

  const beaker = new THREE.Group();
  beaker.position.copy(BEAKER.position);
  beaker.add(liquid, surface, glass, marks);
  scene.add(bench, riser, beaker);

  const targetTint = new THREE.Color('#eaf6fa');
  const tint = new THREE.Color('#eaf6fa');
  const maxLiquidHeight = h - wall - 0.03;
  let level = 0;
  let targetLevel = 0;
  let turbidity = 0;
  let targetTurbidity = 0;
  let ripple = 0;

  function applyLevel() {
    const vis = level > 0.001;
    liquid.visible = surface.visible = vis;
    const height = Math.max(0.001, level * maxLiquidHeight);
    liquid.scale.y = height;
    surface.position.y = wall + height;
  }

  return {
    beaker,
    mouth: BEAKER.position.clone().setY(h),
    liquidTopY() {
      return liquid.visible ? wall + liquid.scale.y : wall;
    },
    setLevel(fraction) {
      targetLevel = Math.min(1, Math.max(0, fraction));
      if (targetLevel < level - 0.05) { level = targetLevel; applyLevel(); } // reset: snap down
    },
    // t: 0 clear → 1 milky; color: attenuation tint of the mixture.
    setTurbidity(t, color = '#eaf6fa') {
      targetTurbidity = t;
      targetTint.set(color);
    },
    // Where the stream hits the surface (world xz); null when not pouring.
    setImpact(worldPoint) {
      if (worldPoint) surfaceUniforms.uImpact.value.set(worldPoint.x - BEAKER.position.x, worldPoint.z - BEAKER.position.z);
      ripple = worldPoint ? 1 : 0;
    },
    update(dt, agitated) {
      const k = 1 - Math.exp(-dt * 6);
      level += (targetLevel - level) * k;
      turbidity += (targetTurbidity - turbidity) * (1 - Math.exp(-dt * 2.5));
      applyLevel();
      tint.lerp(targetTint, k);
      for (const m of [liquidMaterial, surfaceMaterial]) {
        m.attenuationColor.copy(tint);
        setMilk(m, turbidity, tint);
      }
      const u = surfaceUniforms;
      u.uTime.value += dt;
      u.uRipple.value += ((ripple ? 0.0022 : 0) - u.uRipple.value) * (1 - Math.exp(-dt * 4));
      u.uSlosh.value += ((agitated ? 0.0012 : 0.0003) - u.uSlosh.value) * (1 - Math.exp(-dt * 2));
    },
  };
}
