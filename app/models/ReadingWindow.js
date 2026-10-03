import mongoose from "mongoose";

const HouseSummarySchema = new mongoose.Schema(
  {
    consumerId: { type: String, required: true },
    energyConsumedWh: { type: Number, required: true },
  },
  { _id: false }
);

const TransformerSummarySchema = new mongoose.Schema(
  {
    transformerId: { type: String, required: true },
    energyConsumedWh: { type: Number, required: true },
  },
  { _id: false }
);

const ReadingWindowSchema = new mongoose.Schema(
  {
    area: { type: String, required: true },
    windowDuration: { type: Number, required: true, default: 60 },
    houses: { type: [HouseSummarySchema], required: true }, // Expects an Array
    transformer: { type: TransformerSummarySchema, required: true },
    
    totalHousesEnergyWh: { type: Number, required: true },
    lineLossWh: { type: Number, required: true },
  },
  { timestamps: true }
);

const ReadingWindow =
  mongoose.models.ReadingWindow ||
  mongoose.model("ReadingWindow", ReadingWindowSchema);

export default ReadingWindow;