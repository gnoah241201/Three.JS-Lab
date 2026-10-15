import { describe, it, expect, vi } from 'vitest';
import { createPourController, POUR_RATE } from '../src/interact/pour.js';

const fakeStore = () => ({ add: vi.fn(), setPouring: vi.fn() });

describe('pour controller', () => {
  it('does nothing while idle', () => {
    const store = fakeStore();
    const pour = createPourController(store);
    expect(pour.update(1)).toBe(0);
    expect(store.add).not.toHaveBeenCalled();
  });

  it('adds rate × dt while active', () => {
    const store = fakeStore();
    const pour = createPourController(store);
    pour.start('NaOH');
    expect(store.setPouring).toHaveBeenCalledWith('NaOH');
    pour.update(0.05);
    expect(store.add).toHaveBeenCalledWith('NaOH', expect.closeTo(POUR_RATE * 0.05, 12));
  });

  it('pours ×0.1 in slow mode', () => {
    const store = fakeStore();
    const pour = createPourController(store);
    pour.start('CO2');
    pour.update(0.05, true);
    expect(store.add).toHaveBeenCalledWith('CO2', expect.closeTo(POUR_RATE * 0.005, 12));
  });

  it('clamps long frames to 0.1 s', () => {
    const store = fakeStore();
    const pour = createPourController(store);
    pour.start('NaOH');
    pour.update(2);
    expect(store.add).toHaveBeenCalledWith('NaOH', expect.closeTo(POUR_RATE * 0.1, 12));
  });

  it('stop notifies the store once', () => {
    const store = fakeStore();
    const pour = createPourController(store);
    pour.start('NaOH');
    pour.stop();
    pour.stop();
    expect(store.setPouring.mock.calls).toEqual([['NaOH'], [null]]);
    expect(pour.active).toBeNull();
  });
});
