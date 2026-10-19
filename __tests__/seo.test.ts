import { toJsonLdHtml, toPageTitle } from "@libs/shared/seo";

describe("toJsonLdHtml", () => {
  it("사용자가 쓴 제목에 </script> 가 있어도 구조화 데이터 태그를 닫지 못한다", () => {
    const html = toJsonLdHtml({ name: '</script><script>alert(1)</script> & "게코"' });
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual({ name: '</script><script>alert(1)</script> & "게코"' });
  });
});

describe("toPageTitle", () => {
  it("넘치면 종 꼬리를 빼고, 그래도 길면 글 제목을 잘라 템플릿 포함 40자 안에 둔다", () => {
    expect(toPageTitle("리키에너스", "파충류 분양")).toBe("리키에너스 - 파충류 분양");
    expect(toPageTitle("판도라의 메인으로 활동해 주었던 드리피 스팟 숫 아이 분양합니다!", "크레스티드 게코 분양")).toBe(
      "판도라의 메인으로 활동해 주었던 드리피 스팟 숫 아이 분양합…"
    );
    expect(toPageTitle("빡 쿼드 크레스티드 게코 분양해봅니다!", "크레스티드 게코 분양")).toBe(
      "빡 쿼드 크레스티드 게코 분양해봅니다!"
    );
  });
});
