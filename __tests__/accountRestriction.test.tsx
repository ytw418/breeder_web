import { fireEvent, render, screen } from "@testing-library/react";
import AccountRestrictedNotice from "@components/features/moderation/AccountRestrictedNotice";
import {
  clearAccountRestriction,
  readAccountRestriction,
  saveAccountRestriction,
  toAccountRestriction,
} from "@libs/client/accountRestriction";

beforeEach(() => window.sessionStorage.clear());

describe("toAccountRestriction", () => {
  it("정지·영구 정지 응답만 꺼낸다", () => {
    expect(toAccountRestriction({ errorCode: "ACCOUNT_DELETED", message: "x" })).toBeNull();
    expect(toAccountRestriction(null)).toBeNull();
    expect(
      toAccountRestriction({ errorCode: "ACCOUNT_BANNED", error: "이용이 영구 정지된 계정이에요.", reasonLabel: "사기·허위 매물" })
    ).toEqual({
      errorCode: "ACCOUNT_BANNED",
      message: "이용이 영구 정지된 계정이에요.",
      reasonLabel: "사기·허위 매물",
      messageToUser: undefined,
      suspendedUntil: undefined,
    });
  });

  it("저장·읽기·지우기", () => {
    saveAccountRestriction({ errorCode: "ACCOUNT_SUSPENDED", message: "m" });
    expect(readAccountRestriction()).toEqual(expect.objectContaining({ errorCode: "ACCOUNT_SUSPENDED" }));
    clearAccountRestriction();
    expect(readAccountRestriction()).toBeNull();
  });
});

describe("AccountRestrictedNotice(웹 S-6)", () => {
  it("기간 정지는 사유·운영자 메시지·해제 시각(KST)과 고객센터 문의를 보여 준다(AC-26)", () => {
    const onConfirm = jest.fn();
    render(
      <AccountRestrictedNotice
        restriction={{
          errorCode: "ACCOUNT_SUSPENDED",
          message: "x",
          reasonLabel: "욕설·비하·혐오 표현",
          messageToUser: "댓글에서 비하 표현이 확인되었어요.",
          suspendedUntil: "2026-10-19T05:20:00.000Z",
        }}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole("heading", { name: "이용이 정지된 계정이에요" })).toBeTruthy();
    expect(screen.getByText("욕설·비하·혐오 표현")).toBeTruthy();
    expect(screen.getByText("댓글에서 비하 표현이 확인되었어요.")).toBeTruthy();
    expect(screen.getByText("2026.10.19 14:20 이후 다시 이용할 수 있어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "고객센터 문의" }).getAttribute("href")).toBe("/support");
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("영구 정지는 해제일 없이, 사유 없는 옛 정지는 기간만 보인다(E-13)", () => {
    const { rerender } = render(
      <AccountRestrictedNotice restriction={{ errorCode: "ACCOUNT_BANNED", message: "x", reasonLabel: "사기·허위 매물" }} onConfirm={jest.fn()} />
    );
    expect(screen.getByRole("heading", { name: "이용이 영구 정지된 계정이에요" })).toBeTruthy();
    expect(screen.queryByText(/이후 다시 이용할 수 있어요/)).toBeNull();

    rerender(
      <AccountRestrictedNotice
        restriction={{ errorCode: "ACCOUNT_SUSPENDED", message: "x", suspendedUntil: "2026-10-12T00:30:00.000Z" }}
        onConfirm={jest.fn()}
      />
    );
    expect(screen.queryByText("사유")).toBeNull();
    expect(screen.getByText("2026.10.12 09:30 이후 다시 이용할 수 있어요.")).toBeTruthy();
  });
});
