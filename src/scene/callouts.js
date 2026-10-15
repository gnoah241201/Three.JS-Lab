import * as THREE from 'three';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createCallouts(layer, camera, items) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  layer.appendChild(svg);
  const v = new THREE.Vector3();
  let w = 0;
  let h = 0;
  new ResizeObserver(() => { w = layer.clientWidth; h = layer.clientHeight; }).observe(layer);

  const nodes = items.map((item) => {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#2b2420');
    line.setAttribute('stroke-width', '1');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', '#2b2420');
    svg.append(line, dot);

    const label = document.createElement('div');
    label.className = 'callout hidden';
    const title = document.createElement('b');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(item.num);
    title.append(num, item.title);
    label.append(title, item.text);
    layer.appendChild(label);
    return { item, line, dot, label, x: null, y: null, shown: null };
  });

  return {
    update() {
      if (w === 0 || h === 0) return;
      for (const n of nodes) {
        const anchor = n.item.anchor();
        const visible = !!anchor && v.copy(anchor).project(camera).z < 1;
        if (visible !== n.shown) {
          n.shown = visible;
          n.line.style.display = n.dot.style.display = visible ? '' : 'none';
          n.label.classList.toggle('hidden', !visible);
        }
        if (!visible) continue;
        const x = Math.round((v.x * 0.5 + 0.5) * w * 2) / 2;
        const y = Math.round((-v.y * 0.5 + 0.5) * h * 2) / 2;
        if (x === n.x && y === n.y) continue; // nothing moved: skip DOM writes
        n.x = x;
        n.y = y;
        const lx = Math.min(w - 180, Math.max(8, x + n.item.offset[0]));
        const ly = Math.min(h - 48, Math.max(8, y + n.item.offset[1]));
        n.dot.setAttribute('cx', String(x));
        n.dot.setAttribute('cy', String(y));
        n.line.setAttribute('points', `${x},${y} ${lx - 4},${ly + 8}`);
        n.label.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
      }
    },
  };
}
