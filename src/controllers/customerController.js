import Customer from "../models/Customer.js";
import { paginate } from "../utils/paginate.js";

export const listCustomers = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const filter = search
      ? {
          $or: [
            { name: new RegExp(search, 'i') },
            { company: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') },
            { phone: new RegExp(search, 'i') },
          ],
        }
      : {};
    const result = await paginate(Customer, { filter, page, limit, sort: '-createdAt' });
    res.json(result);
  } catch (e) { next(e); }
};

export const createCustomer = async (req, res, next) => {
  try {
    const c = await Customer.create(req.body);
    res.status(201).json({ data: c });
  } catch (e) { next(e); }
};


export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only allow fields you actually store
    const allowed = ["name", "company", "email", "phone", "gst", "address"];
    const update = {};
    const unset = {};

    for (const key of allowed) {
      if (req.body.hasOwnProperty(key)) {
        const val = req.body[key];

        // Treat empty strings as unset to keep DB clean
        if (val === "" || val === null) {
          unset[key] = "";
        } else {
          update[key] = val;
        }
      }
    }

    const doc = await Customer.findByIdAndUpdate(
      id,
      {
        ...(Object.keys(update).length ? { $set: update } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!doc) return res.status(404).json({ message: "Customer not found" });

    res.json({ data: doc });
  } catch (e) {
    next(e);
  }
};