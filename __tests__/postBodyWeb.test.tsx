import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@components/atoms/Image", () => ({
  __esModule: true,
  // next/image 대신 src·alt 만 남긴 img 로 본다.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { PostBody } from "@/app/(web)/posts/_components/PostBody";

describe("웹 게시글 PostBody", () => {
  it("사진을 쓴 자리에 그리고 표시 기호는 보이지 않는다", () => {
    const { container } = render(
      <PostBody
        description={"## **준비물**\n앞 설명\n[[photo:2]]\n가운데\n[[photo:1]]\n뒤 설명"}
        images={["img-a", "img-b"]}
        onOpenImage={() => {}}
      />
    );
    const order = Array.from(container.querySelectorAll("p, img")).map((el) =>
      el.tagName === "IMG" ? (el as HTMLImageElement).alt : el.textContent
    );
    expect(order).toEqual(["준비물", "앞 설명", "게시글 이미지 2", "가운데", "게시글 이미지 1", "뒤 설명"]);
    expect(container.textContent).not.toMatch(/\[\[photo:|## |\*\*/);
    expect(screen.getByText("준비물").closest("p")).toHaveClass("text-[20px]", "font-bold");
  });

  it("자리 표시 없는 사진은 본문 뒤에 순서대로 나열한다", () => {
    const { container } = render(
      <PostBody description="옛 글 본문입니다" images={["a", "b"]} onOpenImage={() => {}} />
    );
    const order = Array.from(container.querySelectorAll("p, img")).map((el) =>
      el.tagName === "IMG" ? (el as HTMLImageElement).alt : el.textContent
    );
    expect(order).toEqual(["옛 글 본문입니다", "게시글 이미지 1", "게시글 이미지 2"]);
  });

  it("링크는 새 창 a 태그이고 뒤에 붙은 한글은 글자로 남는다", () => {
    render(
      <PostBody
        description="https://smartstore.naver.com/bredy에서 샀어요"
        images={[]}
        onOpenImage={() => {}}
      />
    );
    const link = screen.getByRole("link", { name: "https://smartstore.naver.com/bredy" });
    expect(link).toHaveAttribute("href", "https://smartstore.naver.com/bredy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("에서 샀어요")).toBeInTheDocument();
  });

  it("사진을 누르면 images 안의 위치로 연다", () => {
    const onOpenImage = jest.fn();
    render(
      <PostBody description={"설명\n[[photo:2]]"} images={["a", "b"]} onOpenImage={onOpenImage} />
    );
    fireEvent.click(screen.getByRole("button", { name: "게시글 이미지 2 크게 보기" }));
    expect(onOpenImage).toHaveBeenCalledWith(1);
  });
});
