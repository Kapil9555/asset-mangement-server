import Contract from '../models/Contract.js';
import RentalProduct from '../models/RentalProduct.js';
import { nextContractId } from '../utils/ids.js';
import { paginate } from '../utils/paginate.js';
import mongoose from 'mongoose';

// const Contract = require('../models/Contract');
// const Invoice  = require('../models/Invoice');
// const paginate = require('../utils/paginate');

const STATUS = {
  ACTIVE_CONTRACT: 'ACTIVE',
  AVAILABLE_ASSET: 'available',
  RENTED_ASSET: 'rented',
};


/* ---------- transaction helper (safe on standalone) ---------- */
async function withTxIfSupported(workFn) {
  const conn = mongoose.connection;
  let session = null;
  let useTx = false;

  try {
    // Check if this server is a replica set (has setName in hello/ismaster)
    const hello = await conn.db.admin().command({ hello: 1 }).catch(() => null);
    useTx = !!hello?.setName;

    if (useTx) {
      session = await conn.startSession();
      session.startTransaction();
    }

    const result = await workFn(session);

    if (useTx && session.inTransaction()) {
      await session.commitTransaction();
    }
    return result;
  } catch (err) {
    if (session?.inTransaction()) {
      try { await session.abortTransaction(); } catch {}
    }
    throw err;
  } finally {
    if (session) await session.endSession();
  }
}

/* ----------------------- helpers ----------------------- */
async function markAssetsRented(
  assetIds = [],
  contractId,
  { rentedTo = null, rentedFrom = null, rentedTill = null } = {},
  session = null
) {
  if (!assetIds?.length) return;
  await RentalProduct.updateMany(
    { assetId: { $in: assetIds } },
    {
      $set: {
        status: STATUS.RENTED_ASSET,
        contractId: contractId ?? null,
        rentedTo,
        rentedFrom,
        rentedTill,
      },
    },
    session ? { session } : {}
  );
}

async function tryReleaseAssets(assetIds = [], ignoreContractId, session = null) {
  if (!assetIds?.length) return;

  const baseFilter = {
    _id: { $ne: ignoreContractId },
    status: STATUS.ACTIVE_CONTRACT,
    'assets.assetId': { $in: assetIds },
  };

  const q = Contract.distinct('assets.assetId', baseFilter);
  const stillReferenced = session ? await q.session(session) : await q;

  const keepSet = new Set(stillReferenced);
  const toRelease = assetIds.filter(aid => !keepSet.has(aid));
  if (!toRelease.length) return;

  await RentalProduct.updateMany(
    { assetId: { $in: toRelease } },
    {
      $set: {
        status: STATUS.AVAILABLE_ASSET,
        contractId: null,
        rentedTo: null,
        rentedFrom: null,
        rentedTill: null,
      },
    },
    session ? { session } : {}
  );
}


/* ----------------------- Contracts ----------------------- */
export const getContractsss = async (req, res, next) => {
    try {
        const { search = '', status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (search) {
            const q = new RegExp(search, 'i');
            filter.$or = [{ contractId: q }, { notes: q }];
        }

        const result = await paginate(Contract, {
            filter,
            page,
            limit,
            sort: '-createdAt',
          
        });


        res.json(result);
    } catch (e) {
        next(e);
    }
};

export const getContracts = async (req, res, next) => {
    try {
        const { search = '', status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        if (search) {
            const q = new RegExp(search, 'i');
            filter.$or = [
                { contractId: q },
                { notes: q }
            ];
        }

        // Fetch with pagination but ALSO populate customer
        const result = await paginate(Contract, {
            filter,
            page,
            limit,
            sort: '-createdAt',
            populate: [
                {
                    path: 'customer',
                    select: 'name companyName email'
                }
            ]
        });

        // Transform docs → add `customerName` field
        const updatedDocs = result?.docs?.map((c) => ({
            ...c.toObject(),
            customer: c.customer?._id || c.customer,     // original ID
            customerName: c.customer?.name || c.customer?.companyName || "N/A"
        }));

        // return with modified docs
        res.json({
            ...result,
            docs: updatedDocs
        });

    } catch (e) {
        next(e);
    }
};




export const createContract = async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (body.autoSumFromAssets && Array.isArray(body.assets)) {
      body.monthlyRent = body.assets.reduce((s, a) => s + Number(a.monthlyRent || 0), 0);
    }

    const created = await withTxIfSupported(async (session) => {
      // Use array form of create when passing a session
       const contractId = await nextContractId(); 
       console.log("id check",contractId)
      const docs = await Contract.create(
        [{ ...body,contractId}],
        session ? { session } : {}
      );
      const c = docs[0];

      //   console.log("Created contract:", c);

      if (c.status === STATUS.ACTIVE_CONTRACT && Array.isArray(c.assets) && c.assets.length) {

        const assetIds = c.assets.map(a => a.assetId).filter(Boolean);

        await markAssetsRented(
          assetIds,
          c._id,
          {
            rentedTo: c.customer || null,
            rentedFrom: c.startDate || null,
            rentedTill: c.endDate || null,
          },
          session
        );

      }
      return c;
    });

    res.status(201).json({ data: created });
  } catch (e) { next(e); }
};



export const updateContract = async (req, res, next) => {
  try {
    const idOrCode = req.params.id;
    const body = { ...req.body };
    delete body.version;
    delete body.__v;

    const updated = await withTxIfSupported(async (session) => {
      const prevQ = Contract.findOne({
        $or: [{ _id: idOrCode }, { contractId: idOrCode }],
      }).select('status assets contractId startDate endDate customer');
      const prev = session ? await prevQ.session(session).lean() : await prevQ.lean();

      if (!prev) throw Object.assign(new Error('Contract not found'), { statusCode: 404 });

      if (body.autoSumFromAssets && Array.isArray(body.assets)) {
        body.monthlyRent = body.assets.reduce((s, a) => s + Number(a.monthlyRent || 0), 0);
      }

      const updQ = Contract.findOneAndUpdate(
        { $or: [{ _id: idOrCode }, { contractId: idOrCode }] },
        { $set: body, $inc: { version: 1 } },
        { new: true }
      );
      const updated = session ? await updQ.session(session) : await updQ;

      const prevStatus = prev.status;
      const nextStatus = updated.status;

      const prevAssets = (prev.assets || []).map(a => a.assetId).filter(Boolean);
      const nextAssets = (updated.assets || []).map(a => a.assetId).filter(Boolean);
      const prevSet = new Set(prevAssets);
      const nextSet = new Set(nextAssets);

      const removedAssets = prevAssets.filter(a => !nextSet.has(a));
      const addedAssets  = nextAssets.filter(a => !prevSet.has(a));

      if (prevStatus !== STATUS.ACTIVE_CONTRACT && nextStatus === STATUS.ACTIVE_CONTRACT) {
        if (nextAssets.length) {
          await markAssetsRented(
            nextAssets,
            updated._id,
            {
              rentedTo: updated.customer || null,
              rentedFrom: updated.startDate || null,
              rentedTill: updated.endDate || null,
            },
            session
          );
        }
      }

      if (prevStatus === STATUS.ACTIVE_CONTRACT && nextStatus !== STATUS.ACTIVE_CONTRACT) {
        if (prevAssets.length) await tryReleaseAssets(prevAssets, updated._id, session);
      }

      if (prevStatus === STATUS.ACTIVE_CONTRACT && nextStatus === STATUS.ACTIVE_CONTRACT) {
        if (addedAssets.length) {
          await markAssetsRented(
            addedAssets,
            updated._id,
            {
              rentedTo: updated.customer || null,
              rentedFrom: updated.startDate || null,
              rentedTill: updated.endDate || null,
            },
            session
          );
        }
        if (removedAssets.length) await tryReleaseAssets(removedAssets, updated._id, session);
      }

      return updated;
    });

    res.json({ data: updated });
  } catch (e) {
    if (e.statusCode === 404) return res.status(404).json({ message: 'Contract not found' });
    next(e);
  }
};



export const deleteContract = async (req, res, next) => {
  try {
    const idOrCode = req.params.id;

    await withTxIfSupported(async (session) => {
      const findQ = Contract.findOne({
        $or: [{ _id: idOrCode }, { contractId: idOrCode }],
      });
      const doc = session ? await findQ.session(session) : await findQ;

      if (!doc) throw Object.assign(new Error('Contract not found'), { statusCode: 404 });

      const wasActive = doc.status === STATUS.ACTIVE_CONTRACT;
      const assetIds = (doc.assets || []).map(a => a.assetId).filter(Boolean);

      const delQ = Contract.deleteOne({ _id: doc._id });
      session ? await delQ.session(session) : await delQ;

      if (wasActive && assetIds.length) {
        await tryReleaseAssets(assetIds, doc._id, session);
      }
    });

    res.json({ success: true });
  } catch (e) {
    if (e.statusCode === 404) return res.status(404).json({ message: 'Contract not found' });
    next(e);
  }
};


/* ----------------------- Invoices ------------------------ */
export const getInvoices = async (req, res, next) => {
    try {
        const { status, assetId, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (assetId) filter.assetId = new RegExp(`^${assetId}`, 'i');

        const result = await paginate(Contract, {
            filter, page, limit, sort: '-createdAt',
            populate: [{ path: 'contract', select: 'customer' }],
        });

        // expand nested to match table render: contract.customer -> name/company string-ish
        result.data = await Promise.all(result.data.map(async (inv) => {
            const contract = await Contract.findById(inv.contract).populate('customer', 'name company').lean();
            return {
                ...inv,
                contract: { customer: contract?.customer?.name || '' },
            };
        }));

        res.json(result);
    } catch (e) { next(e); }
};



export const updateInvoice = async (req, res, next) => {
    try {
        const idOrCode = req.params.id;
        const patch = req.body;

        const inv = await Contract.findOneAndUpdate(
            { $or: [{ _id: idOrCode }, { invoiceId: idOrCode }] },
            { $set: patch, $inc: { version: 1 } },
            { new: true }
        );
        if (!inv) return res.status(404).json({ message: 'Invoice not found' });
        res.json({ data: inv });
    } catch (e) { next(e); }
};


/* -------------------- Depreciation APIs ------------------ */
function monthsBetween(start, months) {
    const out = [];
    const d = new Date(start);
    for (let i = 0; i < months; i++) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        out.push(`${y}-${m}`);
        d.setMonth(d.getMonth() + 1);
    }
    return out;
}


export const previewDepreciation = async (req, res, next) => {
    try {
        const { method = 'SL', purchasePrice = 0, purchaseDate, usefulLifeMonths = 36, rateOrSalvage = 0 } = req.body;
        const P = Number(purchasePrice) || 0;
        const life = Math.max(1, Number(usefulLifeMonths) || 1);

        const schedule = [];
        const months = monthsBetween(purchaseDate || new Date(), life);

        if (method === 'SL') {
            const salvage = Number(rateOrSalvage) || 0;
            const depTotal = Math.max(0, P - salvage);
            const perMonth = depTotal / life;
            let remaining = P;
            months.forEach((period) => {
                const amount = Math.max(0, Math.min(remaining, perMonth));
                remaining = Math.max(0, remaining - amount);
                schedule.push({ period, amount });
            });
        } else {
            // WDV with annual rate -> monthly equivalent
            const annualRate = Math.max(0, Number(rateOrSalvage) || 0) / 100;
            const monthlyRate = 1 - Math.pow(1 - annualRate, 1 / 12);
            let book = P;
            months.forEach((period) => {
                const amount = book * monthlyRate;
                book = Math.max(0, book - amount);
                schedule.push({ period, amount });
            });
        }

        res.json({ data: schedule });
    } catch (e) { next(e); }
};

export const runDepreciation = async (req, res, next) => {
    try {
        const { assetId, month } = req.body;
        if (!assetId || !month) return res.status(400).json({ message: 'assetId and month are required' });
        // Persist to a GL/ledger table if you have one. For now, a no-op success.
        res.json({ success: true });
    } catch (e) { next(e); }
};

/* ----------------------- Recovery ------------------------ */
export const getRecoveryByAsset = async (req, res, next) => {
    try {
        const { assetId } = req.params;
        if (!assetId) return res.status(400).json({ message: 'assetId required' });
        // Demo numbers — replace with real computations (sum of invoices, payments, etc.)
        const originalValue = 100000;
        const recoveredAmount = 64000;
        const recoveryPercent = (recoveredAmount / originalValue) * 100;
        res.json({ data: { assetId, originalValue, recoveredAmount, recoveryPercent } });
    } catch (e) { next(e); }
};

export const getRecoverySummary = async (_req, res, next) => {
    try {
        // Example aggregation: group by customer via contracts + invoices
        const rows = await Contract.aggregate([
            { $lookup: { from: 'invoices', localField: '_id', foreignField: 'contract', as: 'invoices' } },
            {
                $group: {
                    _id: '$customer',
                    assetCount: { $sum: { $size: '$assets' } },
                    totalValue: { $sum: '$monthlyRent' },
                    avgRecoveryPercent: { $avg: 72 }, // stub; replace with real math from invoices
                }
            },
        ]);

        const result = rows.map(r => ({
            customerId: String(r._id),
            assetCount: r.assetCount || 0,
            avgRecoveryPercent: r.avgRecoveryPercent || 0,
            totalValue: r.totalValue || 0,
        }));

        res.json({ data: result });
    } catch (e) { next(e); }
};
