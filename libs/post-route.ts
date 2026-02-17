const MAX_SLUG_LENGTH = 80;

const normalizeTitleForSlug = (title: string) =>
  title
    .trim()
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^0-9A-Za-z가-힣._~-]/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");

const normalizePathParam = (
  pathParam: string | string[] | undefined
): string => {
  const value = Array.isArray(pathParam) ? pathParam[0] : pathParam;
  return String(value ?? "").trim();
};

export const slugifyPostTitle = (title: string) => normalizeTitleForSlug(title);

export const toPostPath = (
  id: number | string,
  title?: string | null
): string => {
  const safeId = String(id).trim();
  if (!safeId) return "/posts";

  const slug = title ? normalizeTitleForSlug(title) : "";
  if (!slug) return `/posts/${safeId}`;

  return `/posts/${safeId}-${slug}`;
};

export const extractPostIdFromPath = (
  pathParam: string | string[] | undefined
): number => {
  const path = normalizePathParam(pathParam);
  if (!path) return Number.NaN;

  const idOnly = path.split("-", 1)[0];
  const id = Number(idOnly);
  return Number.isNaN(id) ? Number.NaN : id;
};
