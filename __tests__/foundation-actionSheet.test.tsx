import { fireEvent, render, screen } from "@testing-library/react";
import { ActionSheet } from "@components/app/ActionSheet";

describe("ActionSheet", () => {
  it("닫혀 있으면 아무것도 그리지 않는다", () => {
    render(<ActionSheet open={false} onClose={jest.fn()} actions={[]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("행을 누르면 onClose 다음 onSelect 를 부른다", () => {
    const calls: string[] = [];
    const onClose = jest.fn(() => calls.push("close"));
    const onSelect = jest.fn(() => calls.push("select"));
    render(
      <ActionSheet
        open
        onClose={onClose}
        actions={[
          { key: "report", label: "신고하기", onSelect },
          { key: "block", label: "차단하기", destructive: true, onSelect: jest.fn() },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    expect(calls).toEqual(["close", "select"]);
  });

  it("위험 동작은 danger 색, 비활성 행은 누를 수 없다", () => {
    const disabledSelect = jest.fn();
    render(
      <ActionSheet
        open
        onClose={jest.fn()}
        actions={[
          { key: "delete", label: "삭제", destructive: true, onSelect: jest.fn() },
          { key: "edit", label: "수정", disabled: true, onSelect: disabledSelect },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "삭제" })).toHaveClass("text-app-danger");
    const edit = screen.getByRole("button", { name: "수정" });
    expect(edit).toBeDisabled();
    fireEvent.click(edit);
    expect(disabledSelect).not.toHaveBeenCalled();
  });

  it("취소 버튼과 Escape 로 닫힌다", () => {
    const onClose = jest.fn();
    render(<ActionSheet open onClose={onClose} actions={[]} cancelLabel="닫기" />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
