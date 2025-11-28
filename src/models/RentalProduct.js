import mongoose from "mongoose";


const specificationSchema = new mongoose.Schema({
  key: String,
  value: String,
});



const productSchema = new mongoose.Schema({
  assetId: { type: String, unique: true, index: true },
  productName: { type: String, required: true },
  brand: String,
  model: String,
  serialNumber: String,
  macAddress: String,
  category: String,
  purchaseDate: Date,
  purchasePrice: Number,
  vendor: String,
  warranty: String,
  warrantyType: String,
  currentValue:Number,
  assetBills:[String],
  contractId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Contract', default: null },
  rentedTo:{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },             
  rentedFrom: { type: Date },  
  rentedTill: { type: Date },  
  specifications: [specificationSchema],
  status: {
    type: String,
    enum: ["available", "rented"],
    default: "available",
  },
  location: {
    type: String,
    enum: ["gurugram", "mumbai", "bangalore"],
    default: "gurugram",
  },
  remarks: String,
}, { timestamps: true });

export default mongoose.model("RentalProduct", productSchema);
