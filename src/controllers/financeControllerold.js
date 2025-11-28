import Contract from '../models/Contract.js';
import { nextContractId } from '../utils/ids.js';
import { paginate } from '../utils/paginate.js';

// const Contract = require('../models/Contract');
// const Invoice  = require('../models/Invoice');
// const paginate = require('../utils/paginate');

/* ----------------------- Contracts ----------------------- */
export const getContracts = async (req, res, next) => {
  try {
    const { search = '', status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      // search by customer name via populate + post filter OR add Customer name into contract docs
      // Here we do a two-step for simplicity (good for <= few thousand docs)
      const q = new RegExp(search, 'i');
      filter.$or = [
        { contractId: q },
        { notes: q },
      ];
    }

    const result = await paginate(Contract, {
      filter,
      page, limit,
      sort: '-createdAt',
      populate: [{ path: 'customer', select: 'name company' }],
    });

    // reshape customer field to match your table render (customer name)
    result.data = result.data.map(c => ({
      ...c,
      customer: c.customer?.name || c.customer, // front-end expects string in table
    }));

    res.json(result);
  } catch (e) { next(e); }
};


export const createContract = async (req, res, next) => {
  try {
    const body = req.body;

    // auto-sum if the flag is true
    if (body.autoSumFromAssets && Array.isArray(body.assets)) {
      body.monthlyRent = body.assets.reduce((s, a) => s + Number(a.monthlyRent || 0), 0);
    }

    const c = await Contract.create({
      ...body,
      contractId: nextContractId(),
    });
    res.status(201).json({ data: c });
  } catch (e) { next(e); }
};



export const updateContract = async (req, res, next) => {
  try {
    const idOrCode = req.params.id; 
    const body = req.body;

    if (body.autoSumFromAssets && Array.isArray(body.assets)) {
      body.monthlyRent = body.assets.reduce((s, a) => s + Number(a.monthlyRent || 0), 0);
    }

    const c = await Contract.findOneAndUpdate(
      { $or: [{ _id: idOrCode }, { contractId: idOrCode }] },
      { $set: body, $inc: { version: 1 } },
      { new: true }
    );
    if (!c) return res.status(404).json({ message: 'Contract not found' });
    res.json({ data: c });
  } catch (e) { next(e); }
};



export const deleteContract = async (req, res, next) => {
  try {
    const idOrCode = req.params.id;
    // optionally: check linked invoices
    // const invCount = await Invoice.countDocuments({ contract: idOrCode });
    // if (invCount > 0) return res.status(400).json({ message: 'Cannot delete: has invoices' });

    const r = await Contract.findOneAndDelete({ $or: [{ _id: idOrCode }, { contractId: idOrCode }] });
    if (!r) return res.status(404).json({ message: 'Contract not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
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
      { $group: {
          _id: '$customer',
          assetCount: { $sum: { $size: '$assets' } },
          totalValue: { $sum: '$monthlyRent' },
          avgRecoveryPercent: { $avg: 72 }, // stub; replace with real math from invoices
      }},
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
