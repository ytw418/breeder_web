import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center bg-app-bg px-6 text-center">
      <h1 className="text-[18px] font-bold text-app-text">오프라인 상태예요</h1>
      <p className="mt-2 text-[14px] leading-[1.5] text-app-muted">
        네트워크 연결을 확인한 뒤 다시 시도해 주세요.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-app-surface px-[18px] text-[14px] font-semibold text-app-text"
      >
        홈으로 이동
      </Link>
    </main>
  );
}
