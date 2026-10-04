import { createHouseMeter } from "./houseMeter";
import { createTransformerMeter } from "./transformerMeter";
import { fetchLastSimulatedDate, addOneDay } from "../../lib/simulationDate";

const AREA_NAME = "AREA-3";
const DT_ID = "DT-03";
const CONSUMER_PREFIX = "A3-C";

// 1. Initialize 50 house meters for Area 3
const meters = [];
for (let i = 1; i <= 50; i++) {
  meters.push(
    createHouseMeter(`${CONSUMER_PREFIX}${100 + i}`, `M-A3-${100 + i}`, 10000000)
  );
}

// 2. Initialize Area 3 Transformer
const transformer = createTransformerMeter("TR-AREA-3", 500000);

export function startArea3Simulator(onReading, getIsHouseCut, getHouseReduction, getTransformerLoss) {
  let houseDataWindow = createEmptyDataStore();
  let transformerWindow = [];
  let secondsElapsed = 0;

  // Track simulation date starting from last MongoDB record timestamp (or 1999-12-31 for default 2000-01-01 start)
  let currentSimulatedDate = null;

  fetchLastSimulatedDate(DT_ID).then((lastDate) => {
    if (lastDate) {
      currentSimulatedDate = lastDate;
      console.log(`[${AREA_NAME}] Extracted last JSON timestamp from MongoDB GET: ${lastDate.toISOString()}`);
    } else {
      currentSimulatedDate = new Date("1999-12-31T00:00:00.000Z");
      console.log(`[${AREA_NAME}] No MongoDB record found. Defaulting base date to 1999-12-31`);
    }
  });

  const interval = setInterval(() => {
    secondsElapsed++;
    let totalHousePowerInTick = 0;

    // Tick every house in Area 3 with dynamic unique load variations
    meters.forEach((meter, index) => {
      const houseNum = index + 1;
      const consumerId = `${CONSUMER_PREFIX}${100 + houseNum}`;
      const isCut = typeof getIsHouseCut === "function" ? getIsHouseCut(consumerId) : false;
      const reductionPercent = typeof getHouseReduction === "function" ? (getHouseReduction(consumerId) || 0) : 0;

      // Base load distinct to each house (between 6,000,000W and 9,000,000W to consume 100 - 150 kWh per min)
      const baseLoad = 6000000 + ((houseNum * 58000 + 20000) % 2800000);
      const noise = (Math.random() - 0.5) * 10000;
      const wave = Math.sin((secondsElapsed + houseNum * 11) / 60) * 90000;

      const dynamicLoadW = Math.max(6000000, Math.min(9000000, baseLoad + noise + wave));
      const reading = meter(dynamicLoadW, isCut, reductionPercent);

      const actualPowerW = isCut ? 0 : dynamicLoadW;
      totalHousePowerInTick += actualPowerW;
      houseDataWindow[reading.consumerId].push(reading);

      if (onReading) onReading({ area: AREA_NAME, type: "HOUSE", data: reading });
    });

    // Tick Area 3 Transformer with dynamic loss percentage
    const lossPercent = typeof getTransformerLoss === "function" ? (getTransformerLoss(AREA_NAME) || 5) : 5;
    const transformerReading = transformer(totalHousePowerInTick, lossPercent);
    transformerWindow.push(transformerReading);

    if (onReading) onReading({ area: AREA_NAME, type: "TRANSFORMER", data: transformerReading });

    // 60-Second Window Rollup
    if (secondsElapsed === 60) {
      console.log(`\n================== 60-SEC REPORT: ${AREA_NAME} (${DT_ID}) ==================`);

      if (!currentSimulatedDate) {
        currentSimulatedDate = new Date("1999-12-31T00:00:00.000Z");
      }
      // Next data sent to MongoDB gets the next date (+1 day) from extracted date
      currentSimulatedDate = addOneDay(currentSimulatedDate);

      const simulatedAt = currentSimulatedDate.toISOString();
      const batchId = generateBatchId(DT_ID, currentSimulatedDate);

      // 1. Calculate Transformer metrics for window
      const tfCount = transformerWindow.length || 1;
      const totalTfEnergyWh = transformerWindow.reduce((a, b) => a + b.energyWh, 0);
      const avgTfPowerW = transformerWindow.reduce((a, b) => a + b.powerW, 0) / tfCount;
      const avgTfVoltageV = transformerWindow.reduce((a, b) => a + b.voltageV, 0) / tfCount;
      const avgTfCurrentA = transformerWindow.reduce((a, b) => a + b.currentA, 0) / tfCount;
      const tfPf = transformerWindow[0]?.powerFactor || 0.93;

      const transformerPayload = {
        dt_id: DT_ID,
        timestamp: simulatedAt,
        energy_kwh: Number((totalTfEnergyWh / 1000).toFixed(4)),
        power_kw: Number((avgTfPowerW / 1000).toFixed(2)),
        voltage_v: Number(avgTfVoltageV.toFixed(1)),
        current_a: Number(avgTfCurrentA.toFixed(1)),
        power_factor: tfPf,
      };

      // 2. Calculate Consumers metrics for window (7 fields per consumer)
      const consumersPayload = [];
      for (const consumerId in houseDataWindow) {
        const readings = houseDataWindow[consumerId];
        const count = readings.length || 1;
        const isCut = readings.length > 0 && readings.every((r) => r.meterStatus === "POWER CUT" || r.voltageV === 0);

        if (isCut) {
          consumersPayload.push({
            consumer_id: consumerId,
            timestamp: simulatedAt,
            energy_kwh: null,
            power_kw: null,
            voltage_v: null,
            current_a: null,
            power_factor: null,
          });
        } else {
          const totalEnergyWh = readings.reduce((a, b) => a + b.energyWh, 0);
          const avgPowerW = readings.reduce((a, b) => a + b.powerW, 0) / count;
          const avgVoltageV = readings.reduce((a, b) => a + b.voltageV, 0) / count;
          const avgCurrentA = readings.reduce((a, b) => a + b.currentA, 0) / count;
          const pf = readings[0]?.powerFactor || 0.95;

          consumersPayload.push({
            consumer_id: consumerId,
            timestamp: simulatedAt,
            energy_kwh: Number((totalEnergyWh / 1000).toFixed(4)),
            power_kw: Number((avgPowerW / 1000).toFixed(4)),
            voltage_v: Number(avgVoltageV.toFixed(2)),
            current_a: Number(avgCurrentA.toFixed(3)),
            power_factor: Number(pf.toFixed(3)),
          });
        }
      }

      // 3. Assemble JSON Payload in requested schema
      const payload = {
        batch_id: batchId,
        simulated_at: simulatedAt,
        transformer: transformerPayload,
        consumers: consumersPayload,
      };

      console.log(`[${AREA_NAME}] Payload generated for Batch: ${batchId}`);
      console.log(JSON.stringify(payload, null, 2));

      // Save to MongoDB via API Route
      fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            console.log(`[${AREA_NAME}] Saved 60-sec batch window to DB successfully! ID:`, data.data._id);
          } else {
            console.error(`[${AREA_NAME}] Failed to save data to DB:`, data.error);
          }
        })
        .catch((err) => console.error(`[${AREA_NAME}] Error posting to DB:`, err));

      // Reset for next window
      houseDataWindow = createEmptyDataStore();
      transformerWindow = [];
      secondsElapsed = 0;
    }
  }, 1000);

  return () => clearInterval(interval);
}

function createEmptyDataStore() {
  const store = {};
  for (let i = 1; i <= 50; i++) {
    store[`${CONSUMER_PREFIX}${100 + i}`] = [];
  }
  return store;
}

function generateBatchId(dtId, date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `b-${yyyy}${mm}${dd}T${hh}${min}-${dtId}`;
}