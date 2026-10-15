export const POUR_RATE = 0.02; // mol/s
const MAX_DT = 0.1; // ignore long frames (tab switch) so a hiccup never dumps reagent

export function createPourController(store, { rate = POUR_RATE, slowFactor = 0.1 } = {}) {
  let active = null;
  return {
    get active() { return active; },
    start(key) {
      if (active === key) return;
      active = key;
      store.setPouring(key);
    },
    stop() {
      if (active === null) return;
      active = null;
      store.setPouring(null);
    },
    update(dt, slow = false) {
      if (active === null || dt <= 0) return 0;
      const mol = rate * (slow ? slowFactor : 1) * Math.min(dt, MAX_DT);
      store.add(active, mol);
      return mol;
    },
  };
}
