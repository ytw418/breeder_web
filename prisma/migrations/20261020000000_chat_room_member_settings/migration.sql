-- 채팅방 나가기·알림 끄기(앱 docs/prd/chat-room-settings.md, 2026-10-20). 널 허용 열 추가만 한다.
ALTER TABLE "ChatRoomMember" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
ALTER TABLE "ChatRoomMember" ADD COLUMN IF NOT EXISTS "mutedAt" TIMESTAMP(3);
