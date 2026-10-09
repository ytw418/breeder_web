import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

import SanctionsClient from "../app/(web)/settings/sanctions/SanctionsClient";

const NOW = "2026-10-09T05:20:00.000Z";

function renderWith(body: unknown) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: async () => body }}>
      <SanctionsClient />
    </SWRConfig>
  );
}

describe("내 제재 내역(웹 S-8, AC-34)", () => {
  it("경고·해제·기간 정지를 최신순으로 보여 주고 고객센터 안내를 둔다", async () => {
    renderWith({
      success: true,
      recentWarningCount: 1,
      recentSuspensionCount: 1,
      sanctions: [
        {
          id: 3,
          type: "WARNING",
          reasonCode: "ABUSE",
          reasonLabel: "욕설·비하·혐오 표현",
          messageToUser: "댓글에서 비하 표현이 확인되었어요.",
          days: null,
          startsAt: NOW,
          endsAt: null,
          target: { type: "COMMENT", id: 9, title: null, excerpt: "초보면 가만히나 있지" },
          acknowledgedAt: NOW,
          createdAt: NOW,
        },
        {
          id: 2,
          type: "LIFT",
          reasonCode: "OTHER",
          reasonLabel: "기타",
          messageToUser: null,
          days: null,
          startsAt: "2026-10-04T09:05:00.000Z",
          endsAt: null,
          target: null,
          acknowledgedAt: null,
          createdAt: "2026-10-04T09:05:00.000Z",
        },
        {
          id: 1,
          type: "SUSPENSION",
          reasonCode: "SPAM",
          reasonLabel: "스팸·광고",
          messageToUser: null,
          days: 3,
          startsAt: "2026-10-02T01:30:00.000Z",
          endsAt: "2026-10-05T01:30:00.000Z",
          target: null,
          acknowledgedAt: null,
          createdAt: "2026-10-02T01:30:00.000Z",
        },
      ],
    });

    expect(await screen.findByText("경고")).toBeTruthy();
    expect(screen.getByText("정지 해제")).toBeTruthy();
    expect(screen.getByText("3일 정지")).toBeTruthy();
    expect(screen.getByText("욕설·비하·혐오 표현")).toBeTruthy();
    expect(screen.getByText("초보면 가만히나 있지")).toBeTruthy();
    expect(screen.getByText("이용 정지가 해제되었어요.")).toBeTruthy();
    expect(screen.getByText("2026.10.02 ~ 2026.10.05")).toBeTruthy();
    expect(screen.getByRole("link", { name: "고객센터" }).getAttribute("href")).toBe("/support");
    // 내부 메모·운영자 정보는 화면에 없다(응답에도 없다).
    expect(screen.queryByText(/내부 메모|운영자 이름/)).toBeNull();
  });

  it("내역이 없으면 빈 상태", async () => {
    renderWith({ success: true, recentWarningCount: 0, recentSuspensionCount: 0, sanctions: [] });
    expect(await screen.findByText("받은 제재가 없어요")).toBeTruthy();
  });
});
