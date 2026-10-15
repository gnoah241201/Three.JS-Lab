import * as THREE from 'three';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createCallouts(layer, camera, items) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  layer.appendChild(svg);
  const v = new THREE.Vector3();

  const nodes = items.map((item) => {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#2b2420');
    line.setAttribute('stroke-width', '0.8');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', '#2b2420');
    svg.append(line, dot);

    const label = document.createElement('div');
    label.className = 'callout';
    const title = document.createElement('b');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(item.num);
    title.append(num, item.title);
    label.append(title, item.text);
    layer.appendChild(label);
    return { item, line, dot, label };
  });

  return {
    update() {
      const w = layer.clientWidth;
      const h = layer.clientHeight;
      if (w === 0 || h === 0) return;
      for (const n of nodes) {
        const anchor = n.item.anchor();
        const visible = !!anchor && v.copy(anchor).project(camera).z < 1;
        n.line.style.display = n.dot.style.display = n.label.style.display = visible ? '' : 'none';
        if (!visible) continue;
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        const lx = Math.min(w - 180, Math.max(8, x + n.item.offset[0]));
        const ly = Math.min(h - 48, Math.max(8, y + n.item.offset[1]));
        n.dot.setAttribute('cx', String(x));
        n.dot.setAttribute('cy', String(y));
        n.line.setAttribute('points', `${x},${y} ${lx - 4},${ly + 8}`);
        n.label.style.left = `${lx}px`;
        n.label.style.top = `${ly}px`;
      }
    },
  };
}
