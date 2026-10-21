/**
 * 알림 종류별 끄기·방해 금지 푸시 판단(libs/shared/notificationPrefs.ts = 앱 src/lib/notificationPrefs.ts 사본).
 */
import { shouldPush } from "@libs/shared/notificationPrefs";

// 23:00 KST
const NIGHT = new Date("2026-10-21T14:00:00.000Z");

describe("shouldPush", () => {
  it("끈 종류는 보내지 않고, 방해 금지 시간엔 '채팅·경매 예외'만 보내며, 운영 알림은 항상 보낸다", () => {
    const prefs = { reaction: false, quiet: { enabled: true, start: 22, end: 8, exemptChatTrade: true } };
    const noon = new Date("2026-10-21T03:00:00.000Z"); // 12:00 KST

    expect(shouldPush(prefs, "LIKE", noon)).toBe(false); // 내 글 반응 꺼짐
    expect(shouldPush(prefs, "FOLLOW", noon)).toBe(true);
    expect(shouldPush(prefs, "FOLLOW", NIGHT)).toBe(false); // 방해 금지
    expect(shouldPush(prefs, "CHAT", NIGHT)).toBe(true); // 예외
    expect(shouldPush({ ...prefs, quiet: { ...prefs.quiet, exemptChatTrade: false } }, "BID", NIGHT)).toBe(false);
    expect(shouldPush({ news: false, quiet: { enabled: true } }, "MODERATION", NIGHT)).toBe(true);
    expect(shouldPush(null, "LIKE", NIGHT)).toBe(true); // 저장된 적 없으면 모두 켜짐
    // 입양자 지정·거래 후기 알림은 '거래·경매' 종류를 따른다
    expect(shouldPush({ trade: false }, "ADOPTION_CONFIRMED", noon)).toBe(false);
  });
});
