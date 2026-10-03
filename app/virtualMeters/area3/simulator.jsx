import { createHouseMeter } from "./houseMeter";
import { createTransformerMeter } from "./transformerMeter";

const AREA_NAME = "AREA-3";
const CONSUMER_PREFIX = "A3-C";

// 1. Initialize 50 house meters for Area 3
const meters = [];
for (let i = 1; i <= 50; i++) {
  meters.push(
    createHouseMeter(`${CONSUMER_PREFIX}${100 + i}`, `M-A3-${100 + i}`, 5000)
  );
}

// 2. Initialize Area 3 Transformer
const transformer = createTransformerMeter("TR-AREA-3", 100);

export function startArea3Simulator(onReading, getIsHouseCut) {
  let houseDataWindow = createEmptyDataStore();
  let transformerWindow = [];
  let secondsElapsed = 0;

  const interval = setInterval(() => {
    secondsElapsed++;
    let totalHousePowerInTick = 0;

    // Tick every house in Area 3 with dynamic unique load variations (low deviation for current)
    meters.forEach((meter, index) => {
      const houseNum = index + 1;
      const consumerId = `${CONSUMER_PREFIX}${100 + houseNum}`;
      const isCut = typeof getIsHouseCut === "function" ? getIsHouseCut(consumerId) : false;

      // Base load distinct to each house (between 300W and 3800W)
      const baseLoad = 300 + ((houseNum * 151 + 200) % 3500);
      
      // Micro smooth fluctuation every second (+/- 3W max) to keep current deviation low
      const noise = (Math.random() - 0.5) * 6;
      
      // Slower smooth sine wave simulating appliance cycles
      const wave = Math.sin((secondsElapsed + houseNum * 11) / 60) * 50;

      const dynamicLoadW = Math.max(70, Math.min(4800, baseLoad + noise + wave));

      const reading = meter(dynamicLoadW, isCut);
      totalHousePowerInTick += reading.powerW;
      houseDataWindow[reading.consumerId].push(reading.energyWh);

      if (onReading) onReading({ area: AREA_NAME, type: "HOUSE", data: reading });
    });

    // Tick Area 3 Transformer
    const transformerReading = transformer(totalHousePowerInTick);
    transformerWindow.push(transformerReading.energyWh);

    if (onReading) onReading({ area: AREA_NAME, type: "TRANSFORMER", data: transformerReading });

    // 60-Second Window Rollup
    if (secondsElapsed === 60) {
      console.log(`\n================== 60-SEC REPORT: ${AREA_NAME} ==================`);

      let sumAllHousesWh = 0;
      const houseSummary = {};
      const housesPayload = [];

      for (const consumerId in houseDataWindow) {
        const readings60 = houseDataWindow[consumerId];
        const houseTotal = readings60.reduce((a, b) => a + b, 0);
        houseSummary[consumerId] = Number(houseTotal.toFixed(5));
        sumAllHousesWh += houseTotal;

        housesPayload.push({
          consumerId,
          energyConsumedWh: Number(houseTotal.toFixed(5)),
          readings: readings60.map((r) => Number(r.toFixed(5))), // Array of 60 readings
        });
      }

      const sumTransformerWh = transformerWindow.reduce((a, b) => a + b, 0);
      const lineLossWh = sumTransformerWh - sumAllHousesWh;

      console.table(houseSummary);
      console.log("------------------------------------------------------------");
      console.log(`Area 3 (50 Houses Total) : ${sumAllHousesWh.toFixed(5)} Wh`);
      console.log(`Area 3 Transformer Total : ${sumTransformerWh.toFixed(5)} Wh`);
      console.log(`Area 3 Line Loss         : ${lineLossWh.toFixed(5)} Wh`);
      console.log(`============================================================\n`);

      // Save to MongoDB via API Route
      const payload = {
        area: AREA_NAME,
        windowDuration: 60,
        houses: housesPayload,
        transformer: {
          transformerId: `TR-${AREA_NAME}`,
          energyConsumedWh: Number(sumTransformerWh.toFixed(5)),
        },
        totalHousesEnergyWh: Number(sumAllHousesWh.toFixed(5)),
        lineLossWh: Number(lineLossWh.toFixed(5)),
      };

      fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            console.log(`[${AREA_NAME}] Saved 60-sec window data to DB successfully! ID:`, data.data._id);
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