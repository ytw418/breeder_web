/**
 * 아바타 이니셜 배경 톤(community-vibe §3.7). 이름 해시로 파스텔 4색(주황·파랑·초록·보라) 중 하나를 고른다.
 * 같은 이름은 항상 같은 색. 앱 src/lib/avatarTone.ts 와 같은 해시를 쓴다.
 */
export type AvatarTone = 0 | 1 | 2 | 3;

export function avatarTone(name: string | null | undefined): AvatarTone {
  const s = (name ?? "").trim();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 4) as AvatarTone;
}

/** Tailwind 는 동적 클래스를 못 읽어 톤별 클래스를 미리 적는다. */
export const AVATAR_TONE_CLASS: Record<AvatarTone, string> = {
  0: "bg-app-avatar-1-bg text-app-avatar-1-fg",
  1: "bg-app-avatar-2-bg text-app-avatar-2-fg",
  2: "bg-app-avatar-3-bg text-app-avatar-3-fg",
  3: "bg-app-avatar-4-bg text-app-avatar-4-fg",
};

export function avatarToneClass(name: string | null | undefined): string {
  return AVATAR_TONE_CLASS[avatarTone(name)];
}

/** 이니셜: 이름 첫 글자(공백 제외). 없으면 빈 문자열. */
export function avatarInitial(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  return s ? Array.from(s)[0] : "";
}
