jest.mock("@libs/server/client", () => ({ __esModule: true, default: {} }));

import {
  canViewAuctionContact,
  keepStoredContactWhenMasked,
  maskEmail,
  maskPhone,
  toViewerAuctionContact,
} from "@libs/server/auctionContact";

describe("경매 판매자 연락처 가리기", () => {
  it("전화번호는 앞자리·끝 4자리만 남기고 가운데를 ****로 가린다", () => {
    expect(maskPhone("01088364924")).toBe("010-****-4924");
    expect(maskPhone("010-8836-4924")).toBe("010-****-4924");
    expect(maskPhone("02-1234-5678")).toBe("02-****-5678");
    expect(maskPhone("+82 10-8836-4924")).toBe("010-****-4924");
  });

  it("숫자가 너무 적은 전화번호는 통째로 ***", () => {
    expect(maskPhone("1234")).toBe("***");
    expect(maskPhone("연락 주세요")).toBe("***");
  });

  it("이메일은 아이디 앞 2글자와 도메인만 남긴다(아이디 길이는 드러내지 않는다)", () => {
    expect(maskEmail("rkdxh115@naver.com")).toBe("rk****@naver.com");
    expect(maskEmail("a@b.kr")).toBe("a****@b.kr");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});

describe("경매 판매자 연락처를 볼 수 있는 사람", () => {
  const ended = { userId: 1, winnerId: 2, status: "종료" };

  it("판매자 본인·낙찰자·운영자만 본다", () => {
    expect(canViewAuctionContact(ended, { id: 1 })).toBe(true);
    expect(canViewAuctionContact(ended, { id: 2 })).toBe(true);
    expect(canViewAuctionContact(ended, { id: 9, role: "ADMIN" })).toBe(true);
  });

  it("비로그인·다른 입찰자는 못 본다", () => {
    expect(canViewAuctionContact(ended, null)).toBe(false);
    expect(canViewAuctionContact(ended, undefined)).toBe(false);
    expect(canViewAuctionContact(ended, { id: 3 })).toBe(false);
  });

  it("낙찰이 확정되기 전(진행중)에는 최고 입찰자라도 못 본다", () => {
    expect(
      canViewAuctionContact({ userId: 1, winnerId: 2, status: "진행중" }, { id: 2 })
    ).toBe(false);
  });
});

describe("응답에 실을 연락처", () => {
  const auction = {
    userId: 1,
    winnerId: 2,
    status: "종료",
    sellerPhone: "01088364924",
    sellerEmail: "rkdxh115@naver.com",
  };

  it("볼 수 없는 사람에게는 가린 값과 sellerContactMasked=true", () => {
    expect(toViewerAuctionContact(auction, { id: 3 })).toEqual({
      sellerPhone: "010-****-4924",
      sellerEmail: "rk****@naver.com",
      sellerContactMasked: true,
    });
  });

  it("볼 수 있는 사람에게는 원래 값과 sellerContactMasked=false", () => {
    expect(toViewerAuctionContact(auction, { id: 2 })).toEqual({
      sellerPhone: "01088364924",
      sellerEmail: "rkdxh115@naver.com",
      sellerContactMasked: false,
    });
  });

  it("연락처를 안 적었으면 null 그대로, 가린 것도 아니다", () => {
    expect(
      toViewerAuctionContact({ ...auction, sellerPhone: null, sellerEmail: null }, null)
    ).toEqual({ sellerPhone: null, sellerEmail: null, sellerContactMasked: false });
  });
});

describe("수정 때 가린 값이 되돌아오면 저장된 값을 지킨다", () => {
  it("가린 모양과 같으면 저장된 원래 값을 쓴다", () => {
    expect(keepStoredContactWhenMasked("010-****-4924", "01088364924", maskPhone)).toBe(
      "01088364924"
    );
    expect(
      keepStoredContactWhenMasked("rk****@naver.com", "rkdxh115@naver.com", maskEmail)
    ).toBe("rkdxh115@naver.com");
  });

  it("새로 적은 값이면 그 값을 쓴다", () => {
    expect(keepStoredContactWhenMasked("010-1111-2222", "01088364924", maskPhone)).toBe(
      "010-1111-2222"
    );
    expect(keepStoredContactWhenMasked(undefined, "01088364924", maskPhone)).toBeUndefined();
  });
});
