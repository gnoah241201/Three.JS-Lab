import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/state.js';

describe('store', () => {
  it('starts empty on co2-naoh', () => {
    const s = createStore().get();
    expect(s.scenarioId).toBe('co2-naoh');
    expect(s.added).toEqual({ CO2: 0, NaOH: 0, CaOH2: 0, AlCl3: 0 });
    expect(s.beaker.region).toBe('empty');
    expect(s.pouring).toBeNull();
  });

  it('adds reagents and recomputes the beaker', () => {
    const store = createStore();
    store.add('NaOH', 0.2);
    store.add('CO2', 0.1);
    expect(store.get().beaker.species.Na2CO3).toBeCloseTo(0.1, 9);
  });

  it('is independent of pouring order', () => {
    const a = createStore('alcl3-naoh');
    a.add('AlCl3', 0.1); a.add('NaOH', 0.2); a.add('NaOH', 0.15);
    const b = createStore('alcl3-naoh');
    b.add('NaOH', 0.35); b.add('AlCl3', 0.1);
    for (const [k, v] of Object.entries(a.get().beaker.species)) {
      expect(b.get().beaker.species[k]).toBeCloseTo(v, 9);
    }
  });

  it('rejects reagents outside the scenario', () => {
    expect(() => createStore('co2-naoh').add('AlCl3', 0.1)).toThrow();
  });

  it('never goes below zero', () => {
    const store = createStore();
    store.add('NaOH', 0.05);
    store.add('NaOH', -0.2);
    expect(store.get().added.NaOH).toBe(0);
    store.set('NaOH', -1);
    expect(store.get().added.NaOH).toBe(0);
  });

  it('computes liquid volume from concentrations (gas adds none)', () => {
    const store = createStore();
    store.add('NaOH', 0.2);
    store.add('CO2', 0.1);
    expect(store.get().volumeL).toBeCloseTo(0.2, 9);
    store.setConc('NaOH', 2);
    expect(store.get().volumeL).toBeCloseTo(0.1, 9);
    expect(() => store.setConc('NaOH', 0)).toThrow(RangeError);
  });

  it('setScenario clears added amounts but keeps concentrations', () => {
    const store = createStore();
    store.setConc('NaOH', 2);
    store.add('NaOH', 0.1);
    store.setScenario('alcl3-naoh');
    const s = store.get();
    expect(s.scenarioId).toBe('alcl3-naoh');
    expect(s.added.NaOH).toBe(0);
    expect(s.conc.NaOH).toBe(2);
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const store = createStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.setPouring('CO2');
    expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ pouring: 'CO2' }));
    off();
    store.reset();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.get().pouring).toBeNull();
  });
});
