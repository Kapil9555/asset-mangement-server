import mongoose from 'mongoose';

const ContractAssetSchema = new mongoose.Schema({
  assetId: { type: String, required: true },
  monthlyRent: { type: Number, required: true, min: 0 },
}, { _id: false });

const DocumentSchema = new mongoose.Schema({
  rentAgreementUrl: String,
  invoiceUrl: String,
}, { _id: false });

const ContractSchema = new mongoose.Schema({
  contractId: { type: String, unique: true, index: true },       
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  monthlyRent: { type: Number, required: true, min: 0 },
  securityDeposit: { type: Number, default: 0 },
  slaUrl: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'CANCELLED','COMPLETED'], default: 'ACTIVE' },
  notes: String,
  assets: { type: [ContractAssetSchema], default: [] },
  documents: { type: DocumentSchema, default: {} },
  autoSumFromAssets: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true });


export default mongoose.model('Contract', ContractSchema);
