import useUser from "@libs/client/useUser";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/layout";
import Link from "next/link";
import Image from "next/image";
import { makeImageUrl } from "@libs/client/utils";

interface PurchaseWithProduct {
  id: number;
  status: string;
  product: {
    id: number;
    name: string;
    price: number;
    photos: string[];
  };
}

interface SaleWithProduct {
  id: number;
  status: string;
  product: {
    id: number;
    name: string;
    price: number;
    photos: string[];
  };
}

interface ProfileResponse {
  success: boolean;
  profile: {
    id: number;
    name: string;
    avatar: string | null;
    purchases: PurchaseWithProduct[];
    sales: SaleWithProduct[];
  };
}

export default function Profile() {
  const { user } = useUser();
  const params = useParams();
  const { data } = useSWR<ProfileResponse>(
    params?.id ? `/api/users/${params.id}` : null
  );

  return (
    <Layout hasTabBar title="프로필">
      <div className="px-4">
        {/* ... existing profile code ... */}

        {/* Purchase History */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">구매 내역</h2>
          {data?.profile.purchases.length === 0 ? (
            <p className="text-gray-500">구매 내역이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {data?.profile.purchases.map((purchase) => (
                <Link
                  key={purchase.id}
                  href={`/products/${purchase.product.id}`}
                  className="flex flex-col"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      fill
                      src={makeImageUrl(purchase.product.photos[0], "product")}
                      alt={purchase.product.name}
                      className="object-cover rounded-lg"
                    />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {purchase.product.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {purchase.product.price.toLocaleString()}원
                    </p>
                    <span className="text-xs text-green-600">
                      {purchase.status === "completed"
                        ? "거래 완료"
                        : "거래 중"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sale History */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">판매 내역</h2>
          {data?.profile.sales.length === 0 ? (
            <p className="text-gray-500">판매 내역이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {data?.profile.sales.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/products/${sale.product.id}`}
                  className="flex flex-col"
                >
                  <div className="relative h-48 w-full">
                    <Image
                      fill
                      src={makeImageUrl(sale.product.photos[0], "product")}
                      alt={sale.product.name}
                      className="object-cover rounded-lg"
                    />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {sale.product.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {sale.product.price.toLocaleString()}원
                    </p>
                    <span className="text-xs text-green-600">
                      {sale.status === "completed" ? "거래 완료" : "거래 중"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
