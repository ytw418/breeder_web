import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@components/ui/button";

describe("Button 컴포넌트", () => {
  it("기본 버튼이 렌더링되어야 함", () => {
    render(<Button>테스트 버튼</Button>);
    const button = screen.getByRole("button", { name: "테스트 버튼" });
    expect(button).toBeInTheDocument();
  });

  it("다양한 variant로 렌더링되어야 함", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary");

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-input");
  });

  it("다양한 size로 렌더링되어야 함", () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10");

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");
  });

  it("fullWidth prop이 적용되어야 함", () => {
    render(<Button fullWidth>Full Width</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("loading 상태일 때 로딩 스피너가 표시되어야 함", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toHaveClass("relative");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disabled 상태일 때 비활성화되어야 함", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("클릭 이벤트가 정상적으로 동작해야 함", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
