export function getPaginationParams(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  let sort = { createdAt: -1 };
  if (query.sort) {
    const parts = query.sort.split(':');
    const field = parts[0];
    const order = parts[1] === 'asc' ? 1 : -1;
    sort = { [field]: order };
  }

  return { page, limit, skip, sort };
}

export function buildPaginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1
  };
}
