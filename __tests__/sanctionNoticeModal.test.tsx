import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const mockAuthFetch = jest.fn();
jest.mock("@libs/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));
const mockToastError = jest.fn();
jest.mock("@libs/client/toast", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args), success: jest.fn() },
}));

import SanctionNoticeModal from "@components/features/moderation/SanctionNoticeModal";
import {
  getNotificationHref,
  getNotificationIcon,
} from "../app/(web)/notifications/notificationFormat";

const NOW = "2026-10-09T05:20:00.000Z";
const warning = {
  id: 3,
  type: "WARNING",
  reasonCode: "ABUSE",
  reasonLabel: "욕설·비하·혐오 표현",
  messageToUser: "댓글에서 다른 회원을 비하하는 표현이 확인되었어요.",
  days: null,
  startsAt: NOW,
  endsAt: null,
  target: { type: "COMMENT", id: 9, title: "초보면", excerpt: "초보면 가만히나 있지" },
  acknowledgedAt: null,
  createdAt: NOW,
};
const endedSuspension = {
  ...warning,
  id: 4,
  type: "SUSPENSION",
  reasonCode: "SPAM",
  reasonLabel: "스팸·광고",
  messageToUser: null,
  days: 3,
  startsAt: "2026-10-06T05:20:00.000Z",
  endsAt: NOW,
  target: null,
};

let notices: unknown[] = [];

function renderModal(children: ReactNode = <SanctionNoticeModal enabled />) {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: async () => ({ success: true, sanctions: notices, recentWarningCount: 1, recentSuspensionCount: 1 }),
      }}
    >
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  notices = [warning, endedSuspension];
  mockAuthFetch.mockImplementation(async (_url: string, init: { body: string }) => {
    const { id } = JSON.parse(init.body);
    notices = notices.filter((item) => (item as { id: number }).id !== id);
    return { ok: true, json: async () => ({ success: true }) };
  });
});

describe("SanctionNoticeModal(웹 S-5)", () => {
  it("미확인 경고를 사유·메시지·관련 콘텐츠·누적 경고와 함께 보여 준다", async () => {
    renderModal();
    expect(await screen.findByRole("dialog", { name: "운영정책 위반 안내" })).toBeTruthy();
    expect(screen.getByText("욕설·비하·혐오 표현")).toBeTruthy();
    expect(screen.getByText("댓글에서 다른 회원을 비하하는 표현이 확인되었어요.")).toBeTruthy();
    expect(screen.getByText("초보면 가만히나 있지")).toBeTruthy();
    expect(screen.getByText("2026.10.09 14:20")).toBeTruthy();
    expect(screen.getByText("최근 180일 경고 1회. 계속 위반하면 이용이 정지될 수 있어요.")).toBeTruthy();
    // 운영정책 문서가 없어 '운영정책 보기'는 두지 않는다.
    expect(screen.queryByText("운영정책 보기")).toBeNull();
  });

  it("Esc 로 닫히지 않고, 확인하면 PATCH 후 다음(끝난 정지) 안내를 보여 준다(AC-21·AC-22·AC-23)", async () => {
    renderModal();
    await screen.findByRole("dialog", { name: "운영정책 위반 안내" });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "운영정책 위반 안내" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));
    });
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/users/me/sanctions", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: 3 }) }));
    expect(await screen.findByRole("dialog", { name: "이용 정지가 끝났어요" })).toBeTruthy();
    expect(screen.getByText("3일 (2026.10.06 ~ 2026.10.09)")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("확인 요청이 실패하면 토스트를 띄우고 모달을 유지한다(E-7)", async () => {
    mockAuthFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) });
    renderModal();
    await screen.findByRole("dialog", { name: "운영정책 위반 안내" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));
    });
    expect(mockToastError).toHaveBeenCalledWith("잠시 후 다시 시도해 주세요.");
    expect(screen.getByRole("dialog", { name: "운영정책 위반 안내" })).toBeTruthy();
  });

  it("미확인 안내가 없거나 비로그인이면 그리지 않는다", async () => {
    notices = [];
    const { container } = renderModal();
    await waitFor(() => expect(container.innerHTML).toBe(""));
    renderModal(<SanctionNoticeModal enabled={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("운영 알림 행(웹 S-7)", () => {
  it("MODERATION 은 방패 아이콘, 제재 알림은 내 제재 내역으로 간다(AC-28)", () => {
    expect(getNotificationIcon("MODERATION")).toBe("shield");
    expect(getNotificationHref("sanction", 100)).toBe("/settings/sanctions");
    expect(getNotificationHref("post", 30)).toMatch(/^\/posts\/30/);
  });
});
