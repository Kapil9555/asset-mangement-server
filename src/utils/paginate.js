export async function paginate(Model, { filter = {}, select = null, populate = null, page = 1, limit = 20, sort = '-createdAt' }) {
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Math.min(200, Number(limit) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Model.find(filter).select(select).populate(populate).sort(sort).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};
