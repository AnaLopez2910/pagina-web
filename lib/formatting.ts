export function normalizeIntlWhitespace(value: string) {
  return value.replace(/[\u00a0\u202f]/g, " ");
}
