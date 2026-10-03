export function createHouseMeter(
  consumerId,
  meterId,
  sanctionedLoadW = 5000
) {
  let cumulativeEnergyWh = 0;

  // 400 kWh over 30 days = 400,000 Wh / (30 * 24 h) = ~555.56 W average load
  const TARGET_AVG_LOAD_W = 555.56;

  return function generateReading(loadW = TARGET_AVG_LOAD_W, isCut = false) {
    if (isCut) {
      return {
        consumerId,
        meterId,
        category: "RESIDENTIAL",
        timestamp: new Date().toISOString(),
        voltageV: 0,
        currentA: 0,
        powerW: 0,
        powerFactor: 0.95,
        energyWh: 0,
        cumulativeEnergyWh: Number(cumulativeEnergyWh.toFixed(5)),
        meterStatus: "POWER CUT",
      };
    }

    const powerW = Math.max(0, Math.min(loadW, sanctionedLoadW));

    // Low deviation voltage: ~229.8V to 230.2V
    const voltageV = 230 + (Math.random() - 0.5) * 0.4;
    const powerFactor = 0.95;

    // Calculate current smoothly
    const currentA = powerW > 0 
      ? powerW / (voltageV * powerFactor) 
      : 0;

    // Energy consumed in 1 second (Wh)
    const energyWh = powerW / 3600;
    cumulativeEnergyWh += energyWh;

    return {
      consumerId,
      meterId,
      category: "RESIDENTIAL",
      timestamp: new Date().toISOString(),
      voltageV: Number(voltageV.toFixed(2)),
      currentA: Number(currentA.toFixed(3)),
      powerW: Number(powerW.toFixed(2)),
      powerFactor,
      energyWh: Number(energyWh.toFixed(5)),
      cumulativeEnergyWh: Number(
        cumulativeEnergyWh.toFixed(5)
      ),
      meterStatus: "NORMAL",
    };
  };
}