import Link from "next/link";
import { notFound } from "next/navigation";

const products = [
  { id: "101-테스트-사슴벌레", name: "테스트 사슴벌레", price: "120,000원" },
  { id: "102-테스트-장수풍뎅이", name: "테스트 장수풍뎅이", price: "85,000원" },
];

export default function E2EProductFlowListPage() {
  if (process.env.ENABLE_E2E_ROUTES !== "true") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-bold">E2E 상품 목록</h1>
      <p className="mt-2 text-sm text-slate-500">
        Playwright 테스트용 상품 목록입니다.
      </p>
      <ul className="mt-6 space-y-3">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              href={`/e2e/product-flow/${product.id}`}
              data-testid={`product-link-${product.id.split("-")[0]}`}
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-sm text-primary">{product.price}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

