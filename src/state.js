import { computeState } from './chem/engine.js';
import { SCENARIOS, REAGENTS } from './chem/scenarios.js';

const zero = () => ({ CO2: 0, NaOH: 0, CaOH2: 0, AlCl3: 0 });

export function createStore(initialScenario = 'co2-naoh') {
  let scenarioId = initialScenario;
  let added = zero();
  let pouring = null;
  let snapshot = null;
  const conc = Object.fromEntries(
    Object.entries(REAGENTS).filter(([, r]) => r.kind === 'liquid').map(([k, r]) => [k, r.defaultConc]),
  );
  const listeners = new Set();

  function assertReagent(key) {
    if (!SCENARIOS[scenarioId].reagents.includes(key)) throw new Error(`${key} is not used in ${scenarioId}`);
  }

  function volumeL() {
    return Object.entries(conc).reduce((v, [k, c]) => v + added[k] / c, 0);
  }

  function emit() {
    snapshot = {
      scenarioId,
      added: { ...added },
      conc: { ...conc },
      pouring,
      volumeL: volumeL(),
      beaker: computeState(scenarioId, added),
    };
    for (const fn of listeners) fn(snapshot);
  }

  emit();

  return {
    get: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    add(key, mol) { assertReagent(key); added[key] = Math.max(0, added[key] + mol); emit(); },
    set(key, mol) { assertReagent(key); added[key] = Math.max(0, mol); emit(); },
    setConc(key, molPerL) {
      if (!(key in conc) || !(molPerL > 0)) throw new RangeError(`Invalid concentration for ${key}: ${molPerL}`);
      conc[key] = molPerL;
      emit();
    },
    setPouring(key) { if (key !== null) assertReagent(key); pouring = key; emit(); },
    reset() { added = zero(); pouring = null; emit(); },
    setScenario(id) {
      if (!SCENARIOS[id]) throw new Error(`Unknown scenario: ${id}`);
      scenarioId = id;
      added = zero();
      pouring = null;
      emit();
    },
  };
}
