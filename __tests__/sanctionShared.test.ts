import { REPORT_REASONS } from "@libs/shared/report";
import {
  SANCTION_REASON_CODES,
  SANCTION_REASON_LABEL,
  SUSPENSION_DAY_OPTIONS,
  banNoticeMessage,
  contentDeletedMessage,
  contentHiddenMessage,
  contentUnhiddenMessage,
  defaultSanctionReason,
  extendSuspensionUntil,
  formatKstDate,
  formatKstDateTime,
  previewTitle,
  recommendSanction,
  reporterActionMessage,
  sanctionActionLabel,
  sanctionReasonLabel,
  suspensionNoticeMessage,
  validateSanctionDraft,
  warningNoticeMessage,
} from "@libs/shared/sanction";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-09T05:20:00.000Z"); // KST 2026-10-09 14:20

describe("정지 기간", () => {
  it("운영자가 고를 수 있는 기간은 1·3·7·10·30일이다", () => {
    expect([...SUSPENSION_DAY_OPTIONS]).toEqual([1, 3, 7, 10, 30]);
  });

  it("정지 중이 아니면 지금부터 센다", () => {
    expect(extendSuspensionUntil(NOW, null, 3)).toEqual(new Date(NOW.getTime() + 3 * DAY_MS));
  });

  it("이미 지난 만료 시각은 무시하고 지금부터 센다", () => {
    const past = new Date(NOW.getTime() - DAY_MS);
    expect(extendSuspensionUntil(NOW, past, 3)).toEqual(new Date(NOW.getTime() + 3 * DAY_MS));
  });

  it("정지 중이면 남은 기간에 더한다(AC-39)", () => {
    const remaining2d = new Date(NOW.getTime() + 2 * DAY_MS);
    expect(extendSuspensionUntil(NOW, remaining2d, 3)).toEqual(new Date(NOW.getTime() + 5 * DAY_MS));
  });
});

describe("권장 조치(AC-20)", () => {
  it.each([
    [0, "경고"],
    [1, "3일 정지"],
    [2, "10일 정지"],
    [3, "30일 정지"],
    [4, "영구 정지"],
    [9, "영구 정지"],
  ])("최근 180일 제재 %i건이면 %s", (count, label) => {
    expect(sanctionActionLabel(recommendSanction(count))).toBe(label);
  });

  it("음수·소수는 0 이상 정수로 본다", () => {
    expect(recommendSanction(-1)).toEqual({ type: "WARNING" });
    expect(recommendSanction(1.7)).toEqual({ type: "SUSPENSION", days: 3 });
  });
});

describe("사유", () => {
  it("모든 사유 코드에 화면 문구가 있다", () => {
    for (const code of SANCTION_REASON_CODES) expect(SANCTION_REASON_LABEL[code]).toBeTruthy();
  });

  it("모든 신고 사유가 제재 사유 기본값으로 이어진다", () => {
    for (const reasons of Object.values(REPORT_REASONS)) {
      for (const reason of reasons) {
        const code = defaultSanctionReason(reason);
        expect(SANCTION_REASON_CODES).toContain(code);
        if (reason !== "기타") expect(code).not.toBe("OTHER");
      }
    }
  });

  it("모르는 사유는 기타로 본다", () => {
    expect(defaultSanctionReason("없는 사유")).toBe("OTHER");
    expect(defaultSanctionReason(null)).toBe("OTHER");
    expect(sanctionReasonLabel("UNKNOWN")).toBe("기타");
  });
});

describe("validateSanctionDraft", () => {
  it("정상 입력은 통과한다", () => {
    expect(validateSanctionDraft({ type: "WARNING", reasonCode: "ABUSE" })).toBeNull();
    expect(validateSanctionDraft({ type: "SUSPENSION", days: 10, reasonCode: "SPAM" })).toBeNull();
    expect(validateSanctionDraft({ type: "BAN", reasonCode: "FRAUD" })).toBeNull();
    expect(validateSanctionDraft({ type: "LIFT", reasonCode: "OTHER" })).toBeNull();
  });

  it("목록 밖 정지 일수는 거절한다(AC-8)", () => {
    expect(validateSanctionDraft({ type: "SUSPENSION", days: 5, reasonCode: "SPAM" })).toMatch("1·3·7·10·30");
    expect(validateSanctionDraft({ type: "SUSPENSION", reasonCode: "SPAM" })).not.toBeNull();
    expect(validateSanctionDraft({ type: "WARNING", days: 3, reasonCode: "SPAM" })).not.toBeNull();
  });

  it("사유가 기타면 메시지 5자 이상이 필요하다(AC-14)", () => {
    expect(validateSanctionDraft({ type: "WARNING", reasonCode: "OTHER", messageToUser: " 짧음 " })).not.toBeNull();
    expect(validateSanctionDraft({ type: "WARNING", reasonCode: "OTHER", messageToUser: "다섯 글자 이상" })).toBeNull();
  });

  it("사유 없음·메시지·메모 길이 초과는 거절한다", () => {
    expect(validateSanctionDraft({ type: "WARNING" })).not.toBeNull();
    expect(validateSanctionDraft({ type: "WARNING", reasonCode: "SPAM", messageToUser: "가".repeat(301) })).not.toBeNull();
    expect(validateSanctionDraft({ type: "WARNING", reasonCode: "SPAM", internalNote: "가".repeat(501) })).not.toBeNull();
    // @ts-expect-error 잘못된 유형
    expect(validateSanctionDraft({ type: "MUTE", reasonCode: "SPAM" })).not.toBeNull();
  });
});

describe("날짜 문구", () => {
  it("KST 로 적는다", () => {
    expect(formatKstDate(NOW)).toBe("2026.10.09");
    expect(formatKstDateTime(NOW)).toBe("2026.10.09 14:20");
  });
});

describe("운영 알림 문구", () => {
  it("경고·정지·영구 정지 문구에 사유 라벨이 들어간다", () => {
    expect(warningNoticeMessage("ABUSE")).toBe("운영정책 위반으로 경고를 받았어요. 사유: 욕설·비하·혐오 표현");
    expect(suspensionNoticeMessage({ days: 3, until: NOW, extended: false, reasonCode: "SPAM" })).toBe(
      "운영정책 위반으로 3일 동안 이용이 정지되었어요. 사유: 스팸·광고"
    );
    expect(suspensionNoticeMessage({ days: 3, until: NOW, extended: true, reasonCode: "SPAM" })).toBe(
      "운영정책 위반으로 이용 정지가 3일 늘어났어요. 2026.10.09 이후 다시 이용할 수 있어요. 사유: 스팸·광고"
    );
    expect(banNoticeMessage("FRAUD")).toBe("운영정책 위반으로 이용이 영구 정지되었어요. 사유: 사기·허위 분양글");
  });

  it("사유가 없으면 사유 부분을 뺀다", () => {
    expect(warningNoticeMessage(null)).toBe("운영정책 위반으로 경고를 받았어요.");
  });

  it("숨김 문구는 대상 종류·제목 앞 20자·사유를 담고 받침에 맞는 조사를 쓴다(AC-6)", () => {
    expect(contentHiddenMessage("POST", "왕사슴벌레 유충 분양합니다", "SPAM")).toBe(
      "작성하신 게시글 '왕사슴벌레 유충 분양합니다'가 운영정책 위반(스팸·광고)으로 숨김 처리되었어요. 나에게만 보여요."
    );
    expect(contentHiddenMessage("COMMENT", "초보면 가만히나 있지", "ABUSE")).toBe(
      "작성하신 댓글 '초보면 가만히나 있지'가 운영정책 위반(욕설·비하·혐오 표현)으로 숨김 처리되었어요. 나에게만 보여요."
    );
    expect(contentHiddenMessage("PRODUCT", "넓적사슴벌레 3령 유충", null)).toBe(
      "작성하신 분양글 '넓적사슴벌레 3령 유충'이 운영정책 위반으로 숨김 처리되었어요. 나에게만 보여요."
    );
    expect(contentHiddenMessage("AUCTION", "", "FRAUD")).toBe(
      "작성하신 경매가 운영정책 위반(사기·허위 분양글)으로 숨김 처리되었어요. 나에게만 보여요."
    );
  });

  it("긴 제목은 20자에서 자른다", () => {
    expect(previewTitle("가".repeat(25))).toBe(`${"가".repeat(20)}…`);
    expect(previewTitle("  여러   칸  ")).toBe("여러 칸");
  });

  it("숨김 해제·삭제·신고자 문구", () => {
    expect(contentUnhiddenMessage("POST", "왕사슴벌레")).toBe("'왕사슴벌레' 숨김이 해제되어 다시 공개되었어요.");
    expect(contentUnhiddenMessage("COMMENT", null)).toBe("작성하신 댓글의 숨김이 해제되어 다시 공개되었어요.");
    expect(contentDeletedMessage("POST", "abc", "PRIVACY")).toBe(
      "작성하신 게시글 'abc'이(가) 운영정책 위반(개인정보 노출)으로 삭제되었어요."
    );
    expect(reporterActionMessage("POST")).toBe("신고하신 게시글에 대해 운영정책에 따라 조치했어요.");
    expect(reporterActionMessage("AUCTION")).toBe("신고하신 경매에 대해 운영정책에 따라 조치했어요.");
  });
});
