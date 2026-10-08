/**
 * @jest-environment node
 */

/**
 * 혈통 공유 미리보기(OG) — libs/server/bloodline-og.ts, card/[cardId]/page.tsx generateMetadata,
 * card/[cardId]/opengraph-image.tsx. PRD S-10, AC-73, AC-103.
 * - ACTIVE 혈통만 payload 를 준다. 출처 카드(LINE) id 로 열면 뿌리 혈통 기준이다.
 * - 회수·숨김·없는 카드는 null → 페이지는 기본 제목 + noindex, 이미지는 루트 기본 OG(브랜드 카드).
 * - 이미지 렌더는 next 빌드 없이 ImageResponse 를 목으로 바꿔 렌더 트리를 검사한다(ogRankingRoute.test.tsx 와 같은 방식).
 */
import type { ReactElement } from "react";

const mockClient = {
  bloodlineCard: { findUnique: jest.fn(), findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

const mockImageResponse = jest.fn();
jest.mock("next/og", () => ({
  ImageResponse: function ImageResponse(element: ReactElement, options: unknown) {
    mockImageResponse(element, options);
  },
}));

// 페이지 본문(클라이언트 컴포넌트)은 메타데이터 검사와 무관하다.
jest.mock("../app/(web)/bloodline-management/card/[cardId]/BloodlineCardDetailClient", () => ({
  __esModule: true,
  default: () => null,
}));

import {
  BLOODLINE_OG_DEFAULT_TITLE,
  bloodlineOgDescription,
  bloodlineOgPhotoUrl,
  bloodlineOgSpeciesLine,
  bloodlinePublicPath,
  bloodlineOgTitle,
  loadBloodlineOgPayload,
  loadBloodlineOgPhoto,
  type BloodlineOgPayload,
} from "@libs/server/bloodline-og";
import { generateMetadata } from "../app/(web)/bloodline-management/card/[cardId]/page";
import BloodlineOpenGraphImage, {
  size as ogSize,
  contentType as ogContentType,
  runtime as ogRuntime,
} from "../app/(web)/bloodline-management/card/[cardId]/opengraph-image";
import BloodlineTwitterImage, {
  size as twitterSize,
  contentType as twitterContentType,
  runtime as twitterRuntime,
} from "../app/(web)/bloodline-management/card/[cardId]/twitter-image";

const ROOT = {
  id: 10,
  cardType: "BLOODLINE",
  status: "ACTIVE",
  bloodlineReferenceId: null,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originSido: "충청남도",
  originSigungu: "공주시",
  image: "cf-image-10",
  creatorId: 1,
  creator: { name: "강산" },
};

const LINE = {
  id: 21,
  cardType: "LINE",
  status: "ACTIVE",
  bloodlineReferenceId: 10,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originSido: null,
  originSigungu: null,
  image: null,
  creatorId: 1,
  creator: { name: "강산" },
};

/** 같은 뿌리의 ACTIVE 출처 카드. 만든 사람(1)이 가진 것은 받은 사람 수에서 빠진다. */
const ROOT_LINES = [
  { bloodlineReferenceId: 10, creatorId: 1, currentOwnerId: 2 },
  { bloodlineReferenceId: 10, creatorId: 1, currentOwnerId: 3 },
  { bloodlineReferenceId: 10, creatorId: 2, currentOwnerId: 4 },
  { bloodlineReferenceId: 10, creatorId: 1, currentOwnerId: 1 },
];

const PAYLOAD: BloodlineOgPayload = {
  rootId: 10,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originLabel: "충남 공주",
  creatorName: "강산",
  receivedCount: 3,
  imageId: "cf-image-10",
};

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type FakeResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function fakeResponse(
  body: string | Uint8Array,
  { status = 200, contentType = "text/plain" }: { status?: number; contentType?: string } = {}
): FakeResponse {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === "content-type") return contentType;
        if (key === "content-length") return String(bytes.byteLength);
        return null;
      },
    },
    text: async () => (typeof body === "string" ? body : ""),
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

const mockFetch = jest.fn();

/** 폰트 CSS 는 url 없는 응답(→ 폰트 없이 진행), 카드 사진은 PNG. */
function routeFetch({ photo = "png" }: { photo?: "png" | "webp" | "error" | "404" } = {}) {
  mockFetch.mockImplementation(async (input: unknown) => {
    const url = String(input);
    if (url.startsWith("https://fonts.googleapis.com/")) return fakeResponse("/* no font */");
    if (url.startsWith("https://imagedelivery.net/")) {
      if (photo === "error") throw new Error("network");
      if (photo === "404") return fakeResponse("not found", { status: 404 });
      if (photo === "webp") return fakeResponse(PNG_BYTES, { contentType: "image/webp" });
      return fakeResponse(PNG_BYTES, { contentType: "image/png" });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

type TreeNode = { type?: unknown; props?: Record<string, unknown> & { children?: unknown } };

/** 렌더 트리의 문자열 자식을 모두 모은다. */
function collectText(node: unknown): string[] {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText((node as TreeNode).props?.children);
}

/** 렌더 트리의 모든 요소(호스트 요소)를 모은다. */
function collectNodes(node: unknown): TreeNode[] {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(collectNodes);
  const element = node as TreeNode;
  return [element, ...collectNodes(element.props?.children)];
}

const styleOf = (node: TreeNode) => (node.props?.style ?? {}) as Record<string, unknown>;

async function renderOg(cardId: string) {
  mockImageResponse.mockClear();
  await BloodlineOpenGraphImage({ params: Promise.resolve({ cardId }) });
  expect(mockImageResponse).toHaveBeenCalledTimes(1);
  const [element, options] = mockImageResponse.mock.calls[0] as [ReactElement, Record<string, unknown>];
  return { element, options, texts: collectText(element), nodes: collectNodes(element) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  mockClient.bloodlineCard.findMany.mockResolvedValue(ROOT_LINES);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("loadBloodlineOgPayload", () => {
  it("뿌리 혈통 payload", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(ROOT);

    await expect(loadBloodlineOgPayload(10)).resolves.toEqual(PAYLOAD);
    expect(mockClient.bloodlineCard.findUnique).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.findUnique.mock.calls[0][0].where).toEqual({ id: 10 });
    // 받은 사람 수는 같은 뿌리의 ACTIVE 출처 카드에서 센다
    expect(mockClient.bloodlineCard.findMany.mock.calls[0][0].where).toEqual({
      cardType: "LINE",
      status: "ACTIVE",
      bloodlineReferenceId: { in: [10] },
    });
  });

  it("출처 카드 id 는 뿌리로 바꾼다", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(LINE).mockResolvedValueOnce(ROOT);

    await expect(loadBloodlineOgPayload(21)).resolves.toEqual(PAYLOAD);
    expect(mockClient.bloodlineCard.findUnique.mock.calls[1][0].where).toEqual({ id: 10 });
  });

  it("회수된 혈통은 null", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...ROOT, status: "REVOKED" });
    await expect(loadBloodlineOgPayload(10)).resolves.toBeNull();

    // 숨김(INACTIVE)도 같다
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...ROOT, status: "INACTIVE" });
    await expect(loadBloodlineOgPayload(10)).resolves.toBeNull();

    // 출처 카드 자체가 회수됐으면 뿌리를 읽지 않는다
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...LINE, status: "REVOKED" });
    await expect(loadBloodlineOgPayload(21)).resolves.toBeNull();

    // 출처 카드는 살아 있어도 뿌리가 회수됐으면 null
    mockClient.bloodlineCard.findUnique
      .mockResolvedValueOnce(LINE)
      .mockResolvedValueOnce({ ...ROOT, status: "REVOKED" });
    await expect(loadBloodlineOgPayload(21)).resolves.toBeNull();

    expect(mockClient.bloodlineCard.findMany).not.toHaveBeenCalled();
  });

  it("없는 카드·뿌리 없는 출처 카드·잘못된 id 는 null", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(null);
    await expect(loadBloodlineOgPayload(99)).resolves.toBeNull();

    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...LINE, bloodlineReferenceId: null });
    await expect(loadBloodlineOgPayload(21)).resolves.toBeNull();

    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(LINE).mockResolvedValueOnce(null);
    await expect(loadBloodlineOgPayload(21)).resolves.toBeNull();

    // 뿌리 자리에 또 출처 카드가 있으면(데이터 오류) 뿌리로 보지 않는다
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(LINE).mockResolvedValueOnce(LINE);
    await expect(loadBloodlineOgPayload(21)).resolves.toBeNull();

    mockClient.bloodlineCard.findUnique.mockClear();
    await expect(loadBloodlineOgPayload(0)).resolves.toBeNull();
    await expect(loadBloodlineOgPayload(Number.NaN)).resolves.toBeNull();
    await expect(loadBloodlineOgPayload(1.5)).resolves.toBeNull();
    expect(mockClient.bloodlineCard.findUnique).not.toHaveBeenCalled();
  });

  it("탈퇴한 만든 사람은 표시용 라벨, 산지·종이 없으면 null, 받은 사람이 없으면 0", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({
      ...ROOT,
      speciesType: null,
      originSido: null,
      originSigungu: null,
      image: null,
      creator: { name: "탈퇴한 사용자#1" },
    });
    mockClient.bloodlineCard.findMany.mockResolvedValueOnce([]);

    await expect(loadBloodlineOgPayload(10)).resolves.toEqual({
      rootId: 10,
      name: "강산 라인",
      speciesType: null,
      originLabel: null,
      creatorName: "탈퇴한 사용자",
      receivedCount: 0,
      imageId: null,
    });
  });
});

describe("미리보기 문구", () => {
  it("제목은 '{이름} · {종} | 브리디', 종이 없으면 이름만", () => {
    expect(bloodlineOgTitle(PAYLOAD)).toBe("강산 라인 · 왕사슴벌레 | 브리디");
    expect(bloodlineOgTitle({ ...PAYLOAD, speciesType: null })).toBe("강산 라인 | 브리디");
  });

  it("설명은 만든 사람 · 산지 · 받은 사람 수 + 이름 규칙 안내", () => {
    expect(bloodlineOgDescription(PAYLOAD)).toBe(
      "강산님이 만든 혈통 · 충남 공주 · 받은 사람 3명. 혈통 이름은 만든 사람만 쓸 수 있어요."
    );
    expect(bloodlineOgDescription({ ...PAYLOAD, originLabel: null, receivedCount: 0 })).toBe(
      "강산님이 만든 혈통 · 아직 받은 사람 없음. 혈통 이름은 만든 사람만 쓸 수 있어요."
    );
  });

  it("종·산지 줄은 있는 것만 ' · ' 로 잇는다", () => {
    expect(bloodlineOgSpeciesLine(PAYLOAD)).toBe("왕사슴벌레 · 충남 공주");
    expect(bloodlineOgSpeciesLine({ ...PAYLOAD, originLabel: null })).toBe("왕사슴벌레");
    expect(bloodlineOgSpeciesLine({ ...PAYLOAD, speciesType: null, originLabel: null })).toBe("");
  });

  it("공개 상세 경로는 앱 공유 URL 과 같다", () => {
    expect(bloodlinePublicPath(21)).toBe("/bloodline-management/card/21");
  });
});

describe("카드 사진", () => {
  it("Cloudflare 이미지 id·imagedelivery 주소만 쓴다(그 밖의 주소는 가져오지 않는다)", () => {
    expect(bloodlineOgPhotoUrl("cf-image-10")).toBe(
      "https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/cf-image-10/public"
    );
    expect(bloodlineOgPhotoUrl("https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/abc/public")).toBe(
      "https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/abc/public"
    );
    expect(bloodlineOgPhotoUrl("http://169.254.169.254/latest")).toBeNull();
    expect(bloodlineOgPhotoUrl("https://example.com/a.png")).toBeNull();
    expect(bloodlineOgPhotoUrl("/images/logo.png")).toBeNull();
    expect(bloodlineOgPhotoUrl("../secret")).toBeNull();
    expect(bloodlineOgPhotoUrl("  ")).toBeNull();
    expect(bloodlineOgPhotoUrl(null)).toBeNull();
  });

  it("PNG·JPEG 는 data URI 로, 그 밖의 형식·실패는 null", async () => {
    routeFetch({ photo: "png" });
    const dataUri = await loadBloodlineOgPhoto("cf-image-10");
    expect(dataUri).toBe(`data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("accept")).toBe("image/png,image/jpeg");

    routeFetch({ photo: "webp" });
    await expect(loadBloodlineOgPhoto("cf-image-10")).resolves.toBeNull();
    routeFetch({ photo: "404" });
    await expect(loadBloodlineOgPhoto("cf-image-10")).resolves.toBeNull();
    routeFetch({ photo: "error" });
    await expect(loadBloodlineOgPhoto("cf-image-10")).resolves.toBeNull();

    mockFetch.mockClear();
    await expect(loadBloodlineOgPhoto(null)).resolves.toBeNull();
    await expect(loadBloodlineOgPhoto("https://example.com/a.png")).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("card/[cardId] generateMetadata", () => {
  const meta = (cardId: string) => generateMetadata({ params: Promise.resolve({ cardId }) });

  it("ACTIVE 혈통: 제목·설명·canonical, og:image 는 파일 규약에 맡긴다", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(LINE).mockResolvedValueOnce(ROOT);
    const metadata = await meta("21");

    // 루트 레이아웃 title.template("%s | Bredy")을 타지 않게 absolute 로 준다
    expect(metadata.title).toEqual({ absolute: "강산 라인 · 왕사슴벌레 | 브리디" });
    expect(metadata.description).toBe(
      "강산님이 만든 혈통 · 충남 공주 · 받은 사람 3명. 혈통 이름은 만든 사람만 쓸 수 있어요."
    );
    expect(metadata.openGraph).toMatchObject({
      title: "강산 라인 · 왕사슴벌레 | 브리디",
      url: "https://bredy.app/bloodline-management/card/21",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    // 라우트 그룹 아래 파일 규약 이미지는 경로에 해시가 붙는다(…/opengraph-image-xxxxxx).
    // images 를 직접 적으면 해시 없는 404 주소가 og:image 를 덮어쓰므로 적지 않는다(next build + next start 로 확인).
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).not.toHaveProperty("images");
    expect(metadata.alternates).toEqual({
      canonical: "https://bredy.app/bloodline-management/card/21",
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("회수·숨김·없는 카드는 기본 제목 + noindex", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...ROOT, status: "REVOKED" });
    const metadata = await meta("10");

    expect(metadata.title).toEqual({ absolute: BLOODLINE_OG_DEFAULT_TITLE });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toBeUndefined();
  });

  it("잘못된 id 는 조회 없이 noindex", async () => {
    const metadata = await meta("abc");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(mockClient.bloodlineCard.findUnique).not.toHaveBeenCalled();
  });

  it("조회 오류는 페이지를 깨지 않고 기본 제목(색인 지시 없음)", async () => {
    mockClient.bloodlineCard.findUnique.mockRejectedValueOnce(new Error("db down"));
    const metadata = await meta("10");

    expect(metadata.title).toEqual({ absolute: BLOODLINE_OG_DEFAULT_TITLE });
    expect(metadata.robots).toBeUndefined();
  });
});

describe("card/[cardId]/opengraph-image", () => {
  it("파일 규약 설정: nodejs, 1200×630 PNG", () => {
    expect(ogRuntime).toBe("nodejs");
    expect(ogSize).toEqual({ width: 1200, height: 630 });
    expect(ogContentType).toBe("image/png");
  });

  it("twitter-image 는 같은 그림을 쓴다(루트 twitter-image 를 이어받지 않는다)", () => {
    expect(twitterRuntime).toBe("nodejs");
    expect(twitterSize).toEqual(ogSize);
    expect(twitterContentType).toBe(ogContentType);
    expect(BloodlineTwitterImage).toBe(BloodlineOpenGraphImage);
  });

  it("ACTIVE 혈통: 이름·종·산지·만든 사람·받은 사람 수·bredy.app 을 그린다", async () => {
    routeFetch({ photo: "png" });
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(ROOT);
    const { texts, options } = await renderOg("10");

    expect(texts).toEqual(
      expect.arrayContaining([
        "강산 라인",
        "왕사슴벌레 · 충남 공주",
        "만든 사람 강산",
        "받은 사람 3명",
        "bredy.app",
      ])
    );
    expect(options).toMatchObject({ width: 1200, height: 630 });
  });

  it("흰 배경, 왼쪽 480×630 사진, 주황은 8px 세로 바 하나, 그라데이션·영문 장식 없음", async () => {
    routeFetch({ photo: "png" });
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(ROOT);
    const { element, nodes, texts } = await renderOg("10");

    expect(styleOf(element as unknown as TreeNode).background).toBe("#FFFFFF");

    const photo = nodes.find(
      (node) => node.type === "img" && String(node.props?.src).startsWith("data:image/png;base64,")
    );
    expect(photo?.props).toMatchObject({ width: 480, height: 630 });

    const orange = nodes.filter((node) =>
      Object.values(styleOf(node)).some((value) => String(value).toUpperCase().includes("#F97316"))
    );
    expect(orange).toHaveLength(1);
    expect(styleOf(orange[0])).toMatchObject({ width: 8, height: 630 });

    const serialized = JSON.stringify(nodes.map(styleOf));
    expect(serialized).not.toMatch(/gradient/i);
    // 영문은 주소 bredy.app 하나뿐
    expect(texts.filter((text) => /[A-Za-z]/.test(text))).toEqual(["bredy.app"]);

    // 로고는 public/ 실제 파일(data URI)
    const logo = nodes.find(
      (node) => node.type === "img" && node !== photo && String(node.props?.src).startsWith("data:image/png")
    );
    expect(logo).toBeDefined();
  });

  it("사진이 없거나 가져오지 못하면 #E9EBEE 자리로 그린다", async () => {
    routeFetch({ photo: "webp" });
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(ROOT);
    const { nodes } = await renderOg("10");

    const placeholder = nodes.find((node) => styleOf(node).background === "#E9EBEE");
    expect(styleOf(placeholder as TreeNode)).toMatchObject({ width: 480, height: 630 });
    expect(nodes.filter((node) => node.type === "img")).toHaveLength(1); // 로고만
  });

  it("출처 카드 id 로 열면 뿌리 혈통으로 그린다", async () => {
    routeFetch({ photo: "png" });
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(LINE).mockResolvedValueOnce(ROOT);
    const { texts } = await renderOg("21");

    expect(texts).toEqual(expect.arrayContaining(["강산 라인", "왕사슴벌레 · 충남 공주", "받은 사람 3명"]));
  });

  it("회수된 혈통·잘못된 id·조회 오류는 루트 기본 OG(브랜드 카드)", async () => {
    routeFetch();
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...ROOT, status: "REVOKED" });
    expect((await renderOg("10")).texts).toContain("브리더들의 SNS, 브리디");

    expect((await renderOg("abc")).texts).toContain("브리더들의 SNS, 브리디");

    mockClient.bloodlineCard.findUnique.mockRejectedValueOnce(new Error("db down"));
    const fallback = await renderOg("10");
    expect(fallback.texts).toContain("브리더들의 SNS, 브리디");
    expect(fallback.texts).not.toContain("강산 라인");
  });
});
