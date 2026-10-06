/**
 * 반려생활(커뮤니티) 초기 시드 글 등록.
 *
 * - 글 본문: scripts/seed-data/community-posts.json
 * - 사진: scripts/seed-data/community-images.json (Wikimedia Commons CC 사진, 본문 끝에 출처 표기)
 *   업로드한 Cloudflare 이미지 id 는 community-images.uploaded.json 에 캐시한다.
 * - 작성자는 FAKE_USER(provider test_user) 계정만 쓴다. 같은 이름의 실제 유저가 있으면 중단한다.
 * - 작성 시각은 최근 --days 일에 흩어 둔다(글 순서 유지, 시각은 제목 기반 고정 난수).
 * - 같은 작성자·제목 글이 있으면 건너뛴다(재실행 안전).
 *
 * 사용:
 *   npm run seed:community                       # 계획만 출력(dry-run)
 *   npm run seed:community -- --apply            # 실제 등록
 *   npm run seed:community -- --cleanup-legacy   # 기존 더미 글 정리 계획(테스트 글·작성자 불일치 글 삭제, 2/17 몰림 분산)
 *   npm run seed:community -- --cleanup-legacy --apply
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

function loadLocalEnvSync() {
  if (process.env.DATABASE_URL && process.env.CF_ID) return;
  try {
    const text = readFileSync(path.join(process.cwd(), ".env"), "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const rawValue = trimmed.slice(index + 1).trim();
      if (!key || process.env[key]) continue;
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    // .env 가 없으면 기존 환경변수만 사용
  }
}

loadLocalEnvSync();
const client = new PrismaClient();

const DATA_DIR = path.join(process.cwd(), "scripts", "seed-data");
const POSTS_FILE = path.join(DATA_DIR, "community-posts.json");
const IMAGES_FILE = path.join(DATA_DIR, "community-images.json");
const UPLOADED_FILE = path.join(DATA_DIR, "community-images.uploaded.json");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CLEANUP_LEGACY = args.includes("--cleanup-legacy");
const DAYS = Number(args.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 28);

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SEED_PROVIDER = "test_user";
const SEED_ROLE = "FAKE_USER" as const;

type Persona = { name: string; snsId?: string; joinedDaysAgo?: number };
type SeedPost = {
  persona: string;
  category: string;
  species?: string;
  title: string;
  body: string;
  imageKeys?: string[];
};
type ImageCandidate = { url: string; author: string; license: string; pageUrl: string };

const readJson = <T>(file: string, fallback: T): T =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf-8")) as T) : fallback;

/** 문자열 → 고정 난수(0~1). 재실행해도 같은 시각·좋아요 수가 나오게 한다. */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** KST 기준 글이 많이 올라오는 시간대(저녁~자정 위주) */
const HOUR_WEIGHTS: Array<[number, number]> = [
  [7, 1], [8, 2], [9, 2], [10, 2], [11, 2], [12, 4], [13, 3], [14, 2], [15, 2], [16, 2],
  [17, 3], [18, 4], [19, 5], [20, 6], [21, 7], [22, 7], [23, 5], [0, 3], [1, 1],
];

function pickHour(rand: () => number) {
  const total = HOUR_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [hour, weight] of HOUR_WEIGHTS) {
    r -= weight;
    if (r < 0) return hour;
  }
  return 21;
}

/** i번째 글의 작성 시각. 창(window)을 글 수로 나눈 칸 안에서 날짜를 흔들고 시각은 가중치로 고른다. */
function postCreatedAt(index: number, total: number, title: string, windowStart: number, windowEnd: number) {
  const rand = seededRandom(title);
  const slot = (windowEnd - windowStart) / total;
  const dayBase = windowStart + slot * (index + 0.15 + rand() * 0.7);
  const kstMidnight = Math.floor((dayBase + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
  const hour = pickHour(rand);
  const at = kstMidnight + (hour < 7 ? hour + 24 : hour) * 60 * 60 * 1000 + Math.floor(rand() * 60) * 60 * 1000;
  return new Date(Math.min(at, windowEnd));
}

async function uploadToCloudflare(sourceUrl: string): Promise<string> {
  const { CF_ID, CF_TOKEN } = process.env;
  if (!CF_ID || !CF_TOKEN) throw new Error("CF_ID/CF_TOKEN 환경변수가 필요합니다.");
  // Wikimedia 는 User-Agent 없는 요청을 막으므로 직접 받아서 파일로 올린다.
  const source = await fetch(sourceUrl, {
    headers: { "User-Agent": "BredySeed/1.0 (bredyteam@gmail.com)" },
  });
  if (!source.ok) throw new Error(`이미지 다운로드 실패 ${source.status}: ${sourceUrl}`);
  const blob = await source.blob();
  const form = new FormData();
  form.append("file", blob, path.basename(new URL(sourceUrl).pathname));
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ID}/images/v1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_TOKEN}` },
    body: form,
  });
  const payload = (await res.json().catch(() => null)) as { success?: boolean; result?: { id?: string } } | null;
  if (!res.ok || !payload?.success || !payload.result?.id) {
    throw new Error(`Cloudflare 업로드 실패 ${res.status}: ${sourceUrl}`);
  }
  return payload.result.id;
}

const creditLine = (images: ImageCandidate[]) =>
  images.map((img) => `사진: ${img.author} / Wikimedia Commons (${img.license})`).join("\n");

async function resolvePersonas(personas: Persona[]) {
  const byName = new Map<string, number>();
  for (const persona of personas) {
    const existing = await client.user.findUnique({
      where: { name: persona.name },
      select: { id: true, role: true, provider: true },
    });
    if (existing) {
      if (existing.role !== SEED_ROLE && existing.provider !== SEED_PROVIDER) {
        throw new Error(`'${persona.name}' 은(는) 실제 유저 계정이라 시드 작성자로 쓸 수 없습니다.`);
      }
      byName.set(persona.name, existing.id);
      continue;
    }
    if (!persona.snsId) throw new Error(`'${persona.name}' 계정이 없고 snsId 도 없어 만들 수 없습니다.`);
    if (!APPLY) {
      console.log(`  + 계정 생성 예정: ${persona.name}`);
      byName.set(persona.name, -1);
      continue;
    }
    const createdAt = new Date(Date.now() - (persona.joinedDaysAgo ?? 30) * DAY_MS);
    const created = await client.user.create({
      data: {
        name: persona.name,
        snsId: persona.snsId,
        provider: SEED_PROVIDER,
        role: SEED_ROLE,
        createdAt,
      },
      select: { id: true },
    });
    console.log(`  + 계정 생성: ${persona.name} (#${created.id})`);
    byName.set(persona.name, created.id);
  }
  return byName;
}

async function seedPosts() {
  const { personas, posts } = readJson<{ personas: Persona[]; posts: SeedPost[] }>(POSTS_FILE, {
    personas: [],
    posts: [],
  });
  const imageCatalog = readJson<Record<string, ImageCandidate[]>>(IMAGES_FILE, {});
  const uploaded = readJson<Record<string, string>>(UPLOADED_FILE, {});

  console.log(`[seed:community] ${APPLY ? "APPLY" : "DRY-RUN"} · 글 ${posts.length}개 · 최근 ${DAYS}일`);
  const personaIds = await resolvePersonas(personas);

  const likerPool = (
    await client.user.findMany({
      where: { OR: [{ role: SEED_ROLE }, { provider: SEED_PROVIDER }], status: "ACTIVE" },
      select: { id: true },
    })
  ).map((u) => u.id);

  const now = Date.now();
  const windowEnd = now - 2 * 60 * 60 * 1000;
  const windowStart = now - DAYS * DAY_MS;
  const keyCursor = new Map<string, number>();
  let created = 0;

  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    const userId = personaIds.get(post.persona);
    if (userId === undefined) throw new Error(`personas 에 없는 작성자: ${post.persona}`);
    const createdAt = postCreatedAt(index, posts.length, post.title, windowStart, windowEnd);

    // 같은 종 사진을 여러 글이 쓰면 후보를 돌려가며 고른다.
    const pickedImages: ImageCandidate[] = [];
    for (const key of post.imageKeys ?? []) {
      const candidates = imageCatalog[key] ?? [];
      if (!candidates.length) continue;
      const cursor = keyCursor.get(key) ?? 0;
      pickedImages.push(candidates[cursor % candidates.length]);
      keyCursor.set(key, cursor + 1);
    }

    if (userId > 0) {
      const exists = await client.post.findFirst({ where: { userId, title: post.title }, select: { id: true } });
      if (exists) {
        console.log(`  = 이미 있음 #${exists.id} ${post.title}`);
        continue;
      }
    }

    const rand = seededRandom(`${post.title}:likes`);
    const maxLikes = post.category === "질문" ? 3 : 7;
    const likeCount = Math.floor(rand() * (maxLikes + 1));
    const kst = new Date(createdAt.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
    console.log(
      `  ${kst} KST · ${post.category} · ${post.persona} · ${post.title}` +
        `${pickedImages.length ? ` · 사진 ${pickedImages.length}` : ""} · 좋아요 ${likeCount}`
    );
    if (!APPLY) continue;

    const imageIds: string[] = [];
    for (const img of pickedImages) {
      if (!uploaded[img.url]) {
        uploaded[img.url] = await uploadToCloudflare(img.url);
        writeFileSync(UPLOADED_FILE, `${JSON.stringify(uploaded, null, 2)}\n`);
      }
      imageIds.push(uploaded[img.url]);
    }
    const description = pickedImages.length ? `${post.body}\n\n${creditLine(pickedImages)}` : post.body;

    const record = await client.post.create({
      data: {
        userId,
        title: post.title,
        description,
        category: post.category,
        type: post.species ?? null,
        image: imageIds[0] ?? "",
        images: imageIds,
        createdAt,
        updatedAt: createdAt,
      },
      select: { id: true },
    });

    const likers = likerPool
      .filter((id) => id !== userId)
      .map((id) => ({ id, order: rand() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, likeCount);
    for (const liker of likers) {
      const likedAt = new Date(Math.min(createdAt.getTime() + Math.floor(rand() * 2 * DAY_MS), windowEnd));
      await client.like.create({
        data: { userId: liker.id, postId: record.id, createdAt: likedAt, updatedAt: likedAt },
      });
    }
    created += 1;
  }

  console.log(`[seed:community] ${APPLY ? `등록 ${created}개` : "dry-run 끝 (--apply 로 실제 등록)"}`);
}

/**
 * 기존 더미 글 정리.
 * - 제목/본문이 테스트용인 글 삭제
 * - 여러 계정에 같은 제목으로 올라간 글은 가장 나중 글만 남기고 삭제(댓글 달린 글은 유지)
 * - 본문 인사말의 이름이 작성자와 다른 글 삭제(다른 계정 글을 복사한 흔적)
 * - 하루에 몰린 글(같은 작성자·같은 날 3개 이상)은 2026-02-17 ~ 시드 창 시작 전 사이로 흩는다.
 *   좋아요·댓글이 달린 글은 시각을 옮기지 않는다.
 */
async function cleanupLegacy() {
  console.log(`[seed:community] legacy 정리 ${APPLY ? "APPLY" : "DRY-RUN"}`);
  const seedPostTitles = new Set(
    readJson<{ posts: SeedPost[] }>(POSTS_FILE, { posts: [] }).posts.map((p) => p.title)
  );
  const posts = await client.post.findMany({
    where: { user: { OR: [{ role: SEED_ROLE }, { provider: SEED_PROVIDER }] } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true } },
      _count: { select: { comments: true, Likes: true } },
    },
  });

  // 제목이 같은 글이 여러 계정에 있으면 가장 나중 글 하나만 남긴다.
  const latestIdByTitle = new Map<string, number>();
  for (const post of posts) latestIdByTitle.set(post.title, post.id);

  const toDelete: typeof posts = [];
  const keep: typeof posts = [];
  for (const post of posts) {
    if (seedPostTitles.has(post.title)) continue;
    const isTest = /테스트/.test(post.title) || /테스트 본문|테스트입니다/.test(post.description);
    const greetingName = post.description.match(/^안녕하세요,\s*([^\s]+?)입니다/)?.[1];
    const wrongAuthor = Boolean(greetingName && greetingName !== post.user.name);
    const duplicated = latestIdByTitle.get(post.title) !== post.id && post._count.comments === 0;
    if (isTest || wrongAuthor || duplicated) toDelete.push(post);
    else keep.push(post);
  }

  for (const post of toDelete) {
    console.log(`  - 삭제 #${post.id} [${post.user.name}] ${post.title}`);
  }

  const dayKey = (p: (typeof posts)[number]) => `${p.userId}:${p.createdAt.toISOString().slice(0, 10)}`;
  const clusterSize = new Map<string, number>();
  for (const p of keep) clusterSize.set(dayKey(p), (clusterSize.get(dayKey(p)) ?? 0) + 1);
  const toRedate = keep.filter(
    (p) => (clusterSize.get(dayKey(p)) ?? 0) >= 3 && p._count.comments === 0 && p._count.Likes === 0
  );
  const rangeStart = Date.parse("2026-02-17T00:00:00+09:00");
  const rangeEnd = Date.now() - (DAYS + 3) * DAY_MS;
  const redates = toRedate.map((post, index) => ({
    post,
    at: postCreatedAt(index, toRedate.length, `legacy:${post.id}`, rangeStart, rangeEnd),
  }));
  for (const { post, at } of redates) {
    console.log(`  ~ 시각 이동 #${post.id} ${post.createdAt.toISOString().slice(0, 10)} → ${at.toISOString().slice(0, 10)} ${post.title}`);
  }

  console.log(`  삭제 ${toDelete.length}개 · 시각 이동 ${redates.length}개`);
  if (!APPLY) return;
  await client.post.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
  for (const { post, at } of redates) {
    await client.post.update({ where: { id: post.id }, data: { createdAt: at, updatedAt: at } });
  }
  console.log("[seed:community] legacy 정리 완료");
}

(CLEANUP_LEGACY ? cleanupLegacy() : seedPosts())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.$disconnect());
