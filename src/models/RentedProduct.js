import mongoose from "mongoose";



const rentalSchema = new mongoose.Schema(

  {

    productId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalProduct" },

    customer: {
      name: { type: String, required: true },
      companyName: String,
      email: String,
      phone: String,
      gstNumber: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
      },
    },

    returnedAt: Date,                    // when the item was returned
    returnNotes: String,                 // optional remarks
    totalRentCollected: { type: Number, default: 0 },

    rentStartDate: Date,

    rentEndDate: Date,

    rentAmount: Number,

    securityDeposit: Number,

    billingCycle: { type: String, default: "monthly" },

    status: { type: String, enum: ["active", "returned"], default: "active" },

    documents: [
      {
        name: String,
        fileUrl: String,
      },
    ],

  },
  { timestamps: true }
);

export default mongoose.model("RentedProduct", rentalSchema);
