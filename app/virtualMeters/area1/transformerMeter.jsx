export function createTransformerMeter(
  transformerId = "TR-AREA-1",
  capacityKVA = 100
) {
  let cumulativeEnergyWh = 0;

  return function generateReading(totalHousesPowerW = 0, lossPercent = 5) {
    // Dynamic technical loss factor based on configured loss percentage (default 5%)
    const validLoss = typeof lossPercent === "number" && !isNaN(lossPercent) ? lossPercent : 5;
    const LOSS_FACTOR = 1 + validLoss / 100;
    const powerW = totalHousesPowerW * LOSS_FACTOR;

    const voltageV = 415 + (Math.random() - 0.5) * 4; // ~413V to 417V (3-phase DT voltage)
    const powerFactor = 0.93;

    const currentA = powerW > 0 ? powerW / (Math.sqrt(3) * voltageV * powerFactor) : 0;

    const energyWh = powerW / 3600;
    cumulativeEnergyWh += energyWh;

    return {
      transformerId,
      category: "DISTRIBUTION_TRANSFORMER",
      timestamp: new Date().toISOString(),
      voltageV: Number(voltageV.toFixed(1)),
      currentA: Number(currentA.toFixed(1)),
      powerW: Number(powerW.toFixed(2)),
      powerFactor,
      energyWh: Number(energyWh.toFixed(5)),
      cumulativeEnergyWh: Number(cumulativeEnergyWh.toFixed(5)),
      meterStatus: "NORMAL",
    };
  };
}