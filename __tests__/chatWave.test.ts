import {
  isWavePresetId,
  waveButtonLabel,
  waveButtonState,
  WAVE_DAILY_LIMIT,
  waveErrorMessage,
  WAVE_PRESETS,
  wavePresetText,
  wavesLeftCaption,
} from "@libs/shared/chatWave";

/** 앱 scripts/web-tests/chatWave.test.ts 와 같은 사본. */
describe("chatWave", () => {
  it("문구는 3개, id 가 겹치지 않고 '상품·판매·구매'를 쓰지 않는다", () => {
    expect(WAVE_PRESETS).toHaveLength(3);
    expect(new Set(WAVE_PRESETS.map((p) => p.id)).size).toBe(3);
    for (const preset of WAVE_PRESETS) {
      expect(preset.text.trim()).not.toBe("");
      expect(preset.text).not.toMatch(/상품|판매|구매/);
    }
  });

  it("문구 id 를 확인하고 글을 돌려준다", () => {
    expect(isWavePresetId("hello")).toBe(true);
    expect(isWavePresetId("")).toBe(false);
    expect(isWavePresetId(1)).toBe(false);
    expect(wavePresetText("friend")).toContain("동네 친구");
    expect(wavePresetText("nope")).toBeNull();
  });

  it("버튼 상태는 인사함이 한도보다 먼저다", () => {
    expect(waveButtonState({ waved: true, wavesLeftToday: 0 })).toBe("waved");
    expect(waveButtonState({ waved: false, wavesLeftToday: 0 })).toBe("limit");
    expect(waveButtonState({ waved: false, wavesLeftToday: 3 })).toBe("ready");
    expect(waveButtonState({})).toBe("ready");
    expect(waveButtonLabel("waved")).toBe("인사함");
  });

  it("남은 횟수 안내", () => {
    expect(WAVE_DAILY_LIMIT).toBe(10);
    expect(wavesLeftCaption(10)).toBeNull();
    expect(wavesLeftCaption(undefined)).toBeNull();
    expect(wavesLeftCaption(3)).toBe("오늘 3명 더 인사할 수 있어요");
    expect(wavesLeftCaption(0)).toContain("여기까지");
  });

  it("오류 문구", () => {
    expect(waveErrorMessage("WAVE_LIMIT")).toContain("하루 10명");
    expect(waveErrorMessage("WAVE_ALREADY")).toBe("이미 인사한 브리더예요");
    expect(waveErrorMessage("UNKNOWN")).toContain("보내지 못했어요");
    expect(waveErrorMessage(undefined)).toContain("보내지 못했어요");
  });
});
