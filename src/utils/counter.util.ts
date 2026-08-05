import mongoose, { Schema, model, Model, Document } from 'mongoose';

interface ICounter extends Document {
  id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = (mongoose.models.Counter as Model<ICounter>) ?? model<ICounter>('Counter', counterSchema);

/**
 * Atomically increments and returns the next sequence number for a named counter.
 * Safe under concurrent requests — MongoDB guarantees findOneAndUpdate is atomic
 * at the document level, so two simultaneous calls can never receive the same number.
 */
export const getNextSequence = async (counterName: string): Promise<number> => {
  const counter = await Counter.findOneAndUpdate(
    { id: counterName },
    { $inc: { seq: 1 }, $setOnInsert: { id: counterName } },
    { 
      returnDocument: 'after', 
      upsert: true 
    }
  );
  return counter!.seq;
};