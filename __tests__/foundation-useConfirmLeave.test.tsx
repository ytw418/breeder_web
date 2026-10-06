import { act, renderHook } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

import { useConfirmLeave } from "../hooks/useConfirmLeave";

/** jsdom history.back() 은 비동기로 popstate 를 쏜다. */
const flushHistory = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));

describe("useConfirmLeave 센티널", () => {
  beforeEach(() => {
    mockPush.mockClear();
    window.history.replaceState(null, "", "/products/1/edit");
  });

  it("leave(fn) 는 센티널을 걷어 낸 뒤 이동한다(이동 뒤 뒤로가기가 작성 화면으로 오지 않게)", async () => {
    const startLength = window.history.length;
    const { result } = renderHook(({ dirty }) => useConfirmLeave(dirty), {
      initialProps: { dirty: true },
    });
    expect(window.history.length).toBe(startLength + 1);
    expect(window.history.state).toMatchObject({ __bredyLeaveGuard: true });

    const navigate = jest.fn(() => mockPush("/products/1"));
    act(() => result.current.leave(navigate));
    // 아직 popstate 전에는 이동하지 않는다.
    expect(navigate).not.toHaveBeenCalled();
    await flushHistory();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(window.history.state?.__bredyLeaveGuard).toBeUndefined();
  });

  it("dirty → clean 이 되면 센티널을 걷어 낸다", async () => {
    const { rerender } = renderHook(({ dirty }) => useConfirmLeave(dirty), {
      initialProps: { dirty: true },
    });
    expect(window.history.state).toMatchObject({ __bredyLeaveGuard: true });
    rerender({ dirty: false });
    await flushHistory();
    expect(window.history.state?.__bredyLeaveGuard).toBeUndefined();
  });

  it("dirty 가 아니면 센티널 없이 leave(fn) 를 바로 실행한다", () => {
    const { result } = renderHook(() => useConfirmLeave(false));
    const navigate = jest.fn();
    act(() => result.current.leave(navigate));
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
