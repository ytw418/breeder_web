/**
 * 보호소 글 본문 줄 읽기(앱 docs/prd/shelter-animals.md S-1 공고 D-n · S-3 출처 상자). 실제 변환 결과(toShelterProduct)로 읽어
 * buildDescription 줄 형식이 바뀌면 여기서 깨진다.
 */
import { toShelterProduct } from "@libs/shared/shelterAnimal";
import { parseShelterContact, shelterDeadlineLabel, shelterNoticeUrl, stripShelterContact } from "@libs/shared/shelterNotice";

const base = {
  desertionNo: "448000000000001",
  noticeNo: "경기-화성-2026-00001",
  noticeSdt: "20261020",
  noticeEdt: "20261030",
  popfile1: "http://www.animal.go.kr/files/shelter/2026/10/1.jpg",
  kindNm: "[개] 비숑 프리제",
  age: "2024(년생)",
  sexCd: "F",
  neuterYn: "Y",
  careNm: "화성시 동물보호센터",
  careTel: "031-123-4567",
  careAddr: "경기도 화성시 봉담읍 상리 1",
  orgNm: "경기도 화성시",
};

describe("shelterNotice", () => {
  it("연락처·공고번호를 읽고 본문에서는 그 덩어리를 뺀다", () => {
    const { description } = toShelterProduct(base, "강아지");
    expect(parseShelterContact(description)).toEqual({
      name: "화성시 동물보호센터",
      tel: "031-123-4567",
      address: "경기도 화성시 봉담읍 상리 1",
      noticeNo: "경기-화성-2026-00001",
    });
    const body = stripShelterContact(description);
    expect(body).toContain("공고 기간: 10.20 ~ 10.30");
    ["입양 문의는 보호소로", "031-123-4567", "출처:", "보호 기간이 지나면"].forEach((text) => expect(body).not.toContain(text));
  });

  it("전화가 없으면 이름만 읽고, 형식이 다른 본문은 그대로 둔다", () => {
    const { description } = toShelterProduct({ ...base, careTel: "" }, "강아지");
    expect(parseShelterContact(description)).toMatchObject({ name: "화성시 동물보호센터", tel: null });
    expect(stripShelterContact("직접 쓴 글")).toBe("직접 쓴 글");
  });

  it("공고 D-n: 오늘과 가장 가까운 해로 세고, 지났으면 null", () => {
    const { description } = toShelterProduct(base, "강아지");
    expect(shelterDeadlineLabel(description, "2026-10-27")).toBe("공고 D-3");
    expect(shelterDeadlineLabel(description, "2026-10-30")).toBe("공고 오늘 마감");
    expect(shelterDeadlineLabel(description, "2026-10-31")).toBeNull();
    expect(shelterDeadlineLabel("공고 마감: 01.02", "2026-12-30")).toBe("공고 D-3");
    expect(shelterDeadlineLabel("본문에 줄이 없어요", "2026-10-27")).toBeNull();
  });

  it("공고 원문 주소는 구조번호가 있을 때만", () => {
    expect(shelterNoticeUrl("448000000000001")).toBe(
      "https://www.animal.go.kr/front/awtis/protection/protectionDtl.do?desertionNo=448000000000001"
    );
    expect(shelterNoticeUrl(null)).toBeNull();
  });
});
