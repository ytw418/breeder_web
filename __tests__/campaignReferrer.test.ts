import { CAMPAIGN_TTL_MS, currentCampaign, rememberCampaign } from "@libs/client/campaign";
import { PLAY_STORE_URL, pickUtmParams, playStoreUrlWithReferrer } from "@libs/shared/appLinks";

describe("pickUtmParams", () => {
  it("utm_* 만 꺼내고 키는 소문자, 빈 값은 버린다", () => {
    expect(pickUtmParams("?utm_source=ig&UTM_Medium=social&utm_term=&x=1")).toEqual({
      utm_source: "ig",
      utm_medium: "social",
    });
    expect(pickUtmParams("")).toEqual({});
    expect(pickUtmParams(null)).toEqual({});
  });
});

describe("playStoreUrlWithReferrer", () => {
  it("캠페인을 referrer 한 칸으로 인코딩해 붙인다", () => {
    const url = playStoreUrlWithReferrer({ utm_source: "ig", utm_medium: "paid", utm_campaign: "분양" });
    expect(url.startsWith(`${PLAY_STORE_URL}&referrer=`)).toBe(true);
    const referrer = new URL(url).searchParams.get("referrer");
    expect(referrer).toBe("utm_source=ig&utm_medium=paid&utm_campaign=%EB%B6%84%EC%96%91");
  });

  it("캠페인이 없으면 웹 기본값", () => {
    const referrer = new URL(playStoreUrlWithReferrer({})).searchParams.get("referrer");
    expect(referrer).toBe("utm_source=bredy_web&utm_medium=download_page");
  });
});

describe("rememberCampaign / currentCampaign", () => {
  beforeEach(() => window.localStorage.clear());

  it("지금 주소 utm 이 먼저, 없으면 남겨 둔 마지막 캠페인", () => {
    rememberCampaign("?utm_source=ig&utm_medium=social", 1000);
    expect(currentCampaign("", 2000)).toEqual({ utm_source: "ig", utm_medium: "social" });
    expect(currentCampaign("?utm_source=threads", 2000)).toEqual({ utm_source: "threads" });
  });

  it("utm 없는 주소는 남긴 값을 지우지 않는다", () => {
    rememberCampaign("?utm_source=ig", 1000);
    rememberCampaign("?q=1", 1500);
    expect(currentCampaign("", 2000)).toEqual({ utm_source: "ig" });
  });

  it("30일이 지나면 버린다", () => {
    rememberCampaign("?utm_source=ig", 1000);
    expect(currentCampaign("", 1000 + CAMPAIGN_TTL_MS + 1)).toEqual({});
  });
});
