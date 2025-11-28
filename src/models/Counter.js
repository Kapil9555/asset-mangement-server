// models/Counter.js
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },   
    seq: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false }
);

export default mongoose.model("Counter", CounterSchema);
