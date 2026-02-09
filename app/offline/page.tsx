import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">오프라인 상태입니다</h1>
      <p className="mt-2 text-sm text-slate-500">
        네트워크 연결을 확인한 뒤 다시 시도해주세요.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
      >
        홈으로 이동
      </Link>
    </main>
  );
}
