import { SCENARIOS } from './scenarios.js';

export const EPS = 1e-9;
export const REAGENT_KEYS = ['CO2', 'NaOH', 'CaOH2', 'AlCl3'];
export const SPECIES_KEYS = ['NaOH', 'Na2CO3', 'NaHCO3', 'CaOH2', 'CaCO3', 'CaHCO32', 'AlCl3', 'AlOH3', 'NaAlOH4', 'NaCl', 'CO2'];

const LIQUID_COLOR = '#d6ecf3';

function readAdded(added) {
  const out = {};
  for (const key of REAGENT_KEYS) {
    const v = added?.[key] ?? 0;
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`Invalid amount for ${key}: ${v}`);
    out[key] = v < EPS ? 0 : v;
  }
  return out;
}

function emptySpecies() {
  return Object.fromEntries(SPECIES_KEYS.map((k) => [k, 0]));
}

// Clamp float noise: anything below EPS (including tiny negatives) becomes exactly 0.
function clean(species) {
  for (const k of SPECIES_KEYS) if (species[k] < EPS) species[k] = 0;
  return species;
}

// CO2 into NaOH. T = n(OH-)/n(CO2) = a/c.
function co2Naoh({ NaOH: a, CO2: c }) {
  const s = emptySpecies();
  let T = null;
  let region;
  if (a === 0 && c === 0) region = 'empty';
  else if (c === 0) { region = 'only-base'; s.NaOH = a; }
  else if (a === 0) { region = 'only-co2'; s.CO2 = c; }
  else {
    T = a / c;
    if (T >= 2 - EPS) { region = 'excess-base'; s.Na2CO3 = c; s.NaOH = a - 2 * c; }
    else if (T > 1 + EPS) { region = 'mixed'; s.Na2CO3 = a - c; s.NaHCO3 = 2 * c - a; }
    else { region = 'excess-co2'; s.NaHCO3 = a; s.CO2 = c - a; }
  }
  return { T, region, species: s, precipitateKey: null, precipitateRef: 0 };
}

// CO2 into Ca(OH)2. T = n(OH-)/n(CO2) = 2b/c.
function co2CaOH2({ CaOH2: b, CO2: c }) {
  const s = emptySpecies();
  let T = null;
  let region;
  if (b === 0 && c === 0) region = 'empty';
  else if (c === 0) { region = 'only-base'; s.CaOH2 = b; }
  else if (b === 0) { region = 'only-co2'; s.CO2 = c; }
  else {
    T = (2 * b) / c;
    if (T >= 2 - EPS) { region = 'excess-base'; s.CaCO3 = c; s.CaOH2 = b - c; }
    else if (T > 1 + EPS) { region = 'mixed'; s.CaCO3 = 2 * b - c; s.CaHCO32 = c - b; }
    else { region = 'excess-co2'; s.CaHCO32 = b; s.CO2 = c - 2 * b; }
  }
  return { T, region, species: s, precipitateKey: 'CaCO3', precipitateRef: b };
}

// NaOH and AlCl3 in any order. T = n(OH-)/n(Al3+) = a/m.
function alcl3Naoh({ AlCl3: m, NaOH: a }) {
  const s = emptySpecies();
  let T = null;
  let region;
  if (m === 0 && a === 0) region = 'empty';
  else if (m === 0) { region = 'only-base'; s.NaOH = a; }
  else if (a === 0) { region = 'only-al'; s.AlCl3 = m; }
  else {
    T = a / m;
    if (T <= 3 + EPS) { region = 'precipitating'; s.AlOH3 = a / 3; s.AlCl3 = m - a / 3; s.NaCl = a; }
    else if (T < 4 - EPS) { region = 'dissolving'; s.AlOH3 = 4 * m - a; s.NaAlOH4 = a - 3 * m; s.NaCl = 3 * m; }
    else { region = 'clear'; s.NaAlOH4 = m; s.NaOH = a - 4 * m; s.NaCl = 3 * m; }
  }
  return { T, region, species: s, precipitateKey: 'AlOH3', precipitateRef: m };
}

const SOLVERS = {
  'co2-naoh': co2Naoh,
  'co2-caoh2': co2CaOH2,
  'alcl3-naoh': alcl3Naoh,
};

export function computeState(scenarioId, added) {
  const scenario = SCENARIOS[scenarioId];
  const solve = SOLVERS[scenarioId];
  if (!scenario || !solve) throw new Error(`Unknown scenario: ${scenarioId}`);
  const { T, region, species, precipitateKey, precipitateRef } = solve(readAdded(added));
  clean(species);
  const precipitate = precipitateKey ? species[precipitateKey] : 0;
  return {
    T,
    region,
    species,
    precipitate,
    precipitateKind: precipitate > 0 ? precipitateKey : null,
    turbidity: precipitateRef > 0 ? Math.min(1, precipitate / precipitateRef) : 0,
    liquidColor: LIQUID_COLOR,
    equations: scenario.regions[region].equations,
  };
}
