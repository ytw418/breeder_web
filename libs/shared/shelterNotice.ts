/**
 * 보호소 글(Product.externalSource 있음)의 본문 줄에서 화면이 쓰는 값을 읽는 규칙(앱 docs/prd/shelter-animals.md S-1·S-3).
 * 공고 마감일·보호소 연락처는 따로 칸이 없고 libs/shared/shelterAnimal.ts 의 buildDescription 이 쓴 줄 형식에 들어 있다:
 *   공고 기간: 10.21 ~ 11.02        (또는 '공고 마감: 11.02')
 *   입양 문의는 보호소로 해 주세요
 *   <보호소 이름> <전화>
 *   <주소>
 *   출처: 국가동물보호정보시스템 공고 <공고번호>
 *   보호 기간이 지나면 이미 입양됐거나 공고가 바뀌었을 수 있어요.
 * 줄 형식을 바꾸면 이 모듈과 __tests__/shelterNotice.test.ts 를 같이 고친다(테스트가 실제 buildDescription 결과로 읽는다).
 * 앱 bredy_app src/lib/shelterNotice.ts = 웹 libs/shared/shelterNotice.ts 사본이라 함께 고친다.
 */

import { kstToday } from "./petSpace";
import { shelterTelHref } from "./shelterAnimal";

const CONTACT_ANCHOR = "입양 문의는 보호소로 해 주세요";
const SOURCE_LINE = /^출처:\s*국가동물보호정보시스템 공고\s*(.*)$/;
const EXPIRY_NOTE = /^보호 기간이 지나면/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 레일·목록 카드의 '공고 D-3'. 본문의 공고 마감일(월.일, 연도 없음)을 한국 시간 오늘과 견줘 센다.
 * 연도는 오늘과 가장 가까운 해로 본다(12월 → 1월 넘김). 마감일이 이미 지났거나 줄이 없으면 null(라벨을 그리지 않는다).
 */
export function shelterDeadlineLabel(description: string | null | undefined, today: string = kstToday()): string | null {
  const match = String(description ?? "").match(/공고 (?:기간|마감):\s*(?:\d{2}\.\d{2}\s*~\s*)?(\d{2})\.(\d{2})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const base = Date.UTC(todayYear, todayMonth - 1, todayDay);
  let days: number | null = null;
  for (const year of [todayYear - 1, todayYear, todayYear + 1]) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1) continue; // 2.30 같은 없는 날
    const diff = Math.round((date.getTime() - base) / DAY_MS);
    if (days === null || Math.abs(diff) < Math.abs(days)) days = diff;
  }
  if (days === null || days < 0) return null;
  return days === 0 ? "공고 오늘 마감" : `공고 D-${days}`;
}

export interface ShelterContact {
  /** 보호소 이름. */
  name: string | null;
  /** 화면에 보일 전화번호 글(여러 개면 적힌 그대로). tel: 링크는 shelterTelHref 로 만든다. */
  tel: string | null;
  address: string | null;
  noticeNo: string | null;
}

const EMPTY_CONTACT: ShelterContact = { name: null, tel: null, address: null, noticeNo: null };

/** "<보호소 이름> <전화>" 한 줄 → 이름·전화. 끝의 숫자 덩어리가 전화로 쓸 수 있을 때만 전화로 본다(E-6). */
function splitCareLine(line: string): { name: string | null; tel: string | null } {
  const match = line.match(/^(.*?)\s*(\+?\d[\d\-().\s/,;~]*)$/);
  if (match && match[2].trim() && shelterTelHref(match[2])) {
    return { name: match[1].trim() || null, tel: match[2].trim() };
  }
  return { name: line.trim() || null, tel: null };
}

/** 본문에서 '입양 문의는 보호소로 해 주세요' 아래 연락처 줄과 출처 줄의 자리(줄 번호). 못 찾으면 null. */
function locateContact(lines: string[]) {
  const anchor = lines.findIndex((line) => line.trim() === CONTACT_ANCHOR);
  if (anchor < 0) return null;
  const source = lines.findIndex((line, index) => index > anchor && SOURCE_LINE.test(line.trim()));
  return { anchor, source };
}

/** 보호소 글 본문 → 보호소 이름·전화·주소·공고번호. 형식이 다르면 칸마다 null. */
export function parseShelterContact(description: string | null | undefined): ShelterContact {
  const lines = String(description ?? "").split("\n");
  const at = locateContact(lines);
  if (!at) return EMPTY_CONTACT;
  const care = splitCareLine(lines[at.anchor + 1] ?? "");
  const addressLine = (lines[at.anchor + 2] ?? "").trim();
  // 주소 줄은 비어 있거나 바로 출처 줄일 수 있다(보호소가 주소를 안 적은 공고).
  const address = addressLine && !SOURCE_LINE.test(addressLine) ? addressLine : null;
  const noticeNo = at.source >= 0 ? lines[at.source].trim().match(SOURCE_LINE)?.[1].trim() || null : null;
  return { name: care.name, tel: care.tel, address, noticeNo };
}

/**
 * 상세 본문에서 연락처 덩어리(안내 줄 ~ 출처 줄, 뒤따르는 '보호 기간이 지나면…' 줄)를 뺀다 — 같은 내용을 출처 상자가
 * 따로 보여 주므로 본문에 또 보이지 않게 한다. 줄 형식이 맞지 않으면 본문을 그대로 돌려준다.
 */
export function stripShelterContact(description: string | null | undefined): string {
  const text = String(description ?? "");
  const lines = text.split("\n");
  const at = locateContact(lines);
  if (!at || at.source < 0) return text;
  let end = at.source;
  if (EXPIRY_NOTE.test((lines[end + 1] ?? "").trim())) end += 1;
  const kept = [...lines.slice(0, at.anchor), ...lines.slice(end + 1)];
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 공고 원문 보기 주소(국가동물보호정보시스템 공고 상세, 앱 docs/prd/shelter-animals.md S-3). 구조번호가 없으면 null. */
export function shelterNoticeUrl(externalId: string | null | undefined): string | null {
  const id = String(externalId ?? "").trim();
  return id ? `https://www.animal.go.kr/front/awtis/protection/protectionDtl.do?desertionNo=${encodeURIComponent(id)}` : null;
}
