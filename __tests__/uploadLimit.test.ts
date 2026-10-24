import { takeUploadSlot, UPLOAD_MAX_PER_WINDOW, UPLOAD_WINDOW_MS } from "@libs/server/uploadLimit";

describe("takeUploadSlot — 계정당 10분 업로드 URL 발급 제한", () => {
  it("한도까지는 허용하고 넘으면 막다가, 10분이 지나면 다시 허용한다", () => {
    const now = 1_000_000;
    for (let i = 0; i < UPLOAD_MAX_PER_WINDOW; i += 1) {
      expect(takeUploadSlot(7, now + i)).toBe(true);
    }
    expect(takeUploadSlot(7, now + UPLOAD_MAX_PER_WINDOW)).toBe(false);
    expect(takeUploadSlot(8, now)).toBe(true);
    expect(takeUploadSlot(7, now + UPLOAD_WINDOW_MS + UPLOAD_MAX_PER_WINDOW)).toBe(true);
  });
});
