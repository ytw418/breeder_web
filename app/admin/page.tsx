"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { toast } from "react-toastify";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import Link from "next/link";

export default function ProductManager() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, mutate } = useSWR(
    `/api/admin/products?page=${page}&keyword=${searchQuery}`
  );

  const handleDelete = async (id: number) => {
    if (!confirm("정말로 이 상품을 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      
      if (result.success) {
        toast.success("상품이 삭제되었습니다.");
        mutate();
      } else {
        toast.error(result.error || "삭제 실패");
      }
    } catch (error) {
      toast.error("오류가 발생했습니다.");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(keyword);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">상품 관리</h2>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <Input
          placeholder="상품명, 내용, 판매자 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit">검색</Button>
      </form>

      {/* 목록 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상품
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                판매자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태/가격
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                등록일
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.products?.map((product: any) => (
              <tr key={product.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {product.photos?.[0] && (
                      <div className="flex-shrink-0 h-10 w-10 mr-4">
                        <Image
                          src={makeImageUrl(product.photos[0], "product")}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        <Link href={`/products/${product.id}`} target="_blank" className="hover:underline">
                          {product.name}
                        </Link>
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {product.description}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-6 w-6 flex-shrink-0 mr-2">
                      {product.user?.avatar ? (
                        <Image
                          src={makeImageUrl(product.user.avatar, "avatar")}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200" />
                      )}
                    </div>
                    <div className="text-sm text-gray-900">{product.user?.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{product.status}</span>
                    <span>{product.price?.toLocaleString()}원</span>
                    <span className="text-xs text-gray-400">❤️ {product._count?.favs || 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(product.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
            {data?.products?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </Button>
        <span className="flex items-center px-4 text-sm">
          Page {page} / {data?.totalPages || 1}
        </span>
        <Button
          variant="outline"
          disabled={page >= (data?.totalPages || 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  );
}