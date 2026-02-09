import client from "@libs/server/client";

export interface GuinnessSpecies {
  id: number;
  name: string;
  aliases: string[];
  isActive: boolean;
  isOfficial: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const SPECIES_NAME_REGEX = /^[가-힣ㄱ-ㅎㅏ-ㅣ]{2,30}$/;

const DEFAULT_SPECIES = [
  "장수풍뎅이",
  "사슴벌레",
  "왕사슴벌레",
  "넓적사슴벌레",
  "애사슴벌레",
  "톱사슴벌레",
  "미야마사슴벌레",
] as const;

const normalizeDisplayName = (value: string) =>
  value.replace(/\s+/g, " ").trim();

export const normalizeSpeciesText = (value: string) =>
  normalizeDisplayName(value).toLowerCase().replace(/\s+/g, "");

export const sanitizeSpeciesNameInput = (value: string) =>
  String(value || "").replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");

export const isValidSpeciesName = (value: string) =>
  SPECIES_NAME_REGEX.test(String(value || ""));

const sanitizeAliases = (aliases: unknown, name: string) => {
  const list = Array.isArray(aliases)
    ? aliases
    : String(aliases || "")
        .split(",")
        .map((item) => item.trim());

  const unique = new Set<string>();
  for (const raw of list) {
    const alias = normalizeDisplayName(String(raw || ""));
    if (!alias) continue;
    if (normalizeSpeciesText(alias) === normalizeSpeciesText(name)) continue;
    unique.add(alias);
  }
  return Array.from(unique);
};

const toSpecies = (
  item: Partial<GuinnessSpecies> & { canonicalName?: string },
  index: number
): GuinnessSpecies | null => {
  const name = normalizeDisplayName(
    String(item.name || item.canonicalName || "")
  );
  if (!name) return null;

  const now = new Date().toISOString();

  return {
    id: Number(item.id) || index + 1,
    name,
    aliases: sanitizeAliases(item.aliases, name),
    isActive: item.isActive !== false,
    isOfficial: item.isOfficial !== false,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
};

const buildDefaultSpecies = (): GuinnessSpecies[] => {
  const now = new Date().toISOString();
  return DEFAULT_SPECIES.map((name, index) => ({
    id: index + 1,
    name,
    aliases: [],
    isActive: true,
    isOfficial: true,
    createdAt: now,
    updatedAt: now,
  }));
};

export async function readGuinnessSpecies(): Promise<GuinnessSpecies[]> {
  const items = await client.guinnessSpecies.findMany();
  if (!items.length) {
    return buildDefaultSpecies();
  }
  return items;
}

export function findGuinnessSpeciesMatch(
  items: GuinnessSpecies[],
  rawSpecies: string
): GuinnessSpecies | null {
  const normalized = normalizeSpeciesText(rawSpecies);
  if (!normalized) return null;

  for (const item of items) {
    if (normalizeSpeciesText(item.name) === normalized) return item;
    const aliasMatched = item.aliases.some(
      (alias) => normalizeSpeciesText(alias) === normalized
    );
    if (aliasMatched) return item;
  }

  return null;
}

export function searchGuinnessSpecies(
  items: GuinnessSpecies[],
  rawQuery: string,
  limit = 20
): GuinnessSpecies[] {
  const query = normalizeSpeciesText(rawQuery);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const sortedBase = [...items].sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

  if (!query) {
    return sortedBase.slice(0, safeLimit);
  }

  const scored = sortedBase
    .map((item) => {
      const normalizedName = normalizeSpeciesText(item.name);
      const aliasNormalized = item.aliases.map((alias) =>
        normalizeSpeciesText(alias)
      );
      const candidates = [normalizedName, ...aliasNormalized];

      let score = 99;
      for (const candidate of candidates) {
        if (candidate === query) {
          score = Math.min(score, 0);
          continue;
        }
        if (candidate.startsWith(query)) {
          score = Math.min(score, 1);
          continue;
        }
        if (candidate.includes(query)) {
          score = Math.min(score, 2);
          continue;
        }
      }

      return { item, score };
    })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.item.name.localeCompare(b.item.name, "ko");
    })
    .slice(0, safeLimit)
    .map((entry) => entry.item);

  return scored;
}

export function upsertGuinnessSpeciesCandidate(
  items: GuinnessSpecies[],
  rawSpecies: string
): {
  items: GuinnessSpecies[];
  species: GuinnessSpecies | null;
  created: boolean;
} {
  const name = normalizeDisplayName(rawSpecies);
  if (!name) {
    return { items, species: null, created: false };
  }

  const matched = findGuinnessSpeciesMatch(items, name);
  if (matched) {
    return { items, species: matched, created: false };
  }

  const now = new Date().toISOString();
  const nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const created: GuinnessSpecies = {
    id: nextId,
    name,
    aliases: [],
    isActive: false,
    isOfficial: false,
    createdAt: now,
    updatedAt: now,
  };

  return {
    items: [...items, created],
    species: created,
    created: true,
  };
}

export function buildAliasesFromText(rawAliases: string) {
  return sanitizeAliases(rawAliases, "");
}
