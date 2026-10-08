import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@libs/client/authFetch", () => ({ authFetch: jest.fn() }));

import { BidIncrementField, useBidIncrementInput } from "../app/(web)/auctions/AuctionFormParts";

function Harness({ base }: { base: number }) {
  const bidIncrement = useBidIncrementInput(base);
  return (
    <>
      <BidIncrementField value={bidIncrement.value} onChange={bidIncrement.onChange} onBlur={bidIncrement.onBlur} />
      <output aria-label="valid">{String(bidIncrement.isValid)}</output>
    </>
  );
}

const field = () => screen.getByLabelText("최소 입찰 단위") as HTMLInputElement;

describe("최소 입찰 단위 입력", () => {
  it("직접 고치기 전에는 추천값(base)을 따라간다", () => {
    const { rerender } = render(<Harness base={1_000} />);
    expect(field().value).toBe("1,000");
    rerender(<Harness base={10_000} />);
    expect(field().value).toBe("10,000");
  });

  it("직접 고치면 추천값이 바뀌어도 고친 값을 유지한다", () => {
    const { rerender } = render(<Harness base={10_000} />);
    fireEvent.change(field(), { target: { value: "1000" } });
    expect(field().value).toBe("1,000");
    rerender(<Harness base={50_000} />);
    expect(field().value).toBe("1,000");
  });

  it("비운 채 칸을 나가면 다시 추천값을 따른다", () => {
    render(<Harness base={10_000} />);
    fireEvent.change(field(), { target: { value: "" } });
    expect(field().value).toBe("");
    fireEvent.blur(field());
    expect(field().value).toBe("10,000");
  });

  it("허용 범위 밖이면 isValid 가 false, 100만원 초과 입력은 100만원으로 자른다", () => {
    render(<Harness base={10_000} />);
    fireEvent.change(field(), { target: { value: "1050" } });
    expect(screen.getByLabelText("valid").textContent).toBe("false");
    fireEvent.change(field(), { target: { value: "5000000" } });
    expect(field().value).toBe("1,000,000");
    expect(screen.getByLabelText("valid").textContent).toBe("true");
  });
});
