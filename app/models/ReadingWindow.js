import mongoose from "mongoose";

const ConsumerSchema = new mongoose.Schema(
  {
    consumer_id: { type: String, required: true },
    timestamp: { type: Date, required: true },
    energy_kwh: { type: Number, default: null },
    power_kw: { type: Number, default: null },
    voltage_v: { type: Number, default: null },
    current_a: { type: Number, default: null },
    power_factor: { type: Number, default: null },
  },
  { _id: false }
);

const TransformerSchema = new mongoose.Schema(
  {
    dt_id: { type: String, required: true },
    timestamp: { type: Date, required: true },
    energy_kwh: { type: Number, default: null },
    power_kw: { type: Number, default: null },
    voltage_v: { type: Number, default: null },
    current_a: { type: Number, default: null },
    power_factor: { type: Number, default: null },
  },
  { _id: false }
);

const ReadingWindowSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true },
    simulated_at: { type: Date, required: true },
    transformer: { type: TransformerSchema, required: true },
    consumers: { type: [ConsumerSchema], required: true },
  },
  { timestamps: false, versionKey: false }
);

delete mongoose.models.ReadingWindow;

const ReadingWindow =
  mongoose.models.ReadingWindow ||
  mongoose.model("ReadingWindow", ReadingWindowSchema);

export default ReadingWindow;