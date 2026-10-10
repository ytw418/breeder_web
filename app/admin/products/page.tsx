"use client";

import { authFetch } from "@libs/client/authFetch";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "@libs/client/toast";
import Image from "@components/atoms/Image";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { formatProductPrice } from "@libs/productRules";
import { productStatusLabel } from "@libs/shared/productTerms";
import useContentActionDialog from "@components/features/moderation/useContentActionDialog";

export default function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { ask, dialog: contentActionDialog } = useContentActionDialog();

  const { data, mutate } = useSWR(
    `/api/admin/products?page=${page}&keyword=${searchQuery}${hiddenOnly ? "&hidden=1" : ""}`
  );

  /** 숨김·숨김 해제(주 동작). 숨김은 사유가 작성자 알림에 들어간다. */
  const handleVisibility = async (id: number, action: "hide" | "unhide") => {
    const result = await ask(
      action === "hide"
        ? {
            title: "이 분양글을 숨길까요?",
            description: "작성자에게만 보이고, 작성자에게 사유가 담긴 알림이 가요. 나중에 숨김을 해제할 수 있어요.",
            confirmText: "숨기기",
          }
        : {
            title: "숨김을 해제할까요?",
            description: "다시 모두에게 보이고, 작성자에게 알림이 가요.",
            confirmText: "숨김 해제",
            askReason: false,
          }
    );
    if (!result) return;

    try {
      setBusyId(id);
      const res = await authFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "PRODUCT",
          targetId: id,
          action,
          reasonCode: result.reasonCode,
          reason: result.reason || null,
        }),
      });
      const data = await res.json();
      if (!data.success) return toast.error(data.error || "처리하지 못했어요.");
      toast.success(action === "hide" ? "숨겼어요." : "숨김을 해제했어요.");
      mutate();
    } catch {
      toast.error("처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
    }
  };

  /** 삭제(보조 동작). 되돌릴 수 없어 키워드와 사유를 받는다. */
  const handleDelete = async (id: number) => {
    const result = await ask({
      title: "이 분양글을 삭제할까요?",
      description: "되돌릴 수 없어요. 대부분은 숨김으로 충분해요.",
      confirmText: "삭제",
      tone: "danger",
      confirmKeyword: "DELETE",
    });
    if (!result?.reasonCode) return;

    try {
      setBusyId(id);
      const params = new URLSearchParams({ id: String(id), reasonCode: result.reasonCode });
      if (result.reason) params.set("reason", result.reason);
      const res = await authFetch(`/api/admin/products?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("분양글을 삭제했어요.");
        mutate();
      } else {
        toast.error(data.error || "삭제하지 못했어요.");
      }
    } catch {
      toast.error("삭제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(keyword);
  };

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">분양 관리</h2>

        <form onSubmit={handleSearch} className="flex max-w-md flex-col gap-2 sm:flex-row">
          <Input
            placeholder="제목, 내용, 분양자 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button type="submit">검색</Button>
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hiddenOnly}
              onChange={(event) => {
                setHiddenOnly(event.target.checked);
                setPage(1);
              }}
            />
            숨김만
          </label>
        </form>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  분양글
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  분양자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상태/가격
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  등록일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
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
                        <div className="h-10 w-10 mr-4">
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
                          <Link
                            href={getProductPath(product.id, product.name)}
                            target="_blank"
                            className="hover:underline"
                          >
                            {product.name}
                          </Link>
                        </div>
                        <div className="text-sm text-gray-500 line-clamp-1">
                          {product.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.user?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">
                        {productStatusLabel(product.status)}
                        {product.isDeleted ? " · 삭제됨" : product.isHidden ? " · 숨김" : ""}
                      </span>
                      <span>{formatProductPrice(product.price)}</span>
                      <span className="text-xs text-gray-400">
                        ❤️ {product._count?.favs || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(product.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {product.isDeleted ? (
                      <span className="text-xs text-gray-400">삭제됨</span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === product.id}
                          onClick={() => handleVisibility(product.id, product.isHidden ? "unhide" : "hide")}
                        >
                          {product.isHidden ? "숨김 해제" : "숨김"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500"
                          disabled={busyId === product.id}
                          onClick={() => handleDelete(product.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {data?.products?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    분양글이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} / {data?.totalPages || 1}
          </span>
          <Button
            variant="outline"
            disabled={page >= (data?.totalPages || 1)}
            onClick={() => setPage((prev) => prev + 1)}
          >
            다음
          </Button>
        </div>
      </div>
      {contentActionDialog}
    </>
  );
}
