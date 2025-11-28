

// controllers/rentalProductController.js
import Contract from "../models/Contract.js";
import RentalProduct from "../models/RentalProduct.js";
import User from "../models/User.js";
import { getNextSeq } from "../utils/seq.js";




// GET /api/rental-products
// Query params:
//   page=1&limit=10
//   search=laptop
//   status=Active
//   category=Computers
//   minPrice=1000&maxPrice=5000
//   inStock=true
//   sort=newest|oldest|price_asc|price_desc|name_asc|name_desc


export const getAllProducts = async (req, res) => {
  try {
    // 1) Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    // 2) Filters
    const {
      search,
      status,           // e.g., 'Active' | 'Inactive'
      category,         // category name or id, depending on your schema
      minPrice,
      maxPrice,
      inStock,          // 'true' | 'false'
    } = req.query;

    const filter = {};

    // Example: exact status filter
    if (status && status !== "All") {
      filter.status = status;
    }

    // Example: exact category filter (adapt to your schema)
    if (category && category !== "All") {
      // If your model stores category as string name:
      filter.category = category;
      // If it stores ObjectId, convert accordingly:
      // filter.category = new Types.ObjectId(category);
    }

    // Example: stock filter
    if (typeof inStock !== "undefined") {
      const wantInStock = String(inStock).toLowerCase() === "true";
      // If you store `stock` number:
      filter.stock = wantInStock ? { $gt: 0 } : { $lte: 0 };
      // Or if you store boolean field e.g. `isAvailable`, then:
      // filter.isAvailable = wantInStock;
    }

    // Price range (adapt to your price field e.g. price, srp, rentalPrice)
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      // Change 'price' to your real field name:
      filter.price = priceFilter;
    }

    // 3) Search across multiple fields using case-insensitive regex
    if (search && search.trim() !== "") {
      const q = search.trim();
      filter.$or = [
        { productName: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { oem: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
        // If tags is an array of strings, use:
        // { tags: { $elemMatch: { $regex: q, $options: "i" } } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    // 4) Sorting
    const sortKey = (req.query.sort || "newest").toLowerCase();
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.newest;

    // 5) Query + total
    const [total, products] = await Promise.all([
      RentalProduct.countDocuments(filter),
      RentalProduct.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'contractId',
          select: 'contractNumber startDate endDate status terms',
        })
        .populate({
          path: 'rentedTo',
          select: 'name email company mobile',
        })
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        sort: sortKey,
        filtersApplied: {
          search: search || null,
          status: status || null,
          category: category || null,
          minPrice: minPrice ? Number(minPrice) : null,
          maxPrice: maxPrice ? Number(maxPrice) : null,
          inStock: typeof inStock !== "undefined" ? inStock === "true" : null,
        },
      },
    });
  } catch (err) {
    console.error("getAllProducts error:", err);
    res.status(500).json({ error: err.message });
  }
};




const COLLECTED_STATUSES = ['COMPLETED'];             // only fully completed / paid
const PROJECTED_STATUSES = ['COMPLETED', 'ACTIVE'];   // completed + ongoing

export const getProductById = async (req, res) => {
  try {
    const assetId = req.params.id?.trim();
    console.log('getProductById assetId:', assetId);

    // 1) Find asset by assetId in RentalProduct
    const product = await RentalProduct.findOne({ assetId }).lean();
    console.log('getProductById product:', product);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }


    // 2) In parallel:
    //    - load current contract (if any)
    //    - calculate totalRentCollected (completed)
    //    - calculate projectedTotalRent (completed + active)

    const [contractDoc, collectedAgg, projectedAgg] = await Promise.all([
      product.contractId
        ? Contract.findById(product.contractId)
            .populate('customer', 'name company email phone mobile')
            .lean()
        : Promise.resolve(null),

      // ✅ totalRentCollected = sum of rent from COMPLETED contracts only
      Contract.aggregate([
        {
          $match: {
            status: { $in: COLLECTED_STATUSES },
            'assets.assetId': assetId,
          },
        },
        { $unwind: '$assets' },
        {
          $match: {
            'assets.assetId': assetId,
          },
        },
        {
          $group: {
            _id: null,
            // 👇 CHANGE THIS if your field is different (e.g. 'assets.rentAmount')
            totalRent: { $sum: '$assets.monthlyRent' },
          },
        },
      ]),

      // projectedTotalRent = COMPLETED + ACTIVE full contract rent

      Contract.aggregate([
        {
          $match: {
            status: { $in: PROJECTED_STATUSES },
            'assets.assetId': assetId,
          },
        },
        { $unwind: '$assets' },
        {
          $match: {
            'assets.assetId': assetId,
          },
        },
        {
          $group: {
            _id: null,
            // 👇 same field as above
            projectedTotalRent: { $sum: '$assets.monthlyRent' },
          },
        },
      ]),
    ]);


    console.log("collected",collectedAgg);

    console.log("projectedAgg",projectedAgg);


    let contract = contractDoc || null;
    let customer = null;

    // 3) Prefer customer from contract if present
    if (contract && contract.customer) {
      customer = contract.customer;
    }

    // 4) Fallback: if no customer yet and product.rentedTo is a user id
    if (!customer && product.rentedTo) {
      customer = await User.findById(product.rentedTo)
        .select('name company email phone mobile')
        .lean();
    }



    // 5) Extract rent stats (default 0 if nothing found)

    const totalRentCollected = collectedAgg[0]?.totalRent || 0;
    const projectedTotalRent = projectedAgg[0]?.projectedTotalRent || 0;


    // 6) Return combined response
    res.json({
      data: {
        ...product,
        contract,            // current contract document (or null)
        customer,            // resolved customer (or null)
        totalRentCollected,  // 💰 only COMPLETED / paid contracts
        projectedTotalRent,  // 💡 COMPLETED + ACTIVE full contract amounts
      },
    });
  } catch (err) {
    console.error('getProductById error:', err);
    res.status(500).json({ error: err.message });
  }
};





// =================== DELETE PRODUCT ===================
export const deleteProduct = async (req, res) => {
  try {
    const deleted = await RentalProduct.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---- category code + yyyyMM helpers ---- */
function categoryToCode(cat = "") {
  const c = String(cat).toLowerCase();
  if (c.includes("laptop") || c === "lap" || c === "notebook") return "LAP";
  if (c.includes("desktop") || c === "pc") return "DES";
  if (c.includes("server")) return "SRV";
  if (c.includes("switch")) return "SWH";
  if (c.includes("router")) return "RTR";
  if (c.includes("monitor") || c.includes("display")) return "MON";
  if (c.includes("printer")) return "PRN";
  return "OTH";
}

function yyyyMM(d) {
  const date = d ? new Date(d) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}


/* =================== CREATE PRODUCT =================== */
export const addProduct = async (req, res) => {
  try {
    const body = { ...req.body };

    // assetId must be generated by backend; ignore any client-provided value
    delete body.assetId;

    // derive period from purchaseDate (fallback: now)
    const period = yyyyMM(body.purchaseDate);

    // derive category code
    const code = categoryToCode(body.category);

    // atomic sequence per code+period
    const counterKey = `${code}-${period}`;
    const seq = await getNextSeq(counterKey);
    const nnn = String(seq).padStart(3, "0");

    body.assetId = `T4L-${code}-${period}-${nnn}`;

    const product = await RentalProduct.create(body);
    res.status(201).json(product);
  } catch (err) {
    console.error("addProduct error:", err);
    // Handle duplicate key gracefully (very rare with atomic counter, but safe)
    if (err.code === 11000 && err.keyPattern?.assetId) {
      return res
        .status(409)
        .json({ error: "Collision on assetId. Please retry." });
    }
    res.status(400).json({ error: err.message });
  }
};


/* =================== UPDATE PRODUCT =================== */
export const updateProduct = async (req, res) => {
  try {
    const body = { ...req.body };

    // Do NOT allow assetId to change after creation
    if ("assetId" in body) delete body.assetId;

    // Optional: also prevent changing category/purchaseDate
    // (since assetId was derived from them)
    // delete body.category;
    // delete body.purchaseDate;

    const updated = await RentalProduct.findByIdAndUpdate(req.params.id, body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};