import * as THREE from 'three';
import { isHeadless } from './setup.js';

export const BEAKER = {
  position: new THREE.Vector3(0, 0, 0.2),
  radius: 0.19,
  height: 0.46,
  wall: 0.008,
  maxVolumeL: 1.0,
};

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
  const profile = [
    [0, 0], [r, 0], [r, h], [r + 0.012, h + 0.01], [r - wall, h], [r - wall, wall], [0, wall],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  // Plain transparent glass instead of `transmission`: transmission re-renders the whole
  // scene every frame and refracts the bench into a confusing smear behind the beaker.
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 72),
    new THREE.MeshPhysicalMaterial({
      color: '#f4fbff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  glass.renderOrder = 2;

  // Graduation marks make the level readable at a glance.
  const marks = new THREE.Group();
  const markMat = new THREE.MeshBasicMaterial({ color: '#3a4a52', transparent: true, opacity: 0.55 });
  for (let i = 1; i <= 8; i++) {
    const long = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(long ? 0.05 : 0.028, 0.0035), markMat);
    m.position.set(-r * 0.62 - (long ? 0 : 0.011), wall + (i / 9) * (h - 0.05), r * 0.79 + 0.001);
    m.rotation.y = -0.66;
    marks.add(m);
  }

  const innerR = r - wall - 0.002;
  const liquidMaterial = new THREE.MeshPhysicalMaterial({
    color: '#cfe8f2', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false,
  });
  const liquidGeometry = new THREE.CylinderGeometry(innerR, innerR, 1, 56, 1, true);
  liquidGeometry.translate(0, 0.5, 0); // origin at the bottom so scale.y = height
  const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
  liquid.position.y = wall;
  liquid.visible = false;
  liquid.renderOrder = 1;

  // Separate top surface: a little brighter so the meniscus reads clearly.
  const surfaceMaterial = new THREE.MeshPhysicalMaterial({
    color: '#e4f3f8', transparent: true, opacity: 0.7, roughness: 0.05, clearcoat: 1, depthWrite: false,
  });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(innerR, 56).rotateX(-Math.PI / 2), surfaceMaterial);
  surface.visible = false;
  surface.renderOrder = 1;

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.25, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.12, depthWrite: false }),
  );
  shadowDisc.position.y = 0.001;

  const beaker = new THREE.Group();
  beaker.position.copy(BEAKER.position);
  beaker.add(shadowDisc, liquid, surface, glass, marks);
  scene.add(bench, riser, beaker);

  const targetColor = new THREE.Color('#cfe8f2');
  const milky = new THREE.Color('#f4f2ec');
  const tint = new THREE.Color('#cfe8f2');
  const shown = new THREE.Color();
  const maxLiquidHeight = h - wall - 0.03;
  let level = 0;
  let targetLevel = 0;
  let turbidity = 0;
  let targetTurbidity = 0;
  let time = 0;

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
      // Snap down instantly on reset; rise smoothly while pouring.
      if (targetLevel < level - 0.05) { level = targetLevel; applyLevel(); }
    },
    setTurbidity(t, color = '#cfe8f2') {
      targetTurbidity = t;
      targetColor.set(color);
    },
    update(dt, agitated) {
      time += dt;
      const k = 1 - Math.exp(-dt * 6);
      level += (targetLevel - level) * k;
      turbidity += (targetTurbidity - turbidity) * (1 - Math.exp(-dt * 2.5));
      applyLevel();
      tint.lerp(targetColor, k);
      shown.copy(tint).lerp(milky, turbidity);
      liquidMaterial.color.copy(shown);
      liquidMaterial.opacity = 0.5 + 0.42 * turbidity;
      surfaceMaterial.color.copy(shown).lerp(milky, 0.25);
      surfaceMaterial.opacity = 0.6 + 0.35 * turbidity;
      // Gentle wobble on the surface while something is being poured.
      const wobble = agitated ? 0.035 : 0;
      surface.rotation.x = Math.sin(time * 9) * wobble * 0.3;
      surface.rotation.z = Math.cos(time * 7) * wobble * 0.3;
    },
  };
}
