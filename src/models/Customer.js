import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  state: String,
  pincode: String,
}, { _id: false });

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  company: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  gst: { type: String, trim: true },
  address: { type: AddressSchema, default: {} },
}, { timestamps: true });

export default mongoose.model('Customer', CustomerSchema);

