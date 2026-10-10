import Link from "next/link";
import type { ReactNode } from "react";

/** 홈 상품 빈 상태(웹·앱 같은 문구). */
export function ProductFeedEmpty({ action }: { action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-[16px] font-semibold leading-tight tracking-tight text-app-muted">
        분양 피드가 활발해질 준비 중이에요
      </p>
      <p className="mt-1 text-[13px] font-medium leading-[19.5px] text-app-muted">
        지금 개체를 등록해 첫 분양글을 올려보세요.
      </p>
      {action ?? (
        <Link
          href="/products/upload"
          className="mt-3 inline-flex h-9 items-center rounded-[10px] bg-app-inverse px-3 text-xs font-semibold text-app-inverse-text"
        >
          분양 등록하러 가기
        </Link>
      )}
    </div>
  );
}

export default ProductFeedEmpty;
