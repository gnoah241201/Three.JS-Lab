// Static data for reagents and scenarios. No logic here except tiny sweep helpers.

export const REAGENTS = {
  NaOH: { label: 'NaOH', kind: 'liquid', color: '#dfeef2', defaultConc: 1.0 },
  CaOH2: { label: 'Ca(OH)₂', kind: 'liquid', color: '#eef0ea', defaultConc: 0.5 },
  AlCl3: { label: 'AlCl₃', kind: 'liquid', color: '#f1ecd6', defaultConc: 1.0 },
  CO2: { label: 'CO₂', kind: 'gas', color: '#ffffff' },
};

export const SPECIES_LABELS = {
  NaOH: 'NaOH',
  Na2CO3: 'Na₂CO₃',
  NaHCO3: 'NaHCO₃',
  CaOH2: 'Ca(OH)₂',
  CaCO3: 'CaCO₃↓',
  CaHCO32: 'Ca(HCO₃)₂',
  AlCl3: 'AlCl₃',
  AlOH3: 'Al(OH)₃↓',
  NaAlOH4: 'Na[Al(OH)₄]',
  NaCl: 'NaCl',
  CO2: 'CO₂ (dư)',
};

export const SCENARIOS = {
  'co2-naoh': {
    id: 'co2-naoh',
    title: 'CO₂ + NaOH',
    reagents: ['NaOH', 'CO2'],
    ratioLabel: 'T = n(OH⁻) / n(CO₂)',
    boundaries: [2, 1],
    chartSeries: ['Na2CO3', 'NaHCO3'],
    sweep: { reagent: 'CO2', fixedReagent: 'NaOH', xAtT: (fixed, T) => fixed / T },
    regions: {
      empty: { label: 'Cốc trống', equations: [] },
      'only-base': { label: 'Chỉ có dung dịch NaOH', equations: [] },
      'only-co2': { label: 'Chỉ có CO₂ hoà tan', equations: [] },
      'excess-base': { label: 'T ≥ 2: muối trung hoà Na₂CO₃ (NaOH dư hoặc vừa đủ)', equations: ['CO₂ + 2NaOH → Na₂CO₃ + H₂O'] },
      mixed: { label: '1 < T < 2: hỗn hợp hai muối Na₂CO₃ + NaHCO₃', equations: ['CO₂ + 2NaOH → Na₂CO₃ + H₂O', 'CO₂ + NaOH → NaHCO₃'] },
      'excess-co2': { label: 'T ≤ 1: muối axit NaHCO₃ (CO₂ dư hoặc vừa đủ)', equations: ['CO₂ + NaOH → NaHCO₃'] },
    },
  },
  'co2-caoh2': {
    id: 'co2-caoh2',
    title: 'CO₂ + Ca(OH)₂',
    reagents: ['CaOH2', 'CO2'],
    ratioLabel: 'T = n(OH⁻) / n(CO₂) = 2·n(Ca(OH)₂) / n(CO₂)',
    boundaries: [2, 1],
    chartSeries: ['CaCO3', 'CaHCO32'],
    sweep: { reagent: 'CO2', fixedReagent: 'CaOH2', xAtT: (fixed, T) => (2 * fixed) / T },
    regions: {
      empty: { label: 'Cốc trống', equations: [] },
      'only-base': { label: 'Chỉ có nước vôi trong Ca(OH)₂', equations: [] },
      'only-co2': { label: 'Chỉ có CO₂ hoà tan', equations: [] },
      'excess-base': { label: 'T ≥ 2: kết tủa trắng CaCO₃ (Ca(OH)₂ dư hoặc vừa đủ)', equations: ['CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O'] },
      mixed: { label: '1 < T < 2: kết tủa tan dần thành Ca(HCO₃)₂', equations: ['CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O', 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂'] },
      'excess-co2': { label: 'T ≤ 1: kết tủa tan hết, dung dịch trong suốt', equations: ['2CO₂ + Ca(OH)₂ → Ca(HCO₃)₂'] },
    },
  },
  'alcl3-naoh': {
    id: 'alcl3-naoh',
    title: 'AlCl₃ + NaOH',
    reagents: ['AlCl3', 'NaOH'],
    ratioLabel: 'T = n(OH⁻) / n(Al³⁺)',
    boundaries: [3, 4],
    chartSeries: ['AlOH3', 'NaAlOH4'],
    sweep: { reagent: 'NaOH', fixedReagent: 'AlCl3', xAtT: (fixed, T) => fixed * T },
    regions: {
      empty: { label: 'Cốc trống', equations: [] },
      'only-base': { label: 'Chỉ có dung dịch NaOH', equations: [] },
      'only-al': { label: 'Chỉ có dung dịch AlCl₃', equations: [] },
      precipitating: { label: 'T ≤ 3: kết tủa keo trắng Al(OH)₃ tăng dần', equations: ['AlCl₃ + 3NaOH → Al(OH)₃↓ + 3NaCl'] },
      dissolving: { label: '3 < T < 4: kết tủa Al(OH)₃ tan dần', equations: ['AlCl₃ + 3NaOH → Al(OH)₃↓ + 3NaCl', 'Al(OH)₃ + NaOH → Na[Al(OH)₄]'] },
      clear: { label: 'T ≥ 4: kết tủa tan hết, tạo Na[Al(OH)₄]', equations: ['AlCl₃ + 4NaOH → Na[Al(OH)₄] + 3NaCl'] },
    },
  },
};
