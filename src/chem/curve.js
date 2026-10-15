import { SCENARIOS } from './scenarios.js';
import { computeState } from './engine.js';

function scenarioOrThrow(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  return scenario;
}

// X-axis maximum: 40% past the furthest T boundary, or 10% past the current point.
export function chartRange(scenarioId, fixedMol, currentX = 0) {
  const { sweep, boundaries } = scenarioOrThrow(scenarioId);
  const xEnd = Math.max(...boundaries.map((T) => sweep.xAtT(fixedMol, T)));
  return Math.max(xEnd * 1.4, currentX * 1.1);
}

// Product amounts while sweeping the scenario's sweep reagent from 0 to xMax.
export function sampleCurve(scenarioId, fixedMol, xMax, n = 120) {
  const scenario = scenarioOrThrow(scenarioId);
  const { reagent, fixedReagent, xAtT } = scenario.sweep;
  const points = [];
  for (let i = 0; i < n; i++) {
    const x = (xMax * i) / (n - 1);
    const { species } = computeState(scenarioId, { [fixedReagent]: fixedMol, [reagent]: x });
    points.push({ x, values: Object.fromEntries(scenario.chartSeries.map((k) => [k, species[k]])) });
  }
  const markers = scenario.boundaries.map((T) => ({ T, x: xAtT(fixedMol, T) }));
  return { reagent, fixedReagent, points, markers };
}
