export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const reservedSlugs = new Set([
  "admin",
  "api",
  "login",
  "register",
  "onboarding",
  "pricing",
  "mockups",
  "_next"
]);
