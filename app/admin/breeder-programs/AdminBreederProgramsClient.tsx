"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import useConfirmDialog from "hooks/useConfirmDialog";
import { toast } from "@libs/client/toast";
import {
  getBreederProgramBenefitLabel,
  type BreederProgramSummary,
  type BreederProgramType,
} from "@libs/shared/breeder-program";

type ProgramFilter = "ALL" | BreederProgramType;

type AdminBreederMembership = BreederProgramSummary & {
  userId: number;
  user: {
    id: number;
    name: string;
    email: string | null;
    avatar: string | null;
    createdAt: string;
  };
};

type AdminBreederSearchUser = {
  id: number;
  name: string;
  email: string | null;
  avatar: string | null;
  createdAt: string;
  breederPrograms: BreederProgramSummary[];
};

type AdminBreederProgramsResponse = {
  success?: boolean;
  memberships?: AdminBreederMembership[];
  users?: AdminBreederSearchUser[];
  error?: string;
};

const PROGRAM_FILTER_OPTIONS: Array<{ value: ProgramFilter; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "FOUNDING_BREEDER", label: "창립 브리더" },
  { value: "PARTNER_BREEDER", label: "파트너 브리더" },
  { value: "VERIFIED_BREEDER", label: "인증 브리더" },
];

const PROGRAM_LABELS: Record<BreederProgramType, string> = {
  FOUNDING_BREEDER: "창립 브리더",
  PARTNER_BREEDER: "파트너 브리더",
  VERIFIED_BREEDER: "인증 브리더",
};

const getBenefitLabel = (program: Pick<
  BreederProgramSummary,
  "feeBenefitType" | "feeDiscountPercent" | "programType"
>) => getBreederProgramBenefitLabel(program) || "혜택 없음";

const SEARCH_DEBOUNCE_MS = 400;

const AdminBreederProgramsClient = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [programFilter, setProgramFilter] = useState<ProgramFilter>("ALL");
  const [discountInputs, setDiscountInputs] = useState<Record<number, string>>({});
  const [submittingUserId, setSubmittingUserId] = useState<number | null>(null);
  const [revokingKey, setRevokingKey] = useState<string>("");
  const { confirm, confirmDialog } = useConfirmDialog();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (programFilter !== "ALL") {
      params.set("programType", programFilter);
    }

    const query = params.toString();
    return query ? `/api/admin/breeder-programs?${query}` : "/api/admin/breeder-programs";
  }, [programFilter, debouncedSearch]);

  const { data, mutate, isLoading } = useSWR<AdminBreederProgramsResponse>(apiPath);

  const memberships = data?.memberships || [];
  const searchUsers = data?.users || [];

  const setDiscountValue = (userId: number, value: string) => {
    setDiscountInputs((current) => ({ ...current, [userId]: value }));
  };

  const getDiscountValue = (user: AdminBreederSearchUser) => {
    if (discountInputs[user.id] !== undefined) {
      return discountInputs[user.id];
    }

    const partner = user.breederPrograms.find(
      (program) => program.programType === "PARTNER_BREEDER"
    );

    if (typeof partner?.feeDiscountPercent === "number") {
      return String(partner.feeDiscountPercent);
    }

    return "15";
  };

  const handleApplyPartner = async (user: AdminBreederSearchUser) => {
    const value = Number(getDiscountValue(user));
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      toast.error("파트너 할인율은 1~100 사이 정수여야 합니다.");
      return;
    }

    const confirmed = await confirm({
      title: "파트너 브리더로 설정할까요?",
      description: `${user.name} 계정에 경매 수수료 ${value}% 할인 혜택을 적용합니다.`,
      confirmText: "적용",
    });
    if (!confirmed) return;

    try {
      setSubmittingUserId(user.id);
      const response = await fetch("/api/admin/breeder-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_partner_program",
          userId: user.id,
          feeDiscountPercent: value,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "파트너 브리더 적용에 실패했습니다.");
      }
      toast.success("파트너 브리더가 반영되었습니다.");
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "파트너 브리더 적용 중 오류가 발생했습니다."
      );
    } finally {
      setSubmittingUserId(null);
    }
  };

  const handleRevokePartner = async (membership: AdminBreederMembership) => {
    const confirmed = await confirm({
      title: "파트너 브리더를 철회할까요?",
      description: `${membership.user.name} 계정의 파트너 브리더 혜택을 비활성화합니다.`,
      confirmText: "철회",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      setRevokingKey(`${membership.userId}:${membership.programType}`);
      const response = await fetch("/api/admin/breeder-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_program",
          userId: membership.userId,
          programType: membership.programType,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "파트너 브리더 철회에 실패했습니다.");
      }
      toast.success("파트너 브리더가 철회되었습니다.");
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "파트너 브리더 철회 중 오류가 발생했습니다."
      );
    } finally {
      setRevokingKey("");
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">브리더 프로그램</h2>
            <p className="mt-1 text-sm text-gray-500">
              창립 브리더는 자동 부여 현황만 확인하고, 파트너 브리더는 수동으로 설정합니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이름 또는 이메일 검색"
              className="w-full min-w-[220px] bg-white sm:w-[280px]"
            />
            <select
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value as ProgramFilter)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
            >
              {PROGRAM_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">운영 원칙</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            창립 브리더는 신규 가입 선착순 100명에게 자동 부여됩니다. 파트너 브리더만
            이 화면에서 할인율을 설정할 수 있고, 인증 브리더는 추후 본인 인증 기능과
            연결할 예정입니다.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">현재 활성 멤버십</h3>
              <p className="mt-1 text-sm text-gray-500">
                프로그램별 활성 상태와 현재 혜택을 확인합니다.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {memberships.length}건
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {memberships.map((membership) => (
              <article
                key={membership.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">
                        {membership.user.name}
                      </p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                        {PROGRAM_LABELS[membership.programType]}
                      </span>
                      {membership.programType === "FOUNDING_BREEDER" &&
                      membership.foundingNo ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          No.{String(membership.foundingNo).padStart(3, "0")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {membership.user.email || "이메일 없음"} · 혜택 {getBenefitLabel(membership)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      부여일 {new Date(membership.grantedAt).toLocaleString()}
                    </p>
                  </div>
                  {membership.programType === "PARTNER_BREEDER" ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revokingKey === `${membership.userId}:${membership.programType}`}
                      onClick={() => handleRevokePartner(membership)}
                    >
                      철회
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">자동/읽기 전용</span>
                  )}
                </div>
              </article>
            ))}

            {!memberships.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                활성 브리더 프로그램 멤버십이 없습니다.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">파트너 브리더 설정</h3>
              <p className="mt-1 text-sm text-gray-500">
                이름이나 이메일로 검색한 뒤 할인율을 넣고 파트너 브리더를 부여합니다.
              </p>
            </div>
            {isLoading ? (
              <span className="text-xs font-semibold text-gray-400">불러오는 중...</span>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {!search.trim() ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                검색어를 입력하면 유저를 찾아 파트너 브리더를 설정할 수 있습니다.
              </div>
            ) : null}

            {search.trim() && !searchUsers.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                검색 결과가 없습니다.
              </div>
            ) : null}

            {searchUsers.map((user) => {
              const partnerProgram = user.breederPrograms.find(
                (program) => program.programType === "PARTNER_BREEDER"
              );

              return (
                <article
                  key={user.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{user.name}</p>
                        {user.breederPrograms.map((program) => (
                          <span
                            key={program.id}
                            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                          >
                            {PROGRAM_LABELS[program.programType]}
                            {program.programType === "FOUNDING_BREEDER" && program.foundingNo
                              ? ` · No.${String(program.foundingNo).padStart(3, "0")}`
                              : ""}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-500">
                        {user.email || "이메일 없음"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={getDiscountValue(user)}
                        onChange={(event) => setDiscountValue(user.id, event.target.value)}
                        inputMode="numeric"
                        className="w-full bg-white sm:w-28"
                        placeholder="할인율"
                      />
                      <Button
                        size="sm"
                        disabled={submittingUserId === user.id}
                        onClick={() => handleApplyPartner(user)}
                      >
                        {partnerProgram ? "파트너 할인 수정" : "파트너 적용"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      {confirmDialog}
    </>
  );
};

export default AdminBreederProgramsClient;
