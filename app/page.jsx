"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Zap,
  Activity,
  Home,
  Cpu,
  Play,
  Square,
  Search,
  TrendingUp,
  BarChart3,
  Gauge,
  Sliders,
  X,
  ZapOff,
  Power,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { startArea1Simulator } from "./virtualMeters/area1/simulator";
import { startArea2Simulator } from "./virtualMeters/area2/simulator";
import { startArea3Simulator } from "./virtualMeters/area3/simulator";

const AREAS = ["AREA-1", "AREA-2", "AREA-3"];

const AREA_META = {
  "AREA-1": {
    name: "Sector Alpha (Area 1)",
    transformerId: "TR-AREA-1",
    color: "#3b82f6",
    consumerPrefix: "A1-C",
    capacity: "100 kVA",
  },
  "AREA-2": {
    name: "Sector Beta (Area 2)",
    transformerId: "TR-AREA-2",
    color: "#10b981",
    consumerPrefix: "A2-C",
    capacity: "100 kVA",
  },
  "AREA-3": {
    name: "Sector Gamma (Area 3)",
    transformerId: "TR-AREA-3",
    color: "#8b5cf6",
    consumerPrefix: "A3-C",
    capacity: "100 kVA",
  },
};

// Generate initial house cards with distinct initial loads
function generateInitialHouses(areaKey) {
  const prefix = AREA_META[areaKey].consumerPrefix;
  const houses = {};
  for (let i = 1; i <= 50; i++) {
    const consumerId = `${prefix}${100 + i}`;
    houses[consumerId] = {
      consumerId,
      meterId: `M-${areaKey.replace("AREA-", "A")}-${100 + i}`,
      category: "RESIDENTIAL",
      voltageV: 230.0,
      currentA: 0.0,
      powerW: 0.0,
      powerFactor: 0.95,
      energyWh: 0.0,
      cumulativeEnergyWh: 0.0,
      meterStatus: "IDLE",
    };
  }
  return houses;
}

export default function Dashboard() {
  const [activeArea, setActiveArea] = useState("AREA-1");
  const [activeHouse, setActiveHouse] = useState(null);
  const [modalHouseId, setModalHouseId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Map of consumerId -> boolean (true if power cut)
  const [cutHouses, setCutHouses] = useState({});
  const cutHousesRef = useRef({});

  // Map of consumerId -> reduction percentage (0, 50, 60, 80)
  const [reducedHouses, setReducedHouses] = useState({});
  const reducedHousesRef = useRef({});

  const toggleCutHouse = (consumerId) => {
    setCutHouses((prev) => {
      const nextState = { ...prev, [consumerId]: !prev[consumerId] };
      cutHousesRef.current = nextState;
      return nextState;
    });
  };

  const setHouseReduction = (consumerId, percentage) => {
    setReducedHouses((prev) => {
      const nextState = { ...prev, [consumerId]: percentage };
      reducedHousesRef.current = nextState;
      return nextState;
    });
  };

  // 60-second rolling chart data for each area and house
  const [chartData, setChartData] = useState({
    "AREA-1": { transformer: [], houses: {} },
    "AREA-2": { transformer: [], houses: {} },
    "AREA-3": { transformer: [], houses: {} },
  });

  // Latest instantaneous house readings
  const [latestReadings, setLatestReadings] = useState({
    "AREA-1": generateInitialHouses("AREA-1"),
    "AREA-2": generateInitialHouses("AREA-2"),
    "AREA-3": generateInitialHouses("AREA-3"),
  });

  // Latest transformer readings
  const [latestTransformers, setLatestTransformers] = useState({
    "AREA-1": { powerW: 0, voltageV: 230, currentA: 0, cumulativeEnergyWh: 0 },
    "AREA-2": { powerW: 0, voltageV: 230, currentA: 0, cumulativeEnergyWh: 0 },
    "AREA-3": { powerW: 0, voltageV: 230, currentA: 0, cumulativeEnergyWh: 0 },
  });

  // Buffer ref to safely accumulate data without mutating frozen state objects
  const bufferRef = useRef({
    chartData: {
      "AREA-1": { transformer: [], houses: {} },
      "AREA-2": { transformer: [], houses: {} },
      "AREA-3": { transformer: [], houses: {} },
    },
    latestReadings: {
      "AREA-1": generateInitialHouses("AREA-1"),
      "AREA-2": generateInitialHouses("AREA-2"),
      "AREA-3": generateInitialHouses("AREA-3"),
    },
    latestTransformers: {
      "AREA-1": { powerW: 0, voltageV: 230, currentA: 0, cumulativeEnergyWh: 0 },
      "AREA-2": { powerW: 0, voltageV: 230, currentA: 0, cumulativeEnergyWh: 0 },
      "AREA-3": { powerW: 0, voltageV: 230, currentA: 0, cumulativeEnergyWh: 0 },
    },
    dirty: false,
  });

  // Set default active house when area changes
  useEffect(() => {
    const prefix = AREA_META[activeArea].consumerPrefix;
    setActiveHouse(`${prefix}101`);
  }, [activeArea]);

  // Start & stop simulators
  useEffect(() => {
    if (!isRunning) return;

    bufferRef.current.dirty = false;

    const handleReading = (payload) => {
      const { area, type, data } = payload;
      const timeLabel = new Date(data.timestamp).toLocaleTimeString();
      const buf = bufferRef.current;
      const areaCharts = buf.chartData[area];

      if (type === "TRANSFORMER") {
        const prevArray = areaCharts.transformer || [];
        const nextArray = [
          ...prevArray,
          {
            time: timeLabel,
            powerW: data.powerW,
            voltageV: data.voltageV,
            currentA: data.currentA,
            energyWh: data.energyWh,
          },
        ];
        if (nextArray.length > 60) nextArray.shift();

        areaCharts.transformer = nextArray;
        buf.latestTransformers[area] = data;
      } else if (type === "HOUSE") {
        const houseId = data.consumerId;
        const prevHouseArray = areaCharts.houses[houseId] || [];
        const nextHouseArray = [
          ...prevHouseArray,
          {
            time: timeLabel,
            powerW: data.powerW,
            voltageV: data.voltageV,
            currentA: data.currentA,
            energyWh: data.energyWh,
            cumulativeEnergyWh: data.cumulativeEnergyWh,
          },
        ];
        if (nextHouseArray.length > 60) nextHouseArray.shift();

        areaCharts.houses[houseId] = nextHouseArray;
        buf.latestReadings[area][houseId] = data;
      }

      buf.dirty = true;
    };

    const isCutCheck = (consumerId) => !!cutHousesRef.current[consumerId];
    const getReductionCheck = (consumerId) => reducedHousesRef.current[consumerId] || 0;

    // Launch all 3 sector simulators
    const stop1 = startArea1Simulator(handleReading, isCutCheck, getReductionCheck);
    const stop2 = startArea2Simulator(handleReading, isCutCheck, getReductionCheck);
    const stop3 = startArea3Simulator(handleReading, isCutCheck, getReductionCheck);

    // Batch flush updates every 500ms
    const flushInterval = setInterval(() => {
      if (bufferRef.current.dirty) {
        const buf = bufferRef.current;

        setChartData({
          "AREA-1": {
            transformer: buf.chartData["AREA-1"].transformer,
            houses: { ...buf.chartData["AREA-1"].houses },
          },
          "AREA-2": {
            transformer: buf.chartData["AREA-2"].transformer,
            houses: { ...buf.chartData["AREA-2"].houses },
          },
          "AREA-3": {
            transformer: buf.chartData["AREA-3"].transformer,
            houses: { ...buf.chartData["AREA-3"].houses },
          },
        });

        setLatestReadings({
          "AREA-1": { ...buf.latestReadings["AREA-1"] },
          "AREA-2": { ...buf.latestReadings["AREA-2"] },
          "AREA-3": { ...buf.latestReadings["AREA-3"] },
        });

        setLatestTransformers({
          "AREA-1": { ...buf.latestTransformers["AREA-1"] },
          "AREA-2": { ...buf.latestTransformers["AREA-2"] },
          "AREA-3": { ...buf.latestTransformers["AREA-3"] },
        });

        buf.dirty = false;
      }
    }, 500);

    return () => {
      stop1();
      stop2();
      stop3();
      clearInterval(flushInterval);
    };
  }, [isRunning]);

  // Active Area Data
  const currentTransformer = latestTransformers[activeArea] || {};
  const currentHousesMap = latestReadings[activeArea] || {};
  const currentHouseList = useMemo(() => {
    let list = Object.values(currentHousesMap);
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      list = list.filter(
        (h) =>
          h.consumerId.toLowerCase().includes(q) ||
          h.meterId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentHousesMap, searchFilter]);

  // Selected Area Rolling Chart Data
  const areaTransformerChart = chartData[activeArea]?.transformer || [];

  // Selected House Rolling Chart Data
  const houseChartData = useMemo(() => {
    if (!activeHouse) return [];
    return chartData[activeArea]?.houses[activeHouse] || [];
  }, [chartData, activeArea, activeHouse]);

  // Active House Instant Reading
  const activeHouseData = currentHousesMap[activeHouse] || null;

  // Modal House Instant Reading & Rolling Chart
  const modalHouseData = useMemo(() => {
    if (!modalHouseId) return null;
    // Find area of modal house by prefix
    for (const areaKey of AREAS) {
      const prefix = AREA_META[areaKey].consumerPrefix;
      if (modalHouseId.startsWith(prefix)) {
        return latestReadings[areaKey]?.[modalHouseId] || null;
      }
    }
    return currentHousesMap[modalHouseId] || null;
  }, [modalHouseId, latestReadings, currentHousesMap]);

  const modalHouseAreaKey = useMemo(() => {
    if (!modalHouseId) return activeArea;
    for (const areaKey of AREAS) {
      const prefix = AREA_META[areaKey].consumerPrefix;
      if (modalHouseId.startsWith(prefix)) return areaKey;
    }
    return activeArea;
  }, [modalHouseId, activeArea]);

  const modalHouseChartData = useMemo(() => {
    if (!modalHouseId) return [];
    return chartData[modalHouseAreaKey]?.houses[modalHouseId] || [];
  }, [chartData, modalHouseAreaKey, modalHouseId]);

  // Grid Stats Calculations
  const activeAreaHousePowerTotal = useMemo(() => {
    return Object.values(currentHousesMap).reduce(
      (sum, h) => sum + (h.powerW || 0),
      0
    );
  }, [currentHousesMap]);

  const totalGridPower = useMemo(() => {
    return Object.values(latestTransformers).reduce(
      (sum, tr) => sum + (tr.powerW || 0),
      0
    );
  }, [latestTransformers]);

  const activeLineLoss = useMemo(() => {
    const trPower = currentTransformer.powerW || 0;
    const loss = trPower - activeAreaHousePowerTotal;
    return loss > 0 ? loss : 0;
  }, [currentTransformer, activeAreaHousePowerTotal]);

  const isModalHouseCut = modalHouseId ? !!cutHouses[modalHouseId] : false;
  const modalHouseReduction = modalHouseId ? (reducedHouses[modalHouseId] || 0) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 lg:p-6 selection:bg-cyan-500 selection:text-slate-950">
      {/* HEADER BAR */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 lg:p-6 backdrop-blur-md shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
            <Zap className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Microgrid Smart Meter Dashboard
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isRunning
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    isRunning ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                  }`}
                />
                {isRunning ? "Simulating Live" : "Idle"}
              </span>
            </div>
            <p className="text-xs lg:text-sm text-slate-400 mt-1">
              3 Sector Grid • 3 Distribution Transformers • 150 Smart Meters • 5 Columns per Area
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all transform active:scale-95 shadow-lg ${
              isRunning
                ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/40"
                : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-950/50"
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span>Stop Simulation</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Start Simulation</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* METRICS & OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>TOTAL MICROGRID DEMAND</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {(totalGridPower / 1000).toFixed(2)}{" "}
            <span className="text-sm font-semibold text-slate-400">kW</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across 3 Area Transformers
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>SELECTED SECTOR DEMAND</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400">
            {((currentTransformer.powerW || 0) / 1000).toFixed(2)}{" "}
            <span className="text-sm font-semibold text-slate-400">kW</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Houses load: {(activeAreaHousePowerTotal / 1000).toFixed(2)} kW
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>SECTOR LINE LOSS</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {activeLineLoss.toFixed(1)}{" "}
            <span className="text-sm font-semibold text-slate-400">W</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            ~5% estimated technical loss
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>ACTIVE CONSUMERS</span>
            <Home className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            50{" "}
            <span className="text-sm font-semibold text-slate-400">
              Meters / Sector
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Total 150 Smart Meters Active
          </div>
        </div>
      </div>

      {/* TRANSFORMER SELECTION BAR (3 SECTORS) */}
      <section className="mb-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>Select Sector Transformer</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AREAS.map((areaKey) => {
            const meta = AREA_META[areaKey];
            const isSelected = activeArea === areaKey;
            const trData = latestTransformers[areaKey] || {};
            const powerkW = (trData.powerW || 0) / 1000;

            return (
              <button
                key={areaKey}
                onClick={() => setActiveArea(areaKey)}
                className={`text-left transition-all duration-200 rounded-2xl p-5 border relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 border-cyan-500 shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-500/20"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                {/* Accent Top Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{
                    background: isSelected
                      ? meta.color
                      : "rgba(148, 163, 184, 0.2)",
                  }}
                />

                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      {meta.transformerId}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {meta.name}
                    </h3>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-md text-xs font-bold"
                    style={{
                      backgroundColor: `${meta.color}20`,
                      color: meta.color,
                      border: `1px solid ${meta.color}40`,
                    }}
                  >
                    {meta.capacity}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Power
                    </div>
                    <div className="text-sm font-extrabold text-white">
                      {powerkW.toFixed(2)} kW
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Voltage
                    </div>
                    <div className="text-sm font-extrabold text-white">
                      {trData.voltageV || 230} V
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Current
                    </div>
                    <div className="text-sm font-extrabold text-white">
                      {(trData.currentA || 0).toFixed(1)} A
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 flex items-center justify-between text-xs text-cyan-400 font-medium">
                    <span>✓ Currently Viewable</span>
                    <span className="text-[10px] bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      50 Houses (5 Columns)
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* CHARTS SECTION (2 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* LEFT CHART: Transformer Rolling 60s Power Timeline */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <BarChart3
                  className="w-5 h-5"
                  style={{ color: AREA_META[activeArea].color }}
                />
                <h3 className="text-base font-bold text-white">
                  {AREA_META[activeArea].name} Transformer Load Timeline
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time 60-second moving window for{" "}
                {AREA_META[activeArea].transformerId}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Current Load</span>
              <div className="text-lg font-black text-white">
                {(currentTransformer.powerW || 0).toFixed(1)} W
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {areaTransformerChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaTransformerChart}>
                  <defs>
                    <linearGradient
                      id="transformerGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={AREA_META[activeArea].color}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor={AREA_META[activeArea].color}
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    unit="W"
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.75rem",
                      color: "#f8fafc",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="powerW"
                    name="Transformer Power (W)"
                    stroke={AREA_META[activeArea].color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#transformerGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Activity className="w-8 h-8 mb-2 animate-bounce opacity-40" />
                <p className="text-sm">Click "Start Simulation" to stream transformer timeline</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CHART: Selected House 60s Power Timeline */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Home className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  House Timeline: {activeHouse || "Select a House"}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeHouseData
                  ? `Meter: ${activeHouseData.meterId} • Sanctioned 5000 W`
                  : "Click any house card below to monitor its timeline"}
              </p>
            </div>
            {activeHouseData && (
              <div className="text-right">
                <span className="text-xs text-slate-400">Instant Load</span>
                <div className="text-lg font-black text-cyan-400">
                  {activeHouseData.powerW.toFixed(1)} W
                </div>
              </div>
            )}
          </div>

          <div className="h-64 w-full">
            {houseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={houseChartData}>
                  <defs>
                    <linearGradient
                      id="houseGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    unit="W"
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "0.75rem",
                      color: "#f8fafc",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="powerW"
                    name="House Load (W)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#houseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Home className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">
                  {isRunning
                    ? "Click any house card below to view 60s timeline"
                    : "Start simulation and select a house card below"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 50 HOUSES GRID SECTION (5 COLUMNS PER TRANSFORMER) */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">
                50 Houses Smart Meters — {AREA_META[activeArea].name} (5 Columns)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Click any house smart meter card to pop up live metrics (Current, Voltage, Energy graph & Cut option)
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search filter input */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search House ID (e.g. A1-C105)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* CARDS GRID - 5 COLUMNS ONLY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {currentHouseList.map((house) => {
            const isSelected = activeHouse === house.consumerId;
            const isCut = !!cutHouses[house.consumerId] || house.meterStatus === "POWER CUT";
            const reductionPercent = reducedHouses[house.consumerId] || house.reductionPercent || 0;
            const power = isCut ? 0 : house.powerW || 0;
            const voltage = isCut ? 0 : house.voltageV || 230;
            const current = isCut ? 0 : house.currentA || 0;

            // Dynamic load status color coding
            let statusColor = "text-slate-400";
            let borderHover = "hover:border-slate-700";
            if (isCut) {
              statusColor = "text-rose-500 font-extrabold";
              borderHover = "hover:border-rose-500";
            } else if (reductionPercent > 0) {
              statusColor = "text-amber-400 font-extrabold";
              borderHover = "hover:border-amber-500";
            } else if (power > 2800) {
              statusColor = "text-rose-400 font-black";
              borderHover = "hover:border-rose-500/50";
            } else if (power > 1400) {
              statusColor = "text-amber-400 font-bold";
              borderHover = "hover:border-amber-500/50";
            } else if (power > 0) {
              statusColor = "text-emerald-400 font-bold";
              borderHover = "hover:border-emerald-500/50";
            }

            return (
              <button
                key={house.consumerId}
                onClick={() => {
                  setActiveHouse(house.consumerId);
                  setModalHouseId(house.consumerId);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all duration-150 transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isCut
                    ? "bg-rose-950/20 border-rose-800/80 hover:bg-rose-950/40"
                    : reductionPercent > 0
                    ? "bg-amber-950/25 border-amber-500/80 ring-1 ring-amber-500/40 hover:bg-amber-950/40"
                    : isSelected
                    ? "bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-950/50"
                    : `bg-slate-950/60 border-slate-800/80 ${borderHover} hover:bg-slate-900`
                }`}
              >
                {isCut ? (
                  <div className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-bl">
                    POWER CUT
                  </div>
                ) : reductionPercent > 0 ? (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl">
                    ⚡ {reductionPercent}% LESS
                  </div>
                ) : null}

                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-black text-slate-200">
                    {house.consumerId}
                  </span>
                  {!isCut && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        reductionPercent > 0
                          ? "bg-amber-400 animate-pulse"
                          : isRunning && power > 0
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-slate-600"
                      }`}
                    />
                  )}
                </div>

                <div className="my-1.5">
                  <div className={`text-lg tracking-tight ${statusColor}`}>
                    {isCut ? "OFF" : `${power.toFixed(0)} W`}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60 w-full">
                  <span>Volt: {voltage.toFixed(0)}V</span>
                  <span>Curr: {current.toFixed(2)}A</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* POPUP MODAL ON HOUSE CLICK */}
      {modalHouseId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 max-w-3xl w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-3 rounded-2xl ${
                    isModalHouseCut
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                      : modalHouseReduction > 0
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                      : "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                  }`}
                >
                  {isModalHouseCut ? (
                    <ZapOff className="w-7 h-7" />
                  ) : modalHouseReduction > 0 ? (
                    <Zap className="w-7 h-7 animate-pulse" />
                  ) : (
                    <Home className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h3 className="text-xl font-extrabold text-white">
                      House Smart Meter: {modalHouseId}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isModalHouseCut
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          : modalHouseReduction > 0
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      }`}
                    >
                      {isModalHouseCut
                        ? "POWER CUT (0V)"
                        : modalHouseReduction > 0
                        ? `BYPASS (${modalHouseReduction}% LESS POWER)`
                        : "NORMAL / CONNECTED"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Meter ID: {modalHouseData?.meterId || `M-${modalHouseId}`} • Category: RESIDENTIAL • Sanctioned Load: 5000 W
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalHouseId(null)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LIVE METRICS GRID (6 PARAMETERS) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Current (A)
                </div>
                <div className="text-xl font-black text-cyan-400 mt-1">
                  {isModalHouseCut ? "0.000" : (modalHouseData?.currentA || 0).toFixed(3)} A
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {modalHouseReduction > 0 ? `${modalHouseReduction}% reduced current` : "Smooth low deviation"}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Voltage (V)
                </div>
                <div className="text-xl font-black text-blue-400 mt-1">
                  {isModalHouseCut ? "0.00" : (modalHouseData?.voltageV || 230).toFixed(2)} V
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isModalHouseCut ? "Kill Switch ON (0V)" : "Nominal ~230V Supply"}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Recorded Power
                </div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {isModalHouseCut ? "0.00" : (modalHouseData?.powerW || 0).toFixed(2)} W
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {modalHouseReduction > 0
                    ? `Actual load: ${modalHouseData?.actualPowerW || 0} W`
                    : "Instantaneous meter reading"}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Energy / Sec (Wh)
                </div>
                <div className="text-xl font-black text-amber-400 mt-1">
                  {isModalHouseCut ? "0.00000" : (modalHouseData?.energyWh || 0).toFixed(5)} Wh
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Energy consumed per sec</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Cumulative Energy
                </div>
                <div className="text-xl font-black text-purple-400 mt-1">
                  {(modalHouseData?.cumulativeEnergyWh || 0).toFixed(4)} Wh
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Total smart meter energy</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Power Factor
                </div>
                <div className="text-xl font-black text-slate-200 mt-1">
                  {modalHouseData?.powerFactor || 0.95}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">PF standard 0.95</div>
              </div>
            </div>

            {/* GRAPH OF ENERGY PER SECOND */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white">
                    Energy Consumption Timeline (Wh / sec)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">Real-time 60s moving window</span>
              </div>

              <div className="h-48 w-full">
                {modalHouseChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={modalHouseChartData}>
                      <defs>
                        <linearGradient id="modalEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} unit="Wh" tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "0.75rem",
                          color: "#f8fafc",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="energyWh"
                        name="Energy (Wh/s)"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#modalEnergyGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    Start simulation to stream energy graph for this meter
                  </div>
                )}
              </div>
            </div>

            {/* CONTROLS SECTION: KILL SWITCH & POWER REDUCTION OPTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. KILL SWITCH TYPE REMOTE POWER CONTROL */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center space-x-3 mb-3">
                  {isModalHouseCut ? (
                    <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-bold text-white">
                      Remote Power Control (Kill Switch)
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {isModalHouseCut
                        ? "Voltage supply set to 0V. Power completely disconnected."
                        : "Nominal 230V active supply to smart meter."}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleCutHouse(modalHouseId)}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold transition-all text-xs shadow-md ${
                    isModalHouseCut
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950"
                      : "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white"
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>
                    {isModalHouseCut ? "RESTORE POWER / RECONNECT" : "CUT POWER (SET VOLTAGE TO 0V)"}
                  </span>
                </button>
              </div>

              {/* 2. POWER REDUCTION / BYPASS OPTIONS (50%, 60%, 80% LESS POWER) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Power Reduction / Meter Bypass</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-3">
                    Select power reduction. Meter records less energy, increasing Sector Line Loss.
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 50, 60, 80].map((pct) => {
                    const isActive = modalHouseReduction === pct;
                    return (
                      <button
                        key={pct}
                        disabled={isModalHouseCut}
                        onClick={() => setHouseReduction(modalHouseId, pct)}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                          isModalHouseCut
                            ? "opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600"
                            : isActive
                            ? pct === 0
                              ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40"
                              : "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-950/40"
                            : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {pct === 0 ? "0% (Normal)" : `${pct}% Less`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}