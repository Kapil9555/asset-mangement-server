// // controllers/dashboardController.js
// import mongoose from "mongoose";
// import RentalProduct from "../models/RentalProduct.js";     
// import RentedProduct from "../models/RentedProduct.js";

// /* ---------- date helpers ---------- */
// function startOfDay(d = new Date()) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }
// function endOfDay(d = new Date()) {
//   const x = new Date(d);
//   x.setHours(23, 59, 59, 999);
//   return x;
// }
// function startOfMonth(d = new Date()) {
//   const x = new Date(d.getFullYear(), d.getMonth(), 1);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }
// function daysBack(n) {
//   const d = new Date();
//   d.setDate(d.getDate() - n);
//   return d;
// }

// /* Build a fixed 7-day bucket array (oldest→newest) */
// function build7DayBuckets() {
//   const out = [];
//   for (let i = 6; i >= 0; i--) {
//     const day = startOfDay(daysBack(i));
//     out.push({
//       key: day.toISOString().slice(0, 10), // YYYY-MM-DD
//       start: day,
//       end: endOfDay(day),
//     });
//   }
//   return out;
// }

// export const getDashboard = async (req, res, next) => {
//   try {
//     // SUMMARY
//     const [
//       totalProducts,
//       availableProducts,
//       rentedItems,
//       activeRentals,
//     ] = await Promise.all([
//       RentalProduct.countDocuments({}),
//       RentalProduct.countDocuments({ status: "available" }),
//       RentalProduct.countDocuments({ status: "rented" }),
//       RentedProduct.countDocuments({ status: "active" }),
//     ]);

//     // Revenue periods (based on rentStartDate, fallback to createdAt)
//     const todayStart = startOfDay();
//     const todayEnd = endOfDay();
//     const monthStart = startOfMonth();

//     const revenueMatchBase = {
//       status: { $in: ["active", "returned"] }, // count rentals that started
//       $or: [
//         { rentStartDate: { $exists: true } },
//         { createdAt: { $exists: true } },
//       ],
//     };

//     const [revMTDRow] = await RentedProduct.aggregate([
//       {
//         $addFields: {
//           effectiveDate: {
//             $ifNull: ["$rentStartDate", "$createdAt"],
//           },
//         },
//       },
//       {
//         $match: {
//           ...revenueMatchBase,
//           effectiveDate: { $gte: monthStart, $lte: todayEnd },
//         },
//       },
//       { $group: { _id: null, total: { $sum: "$rentAmount" } } },
//       { $project: { _id: 0, total: 1 } },
//     ]);

//     const [revTodayRow] = await RentedProduct.aggregate([
//       {
//         $addFields: {
//           effectiveDate: {
//             $ifNull: ["$rentStartDate", "$createdAt"],
//           },
//         },
//       },
//       {
//         $match: {
//           ...revenueMatchBase,
//           effectiveDate: { $gte: todayStart, $lte: todayEnd },
//         },
//       },
//       { $group: { _id: null, total: { $sum: "$rentAmount" } } },
//       { $project: { _id: 0, total: 1 } },
//     ]);

//     const revenueMTD = revMTDRow?.total || 0;
//     const revenueToday = revTodayRow?.total || 0;

//     // TRENDS (last 7 days): revenue per day (sum of rentAmount), rentals per day (count)
//     const sevenStart = startOfDay(daysBack(6));
//     const buckets = build7DayBuckets();

//     const perDayAgg = [
//       {
//         $addFields: {
//           effectiveDate: { $ifNull: ["$rentStartDate", "$createdAt"] },
//         },
//       },
//       {
//         $match: {
//           status: { $in: ["active", "returned"] },
//           $or: [
//             { rentAmount: { $exists: true } },
//             { rentAmount: { $eq: null } }, // still include to count rentals
//           ],
//           effectiveDate: { $gte: sevenStart, $lte: todayEnd },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             d: {
//               $dateToString: { format: "%Y-%m-%d", date: "$effectiveDate" },
//             },
//           },
//           revenue: { $sum: { $ifNull: ["$rentAmount", 0] } },
//           count: { $sum: 1 },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           day: "$_id.d",
//           revenue: 1,
//           count: 1,
//         },
//       },
//     ];

//     const perDay = await RentedProduct.aggregate(perDayAgg);
//     const revenueMap = new Map(perDay.map((r) => [r.day, r.revenue]));
//     const countMap = new Map(perDay.map((r) => [r.day, r.count]));

//     const revenue7d = buckets.map((b) => Number(revenueMap.get(b.key) || 0));
//     const rentals7d = buckets.map((b) => Number(countMap.get(b.key) || 0));

//     // RECENT LISTS
//     const recentRentalsRaw = await RentedProduct.find({})
//       .sort({ createdAt: -1 })
//       .limit(8)
//       .populate("productId", "productName name model brand"); 

//     const recentProductsRaw = await RentalProduct.find({})
//       .sort({ updatedAt: -1 })
//       .limit(8)
//       .select("productName brand model status purchasePrice createdAt updatedAt");

//     const recentRentals = recentRentalsRaw.map((r) => ({
//       _id: r._id,
//       productName:
//         r?.productId?.productName ||
//         r?.productId?.name ||
//         r?.productId?.model ||
//         String(r?.productId?._id || ""),
//       customerName: r?.customer?.name || "-",
//       rentAmount: Number(r?.rentAmount || 0),
//       status: r?.status || "active",
//       startDate: r?.rentStartDate || r?.createdAt,
//       endDate: r?.rentEndDate || null,
//     }));

//     const recentProducts = recentProductsRaw.map((p) => ({
//       _id: p._id,
//       productName: p.productName,
//       brand: p.brand,
//       model: p.model,
//       status: p.status,
//       purchasePrice: p.purchasePrice,
//       createdAt: p.createdAt,
//       updatedAt: p.updatedAt,
//     }));

//     res.json({
//       summary: {
//         totalProducts,
//         availableProducts,
//         rentedItems,
//         activeRentals,
//         revenueMTD,
//         revenueToday,
//       },
//       trends: {
//         revenue7d,
//         rentals7d,
//       },
//       recent: {
//         rentals: recentRentals,
//         products: recentProducts,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };


// controllers/dashboardController.js
import RentalProduct from "../models/RentalProduct.js";
import RentedProduct from "../models/RentedProduct.js";
import Contract from "../models/Contract.js";

/* ---------- date helpers ---------- */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysBack(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/* Build a fixed 7-day bucket array (oldest→newest) */
function build7DayBuckets() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const day = startOfDay(daysBack(i));
    out.push({
      key: day.toISOString().slice(0, 10), // YYYY-MM-DD
      start: day,
      end: endOfDay(day),
    });
  }
  return out;
}

export const getDashboard = async (req, res, next) => {
  try {
    // SUMMARY COUNTS (assets + rentals)
    const [
      totalProducts,
      availableProducts,
      rentedItems,
      activeRentals,
      maintenanceCount,
      retiredCount,
    ] = await Promise.all([
      RentalProduct.countDocuments({}),
      RentalProduct.countDocuments({ status: "available" }),
      RentalProduct.countDocuments({ status: "rented" }),
      RentedProduct.countDocuments({ status: "active" }),
      RentalProduct.countDocuments({ status: "maintenance" }),
      RentalProduct.countDocuments({ status: "retired" }),
    ]);

    // "Active assets" = not retired (available + rented + maintenance)
    const activeAssets = totalProducts - retiredCount;

    // Revenue periods (based on rentStartDate, fallback to createdAt)
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const monthStart = startOfMonth();

    const revenueMatchBase = {
      status: { $in: ["active", "returned"] },
      $or: [
        { rentStartDate: { $exists: true } },
        { createdAt: { $exists: true } },
      ],
    };

    const [revMTDRow] = await RentedProduct.aggregate([
      {
        $addFields: {
          effectiveDate: { $ifNull: ["$rentStartDate", "$createdAt"] },
        },
      },
      {
        $match: {
          ...revenueMatchBase,
          effectiveDate: { $gte: monthStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$rentAmount" } } },
      { $project: { _id: 0, total: 1 } },
    ]);

    const [revTodayRow] = await RentedProduct.aggregate([
      {
        $addFields: {
          effectiveDate: { $ifNull: ["$rentStartDate", "$createdAt"] },
        },
      },
      {
        $match: {
          ...revenueMatchBase,
          effectiveDate: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$rentAmount" } } },
      { $project: { _id: 0, total: 1 } },
    ]);

    const revenueMTD = revMTDRow?.total || 0;
    const revenueToday = revTodayRow?.total || 0;

    // TRENDS (last 7 days): revenue & rentals per day
    const sevenStart = startOfDay(daysBack(6));
    const buckets = build7DayBuckets();

    const perDayAgg = [
      {
        $addFields: {
          effectiveDate: { $ifNull: ["$rentStartDate", "$createdAt"] },
        },
      },
      {
        $match: {
          status: { $in: ["active", "returned"] },
          effectiveDate: { $gte: sevenStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: {
            d: {
              $dateToString: { format: "%Y-%m-%d", date: "$effectiveDate" },
            },
          },
          revenue: { $sum: { $ifNull: ["$rentAmount", 0] } },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          day: "$_id.d",
          revenue: 1,
          count: 1,
        },
      },
    ];

    const perDay = await RentedProduct.aggregate(perDayAgg);
    const revenueMap = new Map(perDay.map((r) => [r.day, r.revenue]));
    const countMap = new Map(perDay.map((r) => [r.day, r.count]));

    const revenue7d = buckets.map((b) => Number(revenueMap.get(b.key) || 0));
    const rentals7d = buckets.map((b) => Number(countMap.get(b.key) || 0));

    // STATUS BREAKDOWN (for donut)
    const statusBreakdown = {
      available: availableProducts,
      rented: rentedItems,
      maintenance: maintenanceCount,
      retired: retiredCount,
    };

    // CATEGORY BREAKDOWN (for bar chart)
    const categoryAgg = await RentalProduct.aggregate([
      {
        $group: {
          _id: "$category", // adjust if your field name differs
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const categoryBreakdown = categoryAgg.map((c) => ({
      name: c._id || "Uncategorized",
      count: c.count,
    }));

    // RECENT CONTRACTS
    const recentContractsRaw = await Contract.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("customer", "name company");

    const recentProductsRaw = await RentalProduct.find({})
      .sort({ updatedAt: -1 })
      .limit(8)
      .select(
        "productName brand model status purchasePrice createdAt updatedAt"
      );

    const recentContracts = recentContractsRaw.map((c) => {
      let customerName = "—";
      if (typeof c.customer === "string") {
        customerName = c.customer;
      } else if (c.customer) {
        customerName =
          c.customer.name ||
          c.customer.company ||
          String(c.customer._id || "—");
      }

      return {
        _id: c._id,
        contractId: c.contractId,
        customerName,
        monthlyRent: Number(c.monthlyRent || 0),
        status: c.status || "ACTIVE",
        startDate: c.startDate,
        endDate: c.endDate || null,
      };
    });

    const recentProducts = recentProductsRaw.map((p) => ({
      _id: p._id,
      productName: p.productName,
      brand: p.brand,
      model: p.model,
      status: p.status,
      purchasePrice: p.purchasePrice,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    // RESPONSE
    res.json({
      summary: {
        totalProducts,
        activeAssets,
        maintenanceCount,
        retiredCount,
        availableProducts,
        rentedItems,
        activeRentals,
        revenueMTD,
        revenueToday,
      },
      trends: {
        revenue7d,
        rentals7d,
      },
      charts: {
        status: statusBreakdown,
        categories: categoryBreakdown,
      },
      recent: {
        contracts: recentContracts,
        products: recentProducts,
      },
    });
  } catch (err) {
    next(err);
  }
};
