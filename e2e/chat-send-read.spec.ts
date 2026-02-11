import { expect, test } from "@playwright/test";

test("채팅방 진입 후 메시지 전송 및 읽음 동기화가 동작한다", async ({ page }) => {
  let readSyncCount = 0;
  let sendCount = 0;
  let sequence = 100;

  const messages = [
    {
      id: 100,
      type: "TEXT",
      message: "안녕하세요. 테스트 시작 메시지입니다.",
      image: null,
      createdAt: new Date("2026-01-01T09:00:00.000Z").toISOString(),
      user: {
        id: 22,
        name: "테스트상대",
        avatar: null,
      },
    },
  ];

  // 로그인 사용자 고정 응답: 채팅방 접근/전송 권한을 확보한다.
  await page.route("**/api/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        profile: {
          id: 7,
          role: "USER",
          status: "ACTIVE",
          snsId: "e2e-buyer",
          provider: "kakao",
          phone: null,
          email: "buyer@bredy.local",
          name: "E2E구매자",
          avatar: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        },
      }),
    });
  });

  // 채팅방 조회 API를 모킹해 초기 메시지와 멤버 상태를 통제한다.
  await page.route(/\/api\/chat\/777\?limit=20.*$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        chatRoom: {
          id: 777,
          messages,
          chatRoomMembers: [
            {
              id: 1,
              userId: 7,
              chatRoomId: 777,
              lastReadAt: new Date("2026-01-01T08:50:00.000Z").toISOString(),
              user: {
                id: 7,
                name: "E2E구매자",
                avatar: null,
              },
            },
            {
              id: 2,
              userId: 22,
              chatRoomId: 777,
              lastReadAt: null,
              user: {
                id: 22,
                name: "테스트상대",
                avatar: null,
              },
            },
          ],
        },
        pagination: {
          limit: 20,
          hasMore: false,
          nextCursor: null,
        },
      }),
    });
  });

  // 메시지 목록 동기화 시 읽음 처리 API가 호출되는지 카운트한다.
  await page.route("**/api/chat/777/read", async (route) => {
    readSyncCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  // 전송 API 모킹: 요청 본문을 반영한 새 메시지를 즉시 반환한다.
  await page.route("**/api/chat/777/message", async (route) => {
    sendCount += 1;
    const payload = JSON.parse(route.request().postData() || "{}");
    sequence += 1;

    const nextMessage = {
      id: sequence,
      type: "TEXT",
      message: payload.message || "",
      image: null,
      createdAt: new Date().toISOString(),
      user: {
        id: 7,
        name: "E2E구매자",
        avatar: null,
      },
    };
    messages.push(nextMessage);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: nextMessage,
      }),
    });
  });

  // 읽음 처리 성공 후 트리거되는 chatList 재검증 요청을 흡수한다.
  await page.route("**/api/chat/chatList", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        chatRooms: [],
      }),
    });
  });

  await page.goto("/chat/777");

  await expect(
    page.getByText("안녕하세요. 테스트 시작 메시지입니다.")
  ).toBeVisible();

  // 실제 입력/전송 버튼 경로로 사용자 메시지 전송 플로우를 재현한다.
  await page.getByPlaceholder("메시지를 입력하세요").fill("E2E 새 메시지");
  await page.getByRole("button", { name: "메시지 전송" }).click();

  // 메시지 렌더링 + 전송/읽음 API 호출이 모두 발생했는지 확인한다.
  await expect(page.getByText("E2E 새 메시지")).toBeVisible();
  await expect.poll(() => sendCount).toBe(1);
  await expect.poll(() => readSyncCount).toBeGreaterThan(0);
});
