import {
  buildChatItems,
  chatListEmptyMessage,
  chatPreview,
  composerPlaceholder,
  filterChatRooms,
  findReadReceiptMessageId,
  formatChatDay,
  formatChatListTime,
  formatChatTime,
  imageUploadNotices,
  isDeletedPartnerName,
  mergeMessages,
  planImageUploads,
  MAX_CHAT_IMAGE_SIZE,
} from "@/app/(web)/chat/chatFormat";

const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe("formatChatListTime", () => {
  const now = at(2026, 10, 6, 15, 0);
  it("상대 시간 → 7일 뒤 날짜", () => {
    expect(formatChatListTime(at(2026, 10, 6, 14, 59).toISOString(), now)).toBe("1분 전");
    expect(formatChatListTime(new Date(now.getTime() - 10_000).toISOString(), now)).toBe("방금 전");
    expect(formatChatListTime(at(2026, 10, 6, 12, 0).toISOString(), now)).toBe("3시간 전");
    expect(formatChatListTime(at(2026, 10, 5, 9, 0).toISOString(), now)).toBe("어제");
    expect(formatChatListTime(at(2026, 10, 3, 9, 0).toISOString(), now)).toBe("3일 전");
    expect(formatChatListTime(at(2026, 9, 24).toISOString(), now)).toBe("9월 24일");
    expect(formatChatListTime(at(2025, 9, 4).toISOString(), now)).toBe("2025.09.04");
    expect(formatChatListTime(null, now)).toBe("");
    expect(formatChatListTime("nope", now)).toBe("");
  });
});

describe("formatChatTime / formatChatDay", () => {
  it("오전/오후 12시간제", () => {
    expect(formatChatTime(at(2026, 2, 14, 14, 41).toISOString())).toBe("오후 2:41");
    expect(formatChatTime(at(2026, 2, 14, 0, 5).toISOString())).toBe("오전 12:05");
    expect(formatChatTime(at(2026, 2, 14, 12, 0).toISOString())).toBe("오후 12:00");
  });
  it("오늘/어제/요일", () => {
    const now = at(2026, 10, 6);
    expect(formatChatDay(at(2026, 10, 6, 1), now)).toBe("오늘");
    expect(formatChatDay(at(2026, 10, 5, 23), now)).toBe("어제");
    expect(formatChatDay(at(2026, 2, 13), now)).toBe("2월 13일 금요일");
  });
});

describe("목록", () => {
  const rooms = [
    { id: 1, unreadCount: 2, chatRoomMembers: [{ user: { id: 1, name: "나" } }, { user: { id: 2, name: "레오파드하우스" } }] },
    { id: 2, unreadCount: 0, chatRoomMembers: [{ user: { id: 1, name: "나" } }, { user: { id: 3, name: "이끼동산" } }] },
  ];
  it("안 읽음 + 검색", () => {
    expect(filterChatRooms(rooms, { myId: 1, keyword: "", filter: "unread" }).map((r) => r.id)).toEqual([1]);
    expect(filterChatRooms(rooms, { myId: 1, keyword: "이끼", filter: "all" }).map((r) => r.id)).toEqual([2]);
    expect(filterChatRooms(rooms, { myId: 1, keyword: "나", filter: "all" })).toHaveLength(0);
  });
  it("빈 문구", () => {
    expect(chatListEmptyMessage("", "all")).toBe("아직 대화가 없습니다.");
    expect(chatListEmptyMessage("", "unread")).toBe("안 읽은 채팅이 없습니다.");
    expect(chatListEmptyMessage(" a ", "all")).toBe("검색 결과가 없습니다.");
    expect(chatListEmptyMessage("a", "unread")).toBe("'a'에 해당하는 안 읽은 채팅이 없습니다.");
  });
  it("미리보기", () => {
    expect(chatPreview(null)).toBe("아직 대화가 없습니다.");
    expect(chatPreview({ type: "IMAGE", message: "" })).toBe("사진을 보냈습니다");
    expect(chatPreview({ type: "TEXT", message: "a\n\n b" })).toBe("a b");
  });
});

describe("채팅방", () => {
  const msg = (id: number, userId: number, date: Date) => ({
    id,
    createdAt: date.toISOString(),
    user: { id: userId, avatar: null },
  });
  const now = at(2026, 2, 14, 18);
  const list = [
    msg(1, 2, at(2026, 2, 13, 14, 41)),
    msg(2, 1, at(2026, 2, 14, 14, 43)),
    msg(3, 1, at(2026, 2, 14, 14, 44)),
    msg(4, 1, at(2026, 2, 14, 14, 55)),
    msg(5, 2, at(2026, 2, 14, 14, 56)),
  ];

  it("merge 는 id 정렬·중복 제거", () => {
    expect(mergeMessages([list[2], list[0]], [list[0], list[1]]).map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("날짜 구분 + 5분 묶음", () => {
    const items = buildChatItems(list, 1, now);
    expect(items.map((i) => (i.type === "divider" ? i.label : i.messages.map((m) => m.id).join(",")))).toEqual([
      "어제",
      "1",
      "오늘",
      "2,3",
      "4",
      "5",
    ]);
    const mine = items.filter((i) => i.type === "group").map((i) => (i.type === "group" ? i.mine : null));
    expect(mine).toEqual([false, true, true, false]);
  });

  it("읽음 표시는 상대 lastReadAt 이전의 내 마지막 메시지", () => {
    expect(findReadReceiptMessageId(list, at(2026, 2, 14, 14, 50).toISOString(), 1)).toBe(3);
    expect(findReadReceiptMessageId(list, at(2026, 2, 14, 15).toISOString(), 1)).toBe(4);
    expect(findReadReceiptMessageId(list, null, 1)).toBeNull();
    expect(findReadReceiptMessageId(list, at(2026, 2, 1).toISOString(), 1)).toBeNull();
  });

  it("탈퇴·차단 잠금 문구", () => {
    expect(isDeletedPartnerName("탈퇴한 사용자")).toBe(true);
    expect(isDeletedPartnerName("탈퇴한 사용자#12")).toBe(true);
    expect(isDeletedPartnerName("탈퇴한사람")).toBe(false);
    expect(composerPlaceholder({ deleted: true, blocked: true })).toBe("탈퇴한 사용자예요. 더 이상 대화할 수 없어요.");
    expect(composerPlaceholder({ deleted: false, blocked: true })).toBe(
      "차단한 사용자예요. 차단을 해제하면 대화할 수 있어요."
    );
    expect(composerPlaceholder({ deleted: false, blocked: false })).toBe("메시지 보내기");
  });

  it("사진 10장 제한·10MB 초과·이미지 아님 제외", () => {
    const files = [
      ...Array.from({ length: 11 }, () => ({ type: "image/jpeg", size: 100 })),
    ];
    files[0] = { type: "image/png", size: MAX_CHAT_IMAGE_SIZE + 1 };
    files[1] = { type: "application/pdf", size: 10 };
    const { toSend, summary } = planImageUploads(files);
    expect(toSend).toHaveLength(8);
    expect(summary.oversized).toBe(1);
    expect(summary.invalidType).toBe(1);
    expect(imageUploadNotices({ ...summary, failed: 2, serverError: "이 사용자에게는 메시지를 보낼 수 없습니다." })).toEqual([
      "이미지 파일이 아닌 1개는 제외했습니다.",
      "10MB를 넘는 이미지 1장은 제외했습니다.",
      "이미지 2장을 보내지 못했습니다.",
      "이 사용자에게는 메시지를 보낼 수 없습니다.",
    ]);
  });
});
