/**
 * @jest-environment node
 */

/**
 * 상품·경매 혈통 메모(pedigreeNote) 값 범위와 표시 문자열. libs/shared/pedigree-note.ts
 * (앱 src/lib/pedigreeNote.ts 와 같은 규칙)
 */
import {
  PEDIGREE_GENERATIONS,
  PEDIGREE_MM_MAX,
  PEDIGREE_MM_MIN,
  formatPedigreeNote,
  isValidPedigreeMm,
  parsePedigreeNote,
  pedigreeGenerationLabel,
} from "@libs/shared/pedigree-note";

describe("pedigreeNote 검증", () => {
  it("소수 둘째 자리·범위 밖 크기는 거부한다", () => {
    expect(parsePedigreeNote({ sireMm: 81.25 })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ damMm: 0 })).toEqual({ ok: false, field: "damMm" });
    expect(parsePedigreeNote({ sireMm: 501 })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ sireMm: -3 })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ sireMm: "abc" })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ sireMm: true })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ sireMm: Number.NaN })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ sireMm: Number.POSITIVE_INFINITY })).toEqual({ ok: false, field: "sireMm" });
    expect(parsePedigreeNote({ damMm: "0" })).toEqual({ ok: false, field: "damMm" });

    expect(parsePedigreeNote({ sireMm: PEDIGREE_MM_MIN })).toEqual({ ok: true, value: { sireMm: 1 } });
    expect(parsePedigreeNote({ sireMm: PEDIGREE_MM_MAX })).toEqual({ ok: true, value: { sireMm: 500 } });
    expect(parsePedigreeNote({ sireMm: 81.2, damMm: 47.5 })).toEqual({
      ok: true,
      value: { sireMm: 81.2, damMm: 47.5 },
    });
    // 문자열 숫자도 받는다
    expect(parsePedigreeNote({ sireMm: "81.2", damMm: " 47.5 " })).toEqual({
      ok: true,
      value: { sireMm: 81.2, damMm: 47.5 },
    });
    expect(isValidPedigreeMm(81.2)).toBe(true);
    expect(isValidPedigreeMm(81.25)).toBe(false);
    expect(isValidPedigreeMm(0.5)).toBe(false);
  });

  it("누대는 목록 값만 받는다", () => {
    expect(PEDIGREE_GENERATIONS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "unknown"]);
    for (const generation of PEDIGREE_GENERATIONS) {
      expect(parsePedigreeNote({ generation })).toEqual({ ok: true, value: { generation } });
    }
    expect(parsePedigreeNote({ generation: "F10" })).toEqual({ ok: false, field: "generation" });
    expect(parsePedigreeNote({ generation: "f3" })).toEqual({ ok: false, field: "generation" });
    expect(parsePedigreeNote({ generation: "F0" })).toEqual({ ok: false, field: "generation" });
    expect(parsePedigreeNote({ generation: 3 })).toEqual({ ok: false, field: "generation" });
  });

  it("비면 null, 모르는 키는 버린다", () => {
    expect(parsePedigreeNote(undefined)).toEqual({ ok: true, value: null });
    expect(parsePedigreeNote(null)).toEqual({ ok: true, value: null });
    expect(parsePedigreeNote({})).toEqual({ ok: true, value: null });
    expect(parsePedigreeNote({ sireMm: "", damMm: null, generation: "" })).toEqual({ ok: true, value: null });
    expect(parsePedigreeNote({ foo: 1 })).toEqual({ ok: true, value: null });

    const parsed = parsePedigreeNote({ sireMm: 81.2, foo: 1, generation: "F3" });
    expect(parsed).toEqual({ ok: true, value: { sireMm: 81.2, generation: "F3" } });
    expect(parsed.ok && parsed.value && Object.keys(parsed.value).sort()).toEqual(["generation", "sireMm"]);

    // 객체가 아니면 형식 오류
    expect(parsePedigreeNote("F3")).toEqual({ ok: false, field: "pedigreeNote" });
    expect(parsePedigreeNote([81.2])).toEqual({ ok: false, field: "pedigreeNote" });
    expect(parsePedigreeNote(81.2)).toEqual({ ok: false, field: "pedigreeNote" });
  });

  it("표시 순서는 누대·부·모", () => {
    expect(formatPedigreeNote({ sireMm: 81.2, damMm: 47.5, generation: "F3" })).toBe(
      "누대 F3 · 부 81.2mm · 모 47.5mm"
    );
    expect(formatPedigreeNote({ damMm: 47.5 })).toBe("모 47.5mm");
    expect(formatPedigreeNote({ sireMm: 80, generation: "unknown" })).toBe("누대 모름 · 부 80mm");
    expect(formatPedigreeNote(null)).toBe("");
    expect(formatPedigreeNote(undefined)).toBe("");
    expect(formatPedigreeNote({})).toBe("");
    expect(pedigreeGenerationLabel("F1")).toBe("F1");
    expect(pedigreeGenerationLabel("unknown")).toBe("모름");
  });
});
