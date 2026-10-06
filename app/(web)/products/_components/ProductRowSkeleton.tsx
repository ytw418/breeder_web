/** 상품 행(ProductCard, h108·썸네일 88) 모양 스켈레톤. 홈·상품 목록 공용. */
export function ProductRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-[108px] items-center gap-3 border-b border-app-line px-4">
          <span className="h-[88px] w-[88px] shrink-0 animate-pulse rounded-lg bg-app-surface" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-4 w-3/4 animate-pulse rounded bg-app-surface" />
            <span className="h-3 w-1/2 animate-pulse rounded bg-app-surface" />
            <span className="h-4 w-1/3 animate-pulse rounded bg-app-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProductRowSkeleton;
