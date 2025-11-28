// import mongoose from "mongoose";
// import RentedProduct from "../models/RentedProduct.js";

// /**
//  * Build query filters from request query params
//  */
// const buildFilters = (q) => {
//   const filters = {};

//   // status filter
//   if (q.status && q.status !== "All") {
//     filters.status = q.status;
//   }

//   // search filter (customer fields)
//   if (q.search) {
//     const regex = new RegExp(q.search, "i");
//     filters.$or = [
//       { "customer.name": regex },
//       { "customer.companyName": regex },
//       { "customer.email": regex },
//       { "customer.phone": regex },
//       { "customer.gstNumber": regex },
//     ];

//     // Optional: if a valid ObjectId, allow direct productId search
//     if (mongoose.isValidObjectId(q.search)) {
//       filters.$or.push({ productId: q.search });
//     }
//   }

//   // optional productId filter via query
//   if (q.productId && mongoose.isValidObjectId(q.productId)) {
//     filters.productId = q.productId;
//   }

//   return filters;
// };

// /**
//  * Parse sort from query. Examples:
//  *  - createdAt_desc (default)
//  *  - createdAt_asc
//  *  - rentAmount_desc
//  */
// const parseSort = (sortStr) => {
//   if (!sortStr) return { createdAt: -1 };
//   const [field, dir] = sortStr.split("_");
//   return { [field]: dir === "asc" ? 1 : -1 };
// };

// // @desc    Create a rental record
// // @route   POST /api/rentals
// // @access  Private (set per your auth)
// export const createRentedProduct = async (req, res, next) => {
//   try {
//     const {
//       productId,
//       customer,
//       rentStartDate,
//       rentEndDate,
//       rentAmount,
//       securityDeposit,
//       billingCycle,
//       status,
//       documents,
//     } = req.body;

//     if (!productId) {
//       return res.status(400).json({ message: "productId is required" });
//     }

//     const doc = await RentedProduct.create({
//       productId,
//       customer,
//       rentStartDate,
//       rentEndDate,
//       rentAmount,
//       securityDeposit,
//       billingCycle,
//       status,
//       documents,
//     });

//     // optionally populate the linked product
//     await doc.populate("productId");
//     res.status(201).json(doc);
//   } catch (err) {
//     next(err);
//   }
// };

// // @desc    Get rentals (list) with pagination, search, filter, sort
// // @route   GET /api/rentals
// // @access  Private
// export const getRentedProducts = async (req, res, next) => {
//   try {
//     const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
//     const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
//     const skip = (page - 1) * limit;

//     const filters = buildFilters(req.query);
//     const sort = parseSort(req.query.sort);

//     const [items, total] = await Promise.all([
//       RentedProduct.find(filters)
//         .populate("productId")
//         .sort(sort)
//         .skip(skip)
//         .limit(limit),
//       RentedProduct.countDocuments(filters),
//     ]);

//     res.json({
//       items,
//       pagination: {
//         page,
//         limit,
//         total,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // @desc    Get a single rental by ID
// // @route   GET /api/rentals/:id
// // @access  Private
// export const getRentedProductById = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ message: "Invalid rental id" });
//     }

//     const doc = await RentedProduct.findById(id).populate("productId");
//     if (!doc) return res.status(404).json({ message: "Rental not found" });

//     res.json(doc);
//   } catch (err) {
//     next(err);
//   }
// };

// // @desc    Update a rental by ID
// // @route   PUT /api/rentals/:id
// // @access  Private
// export const updateRentedProduct = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ message: "Invalid rental id" });
//     }

//     const update = { ...req.body };

//     // prevent changing _id
//     delete update._id;

//     const doc = await RentedProduct.findByIdAndUpdate(id, update, {
//       new: true,
//       runValidators: true,
//     }).populate("productId");

//     if (!doc) return res.status(404).json({ message: "Rental not found" });

//     res.json(doc);
//   } catch (err) {
//     next(err);
//   }
// };

// // @desc    Delete a rental by ID
// // @route   DELETE /api/rentals/:id
// // @access  Private
// export const deleteRentedProduct = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ message: "Invalid rental id" });
//     }

//     const doc = await RentedProduct.findById(id);
//     if (!doc) return res.status(404).json({ message: "Rental not found" });

//     await doc.deleteOne();
//     res.json({ message: "Rental deleted" });
//   } catch (err) {
//     next(err);
//   }
// };


// controllers/rentedProductController.js
import mongoose from "mongoose";
import RentedProduct from "../models/RentedProduct.js";
import RentalProduct from "../models/RentalProduct.js";

/** filters */
const buildFilters = (q) => {
  const filters = {};

  if (q.status && q.status !== "All") {
    filters.status = q.status;
  }

  if (q.search) {
    const regex = new RegExp(q.search, "i");
    filters.$or = [
      { "customer.name": regex },
      { "customer.companyName": regex },
      { "customer.email": regex },
      { "customer.phone": regex },
      { "customer.gstNumber": regex },
    ];
    if (mongoose.isValidObjectId(q.search)) {
      filters.$or.push({ productId: q.search });
    }
  }

  if (q.productId && mongoose.isValidObjectId(q.productId)) {
    filters.productId = q.productId;
  }

  return filters;
};

const parseSort = (sortStr) => {
  if (!sortStr) return { createdAt: -1 };
  const [field, dir] = sortStr.split("_");
  return { [field]: dir === "asc" ? 1 : -1 };
};

// POST /api/rentals


export const createRentedProductwithoutreturn = async (req, res, next) => {
  try {
    const {
      productId,
      customer,
      rentStartDate,
      rentEndDate,
      rentAmount,
      securityDeposit,
      billingCycle,
      status,
      documents,
    } = req.body;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Valid productId is required" });
    }

    // Create the rental record
    const rental = await RentedProduct.create({
      productId,
      customer,
      rentStartDate,
      rentEndDate,
      rentAmount,
      securityDeposit,
      billingCycle,
      status,
      documents,
    });

    // ✅ Update the product status to "rented"
    await RentalProduct.findByIdAndUpdate(productId, { status: "rented" });

    //✅ Populate product data before returning

    await rental.populate("productId");

    res.status(201).json(rental);
  } catch (err) {
    next(err);
  }
};


// with return functionality
export const createRentedProduct = async (req, res, next) => {
  try {
    const {
      productId, customer, rentStartDate, rentEndDate,
      rentAmount, securityDeposit, billingCycle, status, documents,
      // return fields if they send returned on create (rare)
      returnedAt, returnNotes, totalRentCollected,
    } = req.body;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Valid productId is required" });
    }

    // if status is returned at creation, require return details
    if (status === "returned") {
      if (!returnedAt) return res.status(400).json({ message: "returnedAt is required when status is returned" });
    }

    const doc = await RentedProduct.create({
      productId,
      customer,
      rentStartDate,
      rentEndDate,
      rentAmount,
      securityDeposit,
      billingCycle,
      status: status || "active",
      documents,
      returnedAt: status === "returned" ? returnedAt : undefined,
      returnNotes: status === "returned" ? returnNotes : undefined,
      totalRentCollected: status === "returned" ? Number(totalRentCollected || 0) : 0,
    });

    // set product to rented only if rental is active
    if (status !== "returned") {
      await RentalProduct.findByIdAndUpdate(productId, { status: "rented" });
    }

    await doc.populate("productId");
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};





export const getRentedProducts = async (req, res, next) => {
  try {
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    const filters = buildFilters(req.query);
    const sort = parseSort(req.query.sort);

    const [items, total] = await Promise.all([
      RentedProduct.find(filters).populate("productId").sort(sort).skip(skip).limit(limit),
      RentedProduct.countDocuments(filters),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/rentals/:id
export const getRentedProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid rental id" });
    }
    const doc = await RentedProduct.findById(id).populate("productId");
    if (!doc) return res.status(404).json({ message: "Rental not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

// PUT /api/rentals/:id
export const updateRentedProductwithoutrent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid rental id" });
    }

    const update = { ...req.body };
    delete update._id;

    if (update.productId && !mongoose.isValidObjectId(update.productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const doc = await RentedProduct.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).populate("productId");

    if (!doc) return res.status(404).json({ message: "Rental not found" });

    res.json(doc);
  } catch (err) {
    next(err);
  }
};


export const updateRentedProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rental = await RentedProduct.findById(id);
    if (!rental) return res.status(404).json({ message: "Rental not found" });

    const prevStatus = rental.status;
    const nextStatus = req.body.status ?? rental.status;

    // If moving to returned, require returnedAt
    if (prevStatus !== "returned" && nextStatus === "returned") {
      if (!req.body.returnedAt) {
        return res.status(400).json({ message: "returnedAt is required when marking as returned" });
      }
      rental.returnedAt = new Date(req.body.returnedAt);
      rental.totalRentCollected = Number(req.body.totalRentCollected || 0);
      rental.returnNotes = req.body.returnNotes || "";
    }

    // patch basic fields
    const allowed = [
      "customer","rentStartDate","rentEndDate","rentAmount","securityDeposit",
      "billingCycle","status","documents"
    ];
    for (const k of allowed) {
      if (k in req.body) rental[k] = req.body[k];
    }

    await rental.save();

    // sync product status:
    if (prevStatus !== "returned" && nextStatus === "returned") {
      await RentalProduct.findByIdAndUpdate(rental.productId, { status: "available" });
    } else if (prevStatus === "returned" && nextStatus === "active") {
      await RentalProduct.findByIdAndUpdate(rental.productId, { status: "rented" });
    }

    const populated = await RentedProduct.findById(id).populate("productId");
    res.json(populated);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rentals/:id
export const deleteRentedProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid rental id" });
    }
    const doc = await RentedProduct.findById(id);
    if (!doc) return res.status(404).json({ message: "Rental not found" });

    await doc.deleteOne();
    res.json({ message: "Rental deleted" });
  } catch (err) {
    next(err);
  }
};
