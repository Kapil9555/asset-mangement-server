import Counter from "../models/Counter.js";

export async function getNextSeq(key) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return doc.seq;
}
