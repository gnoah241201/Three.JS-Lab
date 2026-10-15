import { describe, it, expect } from 'vitest';
import { sampleCurve, chartRange } from '../src/chem/curve.js';

describe('sampleCurve', () => {
  it('samples AlOH3 over added NaOH', () => {
    const c = sampleCurve('alcl3-naoh', 0.1, 0.5, 5);
    expect(c.reagent).toBe('NaOH');
    expect(c.fixedReagent).toBe('AlCl3');
    expect(c.points.map((p) => p.x)).toEqual([0, 0.125, 0.25, 0.375, 0.5]);
    expect(c.points[2].values.AlOH3).toBeCloseTo(0.25 / 3, 9);
    expect(c.points[3].values.AlOH3).toBeCloseTo(0.025, 9);
    expect(c.points[4].values.AlOH3).toBe(0);
    expect(c.points[4].values.NaAlOH4).toBeCloseTo(0.1, 9);
  });

  it('places T boundary markers', () => {
    const al = sampleCurve('alcl3-naoh', 0.1, 0.5, 5).markers;
    expect(al.map((m) => m.T)).toEqual([3, 4]);
    expect(al[0].x).toBeCloseTo(0.3, 9);
    expect(al[1].x).toBeCloseTo(0.4, 9);

    const co2 = sampleCurve('co2-naoh', 0.2, 0.3, 5).markers;
    expect(co2[0]).toEqual({ T: 2, x: 0.1 });
    expect(co2[1]).toEqual({ T: 1, x: 0.2 });

    const ca = sampleCurve('co2-caoh2', 0.1, 0.3, 5).markers;
    expect(ca[0]).toEqual({ T: 2, x: 0.1 });
    expect(ca[1]).toEqual({ T: 1, x: 0.2 });
  });
});

describe('chartRange', () => {
  it('extends 40% past the last boundary', () => {
    expect(chartRange('alcl3-naoh', 0.1)).toBeCloseTo(0.56, 9);
    expect(chartRange('co2-naoh', 0.2)).toBeCloseTo(0.28, 9);
  });

  it('grows to keep the current point visible', () => {
    expect(chartRange('co2-naoh', 0.2, 0.5)).toBeCloseTo(0.55, 9);
  });
});
