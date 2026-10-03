import mongoose from "mongoose";

const ConsumerSchema = new mongoose.Schema(
  {
    consumer_id: { type: String, required: true },
    timestamp: { type: String, required: true },
    energy_kwh: { type: Number, required: true },
    power_kw: { type: Number, required: true },
    voltage_v: { type: Number, required: true },
    current_a: { type: Number, required: true },
    power_factor: { type: Number, required: true },
  },
  { _id: false }
);

const TransformerSchema = new mongoose.Schema(
  {
    dt_id: { type: String, required: true },
    timestamp: { type: String, required: true },
    power_kw: { type: Number, required: true },
    voltage_v: { type: Number, required: true },
    current_a: { type: Number, required: true },
    power_factor: { type: Number, required: true },
  },
  { _id: false }
);

const ReadingWindowSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true },
    simulated_at: { type: String, required: true },
    transformer: { type: TransformerSchema, required: true },
    consumers: { type: [ConsumerSchema], required: true },
  },
  { timestamps: true }
);

const ReadingWindow =
  mongoose.models.ReadingWindow ||
  mongoose.model("ReadingWindow", ReadingWindowSchema);

export default ReadingWindow;