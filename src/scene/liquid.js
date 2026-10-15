import * as THREE from 'three';

// Aqueous solution: water-like refraction (ior 1.333), faint volume absorption and a mirror-like
// surface. Turbidity models suspended solids scattering light (clear -> milky), not a gel.
export function createLiquidMaterial({ color = '#ffffff', attenuation = '#e9f6fb', milk = 0, thickness = 0.3 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    transmission: 1,
    thickness,
    ior: 1.333,
    roughness: 0.0,
    metalness: 0,
    specularIntensity: 1,
    attenuationColor: new THREE.Color(attenuation),
    attenuationDistance: 0.8,
    envMapIntensity: 1.3,
  });
  setMilk(m, milk);
  return m;
}

const MILK = new THREE.Color('#f6f3ec');

// 0 = crystal clear, 1 = opaque milky suspension.
export function setMilk(m, t, tint = null) {
  // Suspended particles: light is scattered, so less passes straight through and the
  // refracted image blurs. The surface itself stays glossy (it is still water).
  m.transmission = 1 - 0.8 * t;
  m.roughness = 0.2 * t;
  m.attenuationDistance = 0.8 * (1 - t) + 0.03 * t;
  if (tint) m.color.copy(tint).lerp(MILK, t * 0.9);
}

// Surface with analytic waves: idle slosh + concentric ripples from a moving impact point.
export function createSurfaceMaterial(base) {
  const uniforms = {
    uTime: { value: 0 },
    uImpact: { value: new THREE.Vector2(0, 0) },
    uRipple: { value: 0 },
    uSlosh: { value: 0.002 },
    uRadius: { value: 0.18 },
  };
  base.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec2 uImpact; uniform float uRipple; uniform float uSlosh; uniform float uRadius;
        float liquidH(vec2 p) {
          float edge = 1.0 - smoothstep(0.75 * uRadius, uRadius, length(p));
          float d = length(p - uImpact);
          float ripple = uRipple * sin(d * 120.0 - uTime * 16.0) * exp(-d * 14.0);
          float slosh = uSlosh * (sin(p.x * 30.0 + uTime * 2.1) + cos(p.y * 26.0 - uTime * 1.7));
          return (ripple + slosh) * edge;
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec2 lp = position.xz;
        float e = 0.002;
        float hx = liquidH(lp + vec2(e, 0.0)) - liquidH(lp - vec2(e, 0.0));
        float hz = liquidH(lp + vec2(0.0, e)) - liquidH(lp - vec2(0.0, e));
        vec3 objectNormal = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
        transformed.y += liquidH(position.xz);`);
  };
  base.customProgramCacheKey = () => 'liquid-surface';
  return uniforms;
}

// A falling stream as a tube that follows a ballistic arc, rebuilt in place every frame
// (no allocations). Radius narrows as the jet speeds up, with a little wobble.
export function createStream(material, { segments = 36, radial = 12 } = {}) {
  const verts = (segments + 1) * (radial + 1);
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const idx = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.visible = false;

  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();
  const side = new THREE.Vector3(0, 0, 1);
  const G = 9.8;

  return {
    mesh,
    // from: mouth position; vel: initial velocity; floorY: where the jet ends.
    // head/tail in [0,1] trim the arc so the stream can grow in and fall away.
    update(from, vel, floorY, head, tail, r0, time) {
      // Solve from.y + vel.y t - G t^2 / 2 = floorY
      const dy = from.y - floorY;
      const tEnd = (vel.y + Math.sqrt(Math.max(0, vel.y * vel.y + 2 * G * dy))) / G;
      const speed0 = Math.max(0.05, vel.length());
      const t0 = tEnd * tail;
      const t1 = tEnd * head;
      side.set(-vel.z, 0, vel.x);
      if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
      side.normalize();
      for (let i = 0; i <= segments; i++) {
        const t = t0 + (t1 - t0) * (i / segments);
        p.set(from.x + vel.x * t, from.y + vel.y * t - 0.5 * G * t * t, from.z + vel.z * t);
        tan.set(vel.x, vel.y - G * t, vel.z);
        const speed = tan.length();
        tan.divideScalar(speed);
        n1.crossVectors(tan, side).normalize();
        n2.crossVectors(tan, n1).normalize();
        const wobble = 1 + 0.18 * Math.sin(time * 31 - t * 140) + 0.08 * Math.sin(time * 17 + t * 90);
        const taperEnds = Math.min(1, (i / segments) * 12, ((segments - i) / segments) * 30 + 0.25);
        const r = r0 * Math.sqrt(speed0 / speed) * wobble * taperEnds;
        for (let j = 0; j <= radial; j++) {
          const a = (j / radial) * Math.PI * 2;
          const c = Math.cos(a);
          const s = Math.sin(a);
          const k = (i * (radial + 1) + j) * 3;
          const nx = n1.x * c + n2.x * s;
          const ny = n1.y * c + n2.y * s;
          const nz = n1.z * c + n2.z * s;
          nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
          pos[k] = p.x + nx * r; pos[k + 1] = p.y + ny * r; pos[k + 2] = p.z + nz * r;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      return p; // last point = impact
    },
  };
}
