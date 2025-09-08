export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

export function maxLength(value, len) {
  return !value || String(value).length <= len;
}

export function maxArrayLength(arr, len) {
  return !arr || arr.length <= len;
}
