import { toJsonLdHtml } from "@libs/shared/seo";

describe("toJsonLdHtml", () => {
  it("사용자가 쓴 제목에 </script> 가 있어도 구조화 데이터 태그를 닫지 못한다", () => {
    const html = toJsonLdHtml({ name: '</script><script>alert(1)</script> & "게코"' });
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual({ name: '</script><script>alert(1)</script> & "게코"' });
  });
});
