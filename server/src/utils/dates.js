export function getStartOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

export function isBatchExpired(expiryDate) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  const startOfToday = getStartOfToday();
  // Expired if expiry date is before the start of today UTC
  return exp.getTime() < startOfToday.getTime();
}

export function calculateDaysToExpiry(expiryDate) {
  if (!expiryDate) return 0;
  const exp = new Date(expiryDate);
  const startOfToday = getStartOfToday();
  const diffMs = exp.getTime() - startOfToday.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function normalizeToUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
