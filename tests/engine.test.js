import { describe, it, expect } from 'vitest';
import { computeState } from '../src/chem/engine.js';

const near = (actual, expected) => expect(actual).toBeCloseTo(expected, 9);

describe('co2-naoh', () => {
  const run = (NaOH, CO2) => computeState('co2-naoh', { NaOH, CO2 });

  it('T = 4: Na2CO3 with excess NaOH', () => {
    const s = run(0.2, 0.05);
    near(s.T, 4);
    expect(s.region).toBe('excess-base');
    near(s.species.Na2CO3, 0.05);
    near(s.species.NaOH, 0.1);
    expect(s.species.NaHCO3).toBe(0);
  });

  it('T = 2 exactly: only Na2CO3', () => {
    const s = run(0.2, 0.1);
    expect(s.region).toBe('excess-base');
    near(s.species.Na2CO3, 0.1);
    expect(s.species.NaOH).toBe(0);
    expect(s.species.NaHCO3).toBe(0);
  });

  it('1 < T < 2: mixture of two salts', () => {
    const s = run(0.2, 0.15);
    expect(s.region).toBe('mixed');
    near(s.species.Na2CO3, 0.05);
    near(s.species.NaHCO3, 0.1);
    expect(s.equations).toHaveLength(2);
  });

  it('T = 1 exactly: only NaHCO3', () => {
    const s = run(0.2, 0.2);
    expect(s.region).toBe('excess-co2');
    near(s.species.NaHCO3, 0.2);
    expect(s.species.Na2CO3).toBe(0);
    expect(s.species.CO2).toBe(0);
  });

  it('T < 1: NaHCO3 with excess CO2', () => {
    const s = run(0.2, 0.3);
    near(s.species.NaHCO3, 0.2);
    near(s.species.CO2, 0.1);
  });

  it('handles empty and single-reagent beakers', () => {
    expect(run(0, 0).region).toBe('empty');
    expect(run(0, 0).T).toBeNull();
    expect(run(0.1, 0).region).toBe('only-base');
    near(run(0.1, 0).species.NaOH, 0.1);
    expect(run(0, 0.1).region).toBe('only-co2');
    near(run(0, 0.1).species.CO2, 0.1);
  });

  it('never produces a precipitate', () => {
    const s = run(0.2, 0.15);
    expect(s.precipitate).toBe(0);
    expect(s.precipitateKind).toBeNull();
    expect(s.turbidity).toBe(0);
  });

  it('ignores reagents that are not part of the scenario', () => {
    const s = computeState('co2-naoh', { NaOH: 0.2, CO2: 0.1, AlCl3: 5 });
    near(s.species.Na2CO3, 0.1);
    expect(s.species.AlCl3).toBe(0);
  });
});

describe('co2-caoh2', () => {
  const run = (CaOH2, CO2) => computeState('co2-caoh2', { CaOH2, CO2 });

  it('T = 4: CaCO3 precipitate with excess Ca(OH)2', () => {
    const s = run(0.1, 0.05);
    near(s.T, 4);
    expect(s.region).toBe('excess-base');
    near(s.species.CaCO3, 0.05);
    near(s.species.CaOH2, 0.05);
    near(s.precipitate, 0.05);
    expect(s.precipitateKind).toBe('CaCO3');
    near(s.turbidity, 0.5);
  });

  it('T = 2 exactly: maximum precipitate', () => {
    const s = run(0.1, 0.1);
    expect(s.region).toBe('excess-base');
    near(s.species.CaCO3, 0.1);
    expect(s.species.CaOH2).toBe(0);
    near(s.turbidity, 1);
  });

  it('1 < T < 2: precipitate partially dissolves', () => {
    const s = run(0.1, 0.15);
    expect(s.region).toBe('mixed');
    near(s.species.CaCO3, 0.05);
    near(s.species.CaHCO32, 0.05);
  });

  it('T = 1 exactly: precipitate fully dissolved', () => {
    const s = run(0.1, 0.2);
    expect(s.region).toBe('excess-co2');
    near(s.species.CaHCO32, 0.1);
    expect(s.species.CaCO3).toBe(0);
    expect(s.precipitateKind).toBeNull();
    expect(s.turbidity).toBe(0);
  });

  it('T < 1: Ca(HCO3)2 with excess CO2', () => {
    const s = run(0.1, 0.25);
    near(s.species.CaHCO32, 0.1);
    near(s.species.CO2, 0.05);
  });

  it('single reagent', () => {
    expect(run(0.1, 0).region).toBe('only-base');
    near(run(0.1, 0).species.CaOH2, 0.1);
    expect(run(0, 0.1).region).toBe('only-co2');
  });
});

describe('alcl3-naoh', () => {
  const run = (AlCl3, NaOH) => computeState('alcl3-naoh', { AlCl3, NaOH });

  it('T = 1.5: precipitate grows, AlCl3 left over', () => {
    const s = run(0.1, 0.15);
    near(s.T, 1.5);
    expect(s.region).toBe('precipitating');
    near(s.species.AlOH3, 0.05);
    near(s.species.AlCl3, 0.05);
    near(s.species.NaCl, 0.15);
    expect(s.precipitateKind).toBe('AlOH3');
    near(s.turbidity, 0.5);
  });

  it('T = 3 exactly: maximum precipitate', () => {
    const s = run(0.1, 0.3);
    expect(s.region).toBe('precipitating');
    near(s.species.AlOH3, 0.1);
    expect(s.species.AlCl3).toBe(0);
  });

  it('3 < T < 4: precipitate dissolves', () => {
    const s = run(0.1, 0.35);
    expect(s.region).toBe('dissolving');
    near(s.species.AlOH3, 0.05);
    near(s.species.NaAlOH4, 0.05);
    near(s.species.NaCl, 0.3);
  });

  it('T = 4 exactly: clear solution', () => {
    const s = run(0.1, 0.4);
    expect(s.region).toBe('clear');
    expect(s.species.AlOH3).toBe(0);
    near(s.species.NaAlOH4, 0.1);
    expect(s.species.NaOH).toBe(0);
    expect(s.precipitateKind).toBeNull();
  });

  it('T > 4: excess NaOH', () => {
    const s = run(0.1, 0.5);
    near(s.species.NaOH, 0.1);
  });

  it('reverse order (AlCl3 into excess NaOH) gives no precipitate', () => {
    const s = run(0.02, 0.4);
    expect(s.region).toBe('clear');
    expect(s.precipitate).toBe(0);
  });

  it('single reagent', () => {
    expect(run(0.1, 0).region).toBe('only-al');
    near(run(0.1, 0).species.AlCl3, 0.1);
    expect(run(0, 0.1).region).toBe('only-base');
  });
});

describe('input validation', () => {
  it('rejects negative or non-finite amounts', () => {
    expect(() => computeState('co2-naoh', { NaOH: -0.1 })).toThrow(RangeError);
    expect(() => computeState('co2-naoh', { CO2: NaN })).toThrow(RangeError);
  });

  it('rejects unknown scenarios', () => {
    expect(() => computeState('nope', {})).toThrow('Unknown scenario');
  });
});

const SPECIES_ELEMENTS = {
  NaOH: { Na: 1 }, Na2CO3: { Na: 2, C: 1 }, NaHCO3: { Na: 1, C: 1 }, CaOH2: { Ca: 1 },
  CaCO3: { Ca: 1, C: 1 }, CaHCO32: { Ca: 1, C: 2 }, AlCl3: { Al: 1, Cl: 3 }, AlOH3: { Al: 1 },
  NaAlOH4: { Na: 1, Al: 1 }, NaCl: { Na: 1, Cl: 1 }, CO2: { C: 1 },
};
const REAGENT_ELEMENTS = { CO2: { C: 1 }, NaOH: { Na: 1 }, CaOH2: { Ca: 1 }, AlCl3: { Al: 1, Cl: 3 } };

function elementTotals(amounts, table) {
  const t = { Na: 0, C: 0, Ca: 0, Al: 0, Cl: 0 };
  for (const [k, n] of Object.entries(amounts)) {
    for (const [el, count] of Object.entries(table[k] ?? {})) t[el] += n * count;
  }
  return t;
}

function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

describe('element conservation', () => {
  const cases = [
    ['co2-naoh', ['NaOH', 'CO2']],
    ['co2-caoh2', ['CaOH2', 'CO2']],
    ['alcl3-naoh', ['AlCl3', 'NaOH']],
  ];
  for (const [id, reagents] of cases) {
    it(`conserves Na, C, Ca, Al, Cl in ${id}`, () => {
      const rand = lcg(42);
      for (let i = 0; i < 200; i++) {
        const added = Object.fromEntries(reagents.map((r) => [r, Math.round(rand() * 500) / 1000]));
        const { species } = computeState(id, added);
        const before = elementTotals(added, REAGENT_ELEMENTS);
        const after = elementTotals(species, SPECIES_ELEMENTS);
        for (const el of Object.keys(before)) expect(after[el]).toBeCloseTo(before[el], 9);
      }
    });
  }
});
