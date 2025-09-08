export function parseSpecialties(input) {
  if (!input) return [];
  return input.split(',').map(s => s.trim()).filter(Boolean);
}
