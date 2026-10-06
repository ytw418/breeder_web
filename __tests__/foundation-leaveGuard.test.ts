import {
  createLeaveGuardState,
  isInterceptableHref,
  leaveGuardTransition,
  shouldBlockLeave,
} from "@libs/client/leaveGuard";

describe("leaveGuard 상태 머신", () => {
  it("dirty 가 아니면 이탈을 막지 않고 바로 진행한다", () => {
    const state = createLeaveGuardState(false);
    const { state: next, proceed } = leaveGuardTransition(state, {
      type: "attempt",
      target: { kind: "href", href: "/posts" },
    });
    expect(shouldBlockLeave(state)).toBe(false);
    expect(proceed).toEqual({ kind: "href", href: "/posts" });
    expect(next.prompt).toBeNull();
  });

  it("dirty 면 확인 창(prompt)을 띄우고 진행하지 않는다", () => {
    const state = createLeaveGuardState(true);
    const { state: next, proceed } = leaveGuardTransition(state, {
      type: "attempt",
      target: { kind: "back" },
    });
    expect(proceed).toBeNull();
    expect(next.prompt).toEqual({ kind: "back" });
  });

  it("계속 작성(cancel)은 확인 창만 닫고 계속 막는다", () => {
    let state = createLeaveGuardState(true);
    state = leaveGuardTransition(state, { type: "attempt", target: { kind: "back" } }).state;
    state = leaveGuardTransition(state, { type: "cancel" }).state;
    expect(state.prompt).toBeNull();
    expect(shouldBlockLeave(state)).toBe(true);
  });

  it("나가기(confirm)는 막기를 풀고 대기 중이던 대상을 돌려준다", () => {
    let state = createLeaveGuardState(true);
    state = leaveGuardTransition(state, {
      type: "attempt",
      target: { kind: "href", href: "/" },
    }).state;
    const result = leaveGuardTransition(state, { type: "confirm" });
    expect(result.proceed).toEqual({ kind: "href", href: "/" });
    expect(result.state.prompt).toBeNull();
    expect(shouldBlockLeave(result.state)).toBe(false);
  });

  it("확인 창 없이 confirm 이 오면 아무것도 하지 않는다", () => {
    const state = createLeaveGuardState(true);
    const result = leaveGuardTransition(state, { type: "confirm" });
    expect(result.proceed).toBeNull();
    expect(shouldBlockLeave(result.state)).toBe(true);
  });

  it("leave(fn)(allow) 뒤에는 dirty 여도 막지 않는다", () => {
    let state = createLeaveGuardState(true);
    state = leaveGuardTransition(state, { type: "allow" }).state;
    expect(shouldBlockLeave(state)).toBe(false);
    const { proceed } = leaveGuardTransition(state, {
      type: "attempt",
      target: { kind: "href", href: "/posts/1" },
    });
    expect(proceed).toEqual({ kind: "href", href: "/posts/1" });
  });

  it("setDirty 로 막기 여부가 바뀐다", () => {
    let state = createLeaveGuardState(false);
    state = leaveGuardTransition(state, { type: "setDirty", dirty: true }).state;
    expect(shouldBlockLeave(state)).toBe(true);
    state = leaveGuardTransition(state, { type: "setDirty", dirty: false }).state;
    expect(shouldBlockLeave(state)).toBe(false);
  });
});

describe("isInterceptableHref", () => {
  const current = "https://bredy.app/posts/upload";

  it("같은 origin 의 다른 경로는 가로챈다", () => {
    expect(isInterceptableHref("/posts", current)).toBe(true);
    expect(isInterceptableHref("https://bredy.app/", current)).toBe(true);
  });

  it("외부·새 탭·수정키·다운로드·해시·mailto 는 가로채지 않는다", () => {
    expect(isInterceptableHref("https://example.com", current)).toBe(false);
    expect(isInterceptableHref("/posts", current, { target: "_blank" })).toBe(false);
    expect(isInterceptableHref("/posts", current, { modifier: true })).toBe(false);
    expect(isInterceptableHref("/file.png", current, { download: true })).toBe(false);
    expect(isInterceptableHref("#photos", current)).toBe(false);
    expect(isInterceptableHref("mailto:help@bredy.app", current)).toBe(false);
    expect(isInterceptableHref(null, current)).toBe(false);
  });
});
