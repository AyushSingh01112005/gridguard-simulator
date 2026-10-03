export function createHouseMeter(
  consumerId,
  meterId,
  sanctionedLoadW = 5000
) {
  let cumulativeEnergyWh = 0;

  // 400 kWh over 30 days = 400,000 Wh / (30 * 24 h) = ~555.56 W average load
  const TARGET_AVG_LOAD_W = 555.56;

  return function generateReading(loadW = TARGET_AVG_LOAD_W, isCut = false, reductionPercent = 0) {
    if (isCut) {
      return {
        consumerId,
        meterId,
        category: "RESIDENTIAL",
        timestamp: new Date().toISOString(),
        voltageV: 0,
        currentA: 0,
        powerW: 0,
        actualPowerW: 0,
        powerFactor: 0.95,
        energyWh: 0,
        cumulativeEnergyWh: Number(cumulativeEnergyWh.toFixed(5)),
        meterStatus: "POWER CUT",
        reductionPercent: 0,
      };
    }

    const actualPowerW = Math.max(0, Math.min(loadW, sanctionedLoadW));
    
    // Reduction factor (e.g. 50% less power recorded = factor 0.50)
    const validReduction = [0, 50, 60, 80].includes(reductionPercent) ? reductionPercent : 0;
    const factor = (100 - validReduction) / 100;
    const recordedPowerW = actualPowerW * factor;

    // Low deviation voltage: ~229.8V to 230.2V
    const voltageV = 230 + (Math.random() - 0.5) * 0.4;
    const powerFactor = 0.95;

    // Calculate current smoothly based on recorded power
    const currentA = recordedPowerW > 0 
      ? recordedPowerW / (voltageV * powerFactor) 
      : 0;

    // Energy consumed in 1 second (Wh)
    const energyWh = recordedPowerW / 3600;
    cumulativeEnergyWh += energyWh;

    let meterStatus = "NORMAL";
    if (validReduction > 0) {
      meterStatus = `TAMPERED (${validReduction}% LESS POWER)`;
    }

    return {
      consumerId,
      meterId,
      category: "RESIDENTIAL",
      timestamp: new Date().toISOString(),
      voltageV: Number(voltageV.toFixed(2)),
      currentA: Number(currentA.toFixed(3)),
      powerW: Number(recordedPowerW.toFixed(2)),
      actualPowerW: Number(actualPowerW.toFixed(2)),
      powerFactor,
      energyWh: Number(energyWh.toFixed(5)),
      cumulativeEnergyWh: Number(
        cumulativeEnergyWh.toFixed(5)
      ),
      meterStatus,
      reductionPercent: validReduction,
    };
  };
}