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

export const getProductPath = (id: number | string, title?: string | null) => {
  const safeId = String(id).trim();
  if (!title) return `/products/${safeId}`;

  const slug = normalizeTitleForSlug(title);
  if (!slug) return `/products/${safeId}`;

  return `/products/${safeId}_${slug}`;
};

export const extractProductId = (rawId: string | number | string[] | undefined): string => {
  if (Array.isArray(rawId)) {
    return extractProductId(rawId[0]);
  }

  const value = String(rawId ?? "").trim();
  if (!value) return "";

  const delimiterIndex = value.search(/[_-]/);
  if (delimiterIndex === -1) return value;
  return value.slice(0, delimiterIndex);
};
