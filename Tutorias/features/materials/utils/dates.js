export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value.seconds) {
    return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6);
  }
  return 0;
};
