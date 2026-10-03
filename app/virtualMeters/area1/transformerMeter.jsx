export function createTransformerMeter(
  transformerId = "TR-AREA-1",
  capacityKVA = 100
) {
  let cumulativeEnergyWh = 0;

  return function generateReading(totalHousesPowerW = 0) {
    // Technical loss factor: ~5% loss in transformer & line distribution
    const LOSS_FACTOR = 1.05;
    const powerW = totalHousesPowerW * LOSS_FACTOR;

    const voltageV = 230 + (Math.random() - 0.5) * 2; // ~229V to 231V
    const powerFactor = 0.98;

    const currentA = powerW > 0 ? powerW / (voltageV * powerFactor) : 0;

    const energyWh = powerW / 3600;
    cumulativeEnergyWh += energyWh;

    return {
      transformerId,
      category: "DISTRIBUTION_TRANSFORMER",
      timestamp: new Date().toISOString(),
      voltageV: Number(voltageV.toFixed(2)),
      currentA: Number(currentA.toFixed(3)),
      powerW: Number(powerW.toFixed(2)),
      powerFactor,
      energyWh: Number(energyWh.toFixed(5)),
      cumulativeEnergyWh: Number(cumulativeEnergyWh.toFixed(5)),
      meterStatus: "NORMAL",
    };
  };
}