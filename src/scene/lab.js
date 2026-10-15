import * as THREE from 'three';

export const BEAKER = {
  position: new THREE.Vector3(0, 0, 0.15),
  radius: 0.24,
  height: 0.55,
  wall: 0.008,
  maxVolumeL: 1.0,
};

export function createLab(scene) {
  const isHeadless = typeof navigator !== 'undefined' && (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.08, 1.6),
    new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.75 }),
  );
  bench.position.y = -0.04;
  bench.receiveShadow = !isHeadless;

  const riser = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.06, 0.4),
    new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.8 }),
  );
  riser.position.set(0, 0.03, -0.5);
  riser.castShadow = !isHeadless;
  riser.receiveShadow = !isHeadless;

  const { radius: r, height: h, wall } = BEAKER;
  const profile = [
    [0, 0], [r, 0], [r, h], [r + 0.014, h + 0.012], [r - wall, h], [r - wall, wall], [0, wall],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  // depthWrite off so the transparent liquid inside is not hidden by the front wall.
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 64),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.04, thickness: 0.02, ior: 1.5, depthWrite: false }),
  );
  glass.castShadow = !isHeadless;

  const liquidMaterial = new THREE.MeshStandardMaterial({ color: '#d6ecf3', transparent: true, opacity: 0.5, roughness: 0.15, depthWrite: false });
  const liquidGeometry = new THREE.CylinderGeometry(r - wall - 0.002, r - wall - 0.002, 1, 48);
  liquidGeometry.translate(0, 0.5, 0); // origin at the bottom so scale.y = height
  const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
  liquid.position.y = wall;
  liquid.visible = false;

  const beaker = new THREE.Group();
  beaker.position.copy(BEAKER.position);
  beaker.add(glass, liquid);
  scene.add(bench, riser, beaker);

  const baseColor = new THREE.Color();
  const milky = new THREE.Color('#f4f2ec');
  const maxLiquidHeight = h - wall - 0.03;

  return {
    beaker,
    mouth: BEAKER.position.clone().setY(h),
    liquidTopY() {
      return liquid.visible ? wall + liquid.scale.y : wall;
    },
    setLevel(fraction) {
      const f = Math.min(1, Math.max(0, fraction));
      liquid.visible = f > 0.001;
      liquid.scale.y = Math.max(0.001, f * maxLiquidHeight);
    },
    setTurbidity(t, color = '#d6ecf3') {
      liquidMaterial.color.copy(baseColor.set(color)).lerp(milky, t);
      liquidMaterial.opacity = 0.5 + 0.45 * t;
    },
  };
}
