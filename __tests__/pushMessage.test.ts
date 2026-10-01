import {
  buildFcmMessage,
  getPushClientPlatform,
  toAbsoluteClickUrl,
} from "@libs/server/pushMessage";

const payload = {
  title: "브리디 테스트 알림",
  body: "알림 본문",
  url: "https://bredy.app/notifications",
  tag: "push-test-1",
};

describe("getPushClientPlatform", () => {
  it("앱 userAgent에서 OS를 구분해야 함", () => {
    expect(getPushClientPlatform("BredyApp/1.0.0 (android)")).toBe("android");
    expect(getPushClientPlatform("BredyApp/1.0.0 (ios)")).toBe("ios");
  });

  it("앱이 아닌 userAgent는 web으로 판단해야 함", () => {
    expect(getPushClientPlatform(undefined)).toBe("web");
    expect(getPushClientPlatform("Mozilla/5.0 (iPhone)")).toBe("web");
  });
});

describe("buildFcmMessage", () => {
  it("웹 토큰은 기존처럼 data 전용 + webpush 링크로 보내야 함", () => {
    const message = buildFcmMessage("t", "Mozilla/5.0", payload);
    expect(message).toEqual({
      token: "t",
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      },
      webpush: {
        fcmOptions: { link: payload.url },
        headers: { Urgency: "high" },
      },
    });
  });

  it("Android 앱 토큰은 notification + 고우선순위로 보내고 data.body는 JSON이어야 함", () => {
    const message = buildFcmMessage("t", "BredyApp/1.0.0 (android)", payload);
    expect(message.notification).toEqual({
      title: payload.title,
      body: payload.body,
    });
    expect(message.android).toEqual({
      priority: "high",
      notification: { channelId: "default", tag: payload.tag, sound: "default" },
    });
    // expo-notifications는 data.body를 JSON으로 파싱하고 data.message를 본문으로 쓴다.
    expect(JSON.parse(message.data!.body)).toEqual({
      url: payload.url,
      tag: payload.tag,
    });
    expect(message.data!.message).toBe(payload.body);
    expect(message.data!.url).toBe(payload.url);
    expect(message.webpush).toBeUndefined();
  });

  it("iOS 앱 토큰은 APNs alert + 커스텀 body 딕셔너리로 보내야 함", () => {
    const message = buildFcmMessage("t", "BredyApp/1.0.0 (ios)", payload);
    expect(message.notification).toEqual({
      title: payload.title,
      body: payload.body,
    });
    expect(message.apns).toEqual({
      headers: { "apns-priority": "10" },
      payload: {
        aps: { sound: "default", threadId: payload.tag },
        // expo-notifications(iOS)는 userInfo.body 딕셔너리를 content.data로 노출한다.
        body: { url: payload.url, tag: payload.tag },
      },
    });
    expect(message.data).toEqual({ url: payload.url, tag: payload.tag });
    expect(message.webpush).toBeUndefined();
  });
});

describe("toAbsoluteClickUrl", () => {
  it("상대 경로를 기준 도메인에 붙여 절대 URL로 만들어야 함", () => {
    expect(toAbsoluteClickUrl("/notifications", "https://bredy.app")).toBe(
      "https://bredy.app/notifications"
    );
  });

  it("기준 도메인에 프로토콜이 없어도 https로 보정해야 함", () => {
    expect(
      toAbsoluteClickUrl(
        "/notifications",
        "breeder-web-git-dev-holicreacts-projects.vercel.app"
      )
    ).toBe("https://breeder-web-git-dev-holicreacts-projects.vercel.app/notifications");
  });

  it("기준 도메인이 비어 있으면 운영 도메인을 사용해야 함", () => {
    expect(toAbsoluteClickUrl("/notifications", "")).toBe(
      "https://bredy.app/notifications"
    );
    expect(toAbsoluteClickUrl("/notifications", undefined)).toBe(
      "https://bredy.app/notifications"
    );
  });

  it("이미 절대 URL이면 그대로 두고, 비어 있으면 루트로 보내야 함", () => {
    expect(toAbsoluteClickUrl("https://example.com/a", "https://bredy.app")).toBe(
      "https://example.com/a"
    );
    expect(toAbsoluteClickUrl("  ", "https://bredy.app")).toBe("https://bredy.app/");
  });
});
