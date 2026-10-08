"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSWRConfig } from "swr";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { PriceInput } from "@components/app/PriceInput";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useConfirmLeave } from "hooks/useConfirmLeave";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { absoluteUrl, copyText } from "@libs/client/share";
import { toAuctionPath } from "@libs/auction-route";
import {
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MIN_START_PRICE,
  AUCTION_PHOTOS_MAX,
  getBidIncrement,
  getPresetEndAtMs,
  isAuctionDurationValid,
} from "@libs/auctionRules";
import { getAuctionResultMessage } from "@libs/client/auctionErrorMessage";
import { TOP_LEVEL_CATEGORIES, getSubcategories } from "@libs/categoryTaxonomy";
import type { CreateAuctionResponse } from "pages/api/auctions";
import { PEDIGREE_NOTE_INVALID_MESSAGE, type PedigreeNote } from "@libs/shared/pedigree-note";
import {
  AgreeRow,
  BID_INCREMENT_ERROR,
  BidIncrementField,
  BottomCta,
  CenterModal,
  ChipRow,
  DURATION_PRESETS,
  ErrorText,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
  FieldLabel,
  FormChip,
  PhotoAddTile,
  PhotoTile,
  SheetButton,
  fieldBorder,
  formatConfirmDateTime,
  uploadImageFile,
  useBidIncrementInput,
} from "../AuctionFormParts";
import { AuctionBloodlineField, auctionPedigreePayload } from "../AuctionBloodlineParts";

type TextKey =
  | "title"
  | "description"
  | "sellerPhone"
  | "sellerEmail"
  | "sellerBlogUrl"
  | "sellerCafeNick"
  | "sellerBandNick"
  | "sellerTrustNote";
type FormState = Record<TextKey, string>;
type ErrorKey =
  | "photos"
  | "category"
  | "title"
  | "description"
  | "startPrice"
  | "bidIncrement"
  | "agreement"
  | "duration"
  | "pedigreeNote";
type ErrorState = Partial<Record<ErrorKey, string>>;

interface CreateAuctionPayload extends FormState {
  category: string;
  photos: string[];
  sellerProofImage: string | null;
  startPrice: number;
  minBidIncrement: number;
  endAt: string;
  bloodlineRootId: number | null;
  /** 혈통이 없거나 칸이 비면 null */
  pedigreeNote: PedigreeNote | null;
}

const initialForm: FormState = {
  title: "",
  description: "",
  sellerPhone: "",
  sellerEmail: "",
  sellerBlogUrl: "",
  sellerCafeNick: "",
  sellerBandNick: "",
  sellerTrustNote: "",
};

const TOOL_FIXED_CATEGORY = "기타";
const normalizeText = (value: string) => value.trim();
const toIsoPresetEndAt = (hours: number) => new Date(getPresetEndAtMs(hours)).toISOString();

const buildSignature = (payload: CreateAuctionPayload) =>
  JSON.stringify({ ...payload, endAt: undefined });

const CreateAuctionClient = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { mutate: globalMutate } = useSWRConfig();
  const { user, isLoading: isUserLoading } = useUser();
  const isToolRoute = Boolean(pathname?.startsWith("/tool"));
  const withBasePath = (path: string) => (isToolRoute ? `/tool${path}` : path);
  const loginPath = isToolRoute ? "/tool/login" : "/auth/login";

  const [form, setForm] = useState<FormState>(initialForm);
  const [startPrice, setStartPrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [sellerProofImage, setSellerProofImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(isToolRoute ? TOOL_FIXED_CATEGORY : "");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedBloodlineRootId, setSelectedBloodlineRootId] = useState("");
  const [pedigreeNote, setPedigreeNote] = useState<PedigreeNote>({});
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [agreedAuctionNotice, setAgreedAuctionNotice] = useState(false);
  const [agreedDisputePolicy, setAgreedDisputePolicy] = useState(false);
  const [errors, setErrors] = useState<ErrorState>({});
  const [uploading, setUploading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<CreateAuctionPayload | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [createdAuctionId, setCreatedAuctionId] = useState<number | null>(null);
  const [createdAuctionTitle, setCreatedAuctionTitle] = useState("");
  const [lastCreatedSignature, setLastCreatedSignature] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // 확인 → 응답 사이 두 번 눌러도 요청이 한 번만 나가게 동기 잠금(상태 반영 전 연타 대비).
  const submitLockRef = useRef(false);

  const [createAuction, { loading: submitting }] = useMutation<
    CreateAuctionResponse & { message?: string; status?: number }
  >("/api/auctions");

  // 비로그인은 로그인으로 보낸다(앱 LoginRedirect).
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace(`${loginPath}?next=${encodeURIComponent(withBasePath("/auctions/create"))}`);
    }
     
  }, [isUserLoading, user]);

  // 선택한 프리셋의 종료 시각 표시는 1분마다 갱신한다(제출 시점에 다시 계산한다).
  useEffect(() => {
    if (selectedDuration === null) return;
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [selectedDuration]);

  // 입찰 단위는 직접 고치기 전까지 시작가 구간 추천값을 따른다.
  const bidIncrement = useBidIncrementInput(getBidIncrement(startPrice ?? 0));
  const dirty =
    !createdAuctionId &&
    (photos.length > 0 ||
      (!isToolRoute && Boolean(selectedCategory)) ||
      startPrice !== null ||
      bidIncrement.touched ||
      Boolean(selectedBloodlineRootId) ||
      Object.keys(pedigreeNote).length > 0 ||
      Object.entries(form).some(([key, value]) => value !== initialForm[key as TextKey]));
  const { leave, dialog: leaveDialog } = useConfirmLeave(dirty);

  const subcategories = !isToolRoute && selectedCategory ? getSubcategories(selectedCategory) : [];
  const categoryForSubmit = isToolRoute ? TOOL_FIXED_CATEGORY : selectedSubcategory || selectedCategory;
  const selectedEndAt = selectedDuration ? new Date(getPresetEndAtMs(selectedDuration, nowTick)).toISOString() : "";
  const bloodlineRootId = selectedBloodlineRootId ? Number(selectedBloodlineRootId) : null;
  // 혈통이 없거나 칸이 비면 null, 규칙에 안 맞으면 "invalid"(제출을 막는다).
  const pedigreePayload = auctionPedigreePayload(bloodlineRootId, pedigreeNote);
  const customErrorMessages = [
    errors.photos,
    errors.category,
    errors.title,
    errors.description,
    errors.startPrice,
    errors.bidIncrement,
    errors.agreement,
    errors.duration,
    errors.pedigreeNote,
  ].filter((message): message is string => Boolean(message));
  const busy = submitting || uploading || proofUploading;

  const updateForm = (key: TextKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "title" || key === "description") setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handlePhotos = async (files: FileList) => {
    if (uploading) return;
    const remaining = AUCTION_PHOTOS_MAX - photos.length;
    if (remaining <= 0) return;
    if (files.length > remaining) toast.error(`이미지는 최대 ${AUCTION_PHOTOS_MAX}장까지 등록 가능합니다.`);
    setUploading(true);
    try {
      // 한 장 올라갈 때마다 바로 담는다. 중간에 실패해도 앞서 올라간 사진은 남긴다.
      for (const file of Array.from(files).slice(0, remaining)) {
        const id = await uploadImageFile(file);
        setPhotos((prev) => [...prev, id].slice(0, AUCTION_PHOTOS_MAX));
        setErrors((prev) => ({ ...prev, photos: undefined }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleProof = async (file: File | undefined) => {
    if (!file || proofUploading) return;
    setProofUploading(true);
    try {
      setSellerProofImage(await uploadImageFile(file, "프로필 인증 이미지 업로드에 실패했습니다."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 인증 이미지 업로드에 실패했습니다.");
    } finally {
      setProofUploading(false);
    }
  };

  const validate = () => {
    const next: ErrorState = {};
    if (photos.length === 0) next.photos = "최소 1장의 사진을 등록해주세요.";
    if (!categoryForSubmit) next.category = "카테고리를 선택해주세요.";
    if (!normalizeText(form.title)) next.title = "제목을 입력해주세요.";
    if (!normalizeText(form.description)) next.description = "설명을 입력해주세요.";
    if (startPrice === null || startPrice < AUCTION_MIN_START_PRICE) {
      next.startPrice = `최소 ${AUCTION_MIN_START_PRICE.toLocaleString()}원 이상`;
    }
    if (!bidIncrement.isValid) next.bidIncrement = BID_INCREMENT_ERROR;
    if (!agreedAuctionNotice || !agreedDisputePolicy) {
      next.agreement = "경매 주의사항 및 분쟁 정책 동의가 필요합니다.";
    }
    if (selectedDuration === null) {
      next.duration = "경매 기간 프리셋(1시간/3시간 등)을 선택해주세요.";
    } else if (!isAuctionDurationValid(toIsoPresetEndAt(selectedDuration))) {
      next.duration = "경매 기간은 등록 시점 기준 1시간~72시간 사이여야 합니다.";
    }
    if (
      (startPrice ?? 0) >= AUCTION_HIGH_PRICE_REQUIRE_CONTACT &&
      !normalizeText(form.sellerPhone) &&
      !normalizeText(form.sellerEmail)
    ) {
      next.startPrice = `시작가 ${AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상 경매는 연락처(전화/이메일) 정보가 필요합니다.`;
    }
    if (pedigreePayload === "invalid") {
      next.pedigreeNote = PEDIGREE_NOTE_INVALID_MESSAGE;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): CreateAuctionPayload => ({
    title: normalizeText(form.title),
    description: normalizeText(form.description),
    category: categoryForSubmit,
    photos,
    sellerProofImage,
    startPrice: startPrice ?? 0,
    minBidIncrement: bidIncrement.value ?? 0,
    endAt: selectedDuration ? toIsoPresetEndAt(selectedDuration) : "",
    sellerPhone: normalizeText(form.sellerPhone),
    sellerEmail: normalizeText(form.sellerEmail),
    sellerBlogUrl: normalizeText(form.sellerBlogUrl),
    sellerCafeNick: normalizeText(form.sellerCafeNick),
    sellerBandNick: normalizeText(form.sellerBandNick),
    sellerTrustNote: normalizeText(form.sellerTrustNote),
    bloodlineRootId,
    pedigreeNote: pedigreePayload === "invalid" ? null : pedigreePayload,
  });

  const submit = () => {
    if (busy) return;
    // 등록에 성공한 폼은 잠근다. 같은 폼으로 다시 등록하지 않는다.
    if (createdAuctionId) {
      toast.error("이미 등록된 경매입니다. 기존 경매를 공유하거나 수정해주세요.");
      setShareOpen(true);
      return;
    }
    if (!validate()) {
      toast.error("필수 항목을 확인해주세요.");
      return;
    }
    const payload = buildPayload();
    if (lastCreatedSignature === buildSignature(payload)) {
      toast.error("동일한 내용의 경매는 다시 등록할 수 없습니다. 기존 경매를 공유하거나 수정해주세요.");
      return;
    }
    setConfirmPayload(payload);
  };

  const confirmCreate = async () => {
    if (!confirmPayload || submitting || createdAuctionId || submitLockRef.current) return;
    submitLockRef.current = true;
    // 확인 창을 보는 사이 시간이 흘렀으니 종료 시각을 누른 시점 기준으로 다시 계산한다.
    const payload = {
      ...confirmPayload,
      endAt: selectedDuration ? toIsoPresetEndAt(selectedDuration) : confirmPayload.endAt,
    };
    try {
      const result = await createAuction({ data: payload });
      if (!result.success || !result.auction?.id) {
        toast.error(getAuctionResultMessage(result, "경매 등록 중 오류가 발생했습니다."));
        return;
      }
      setLastCreatedSignature(buildSignature(payload));
      setCreatedAuctionId(result.auction.id);
      setCreatedAuctionTitle(result.auction.title || "");
      setConfirmPayload(null);
      setShareOpen(true);
      toast.success("경매가 등록되었습니다. SNS에 공유해보세요!");
      void globalMutate((key) => typeof key === "string" && key.startsWith("/api/auctions"), undefined, {
        revalidate: true,
      });
    } catch {
      toast.error("네트워크 연결을 확인해 주세요.");
    } finally {
      submitLockRef.current = false;
    }
  };

  const createdPath = createdAuctionId ? withBasePath(toAuctionPath(createdAuctionId, createdAuctionTitle)) : "";

  // 공유 창을 닫아도 폼에 남기지 않고 생성된 경매 상세로 보낸다(replace — 뒤로가기로 폼에 돌아오지 않게).
  const moveToCreatedAuction = () => {
    if (!createdPath) return;
    setShareOpen(false);
    leave(() => router.replace(createdPath));
  };

  const copyCreatedLink = async () => {
    if (!createdPath) return;
    if (await copyText(absoluteUrl(createdPath))) toast.success("경매 링크가 복사되었습니다.");
    else toast.error("링크 복사에 실패했습니다.");
  };

  const shareCreated = async () => {
    if (!createdPath) return;
    const url = absoluteUrl(createdPath);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "브리디 경매",
          text: "30초면 만드는 경매 도구, 지금 바로 참여해보세요.",
          url,
        });
        toast.success("공유를 완료했습니다.");
        return;
      }
      if (await copyText(url)) toast.info("이 기기에서는 바로 공유를 지원하지 않아 링크를 복사했습니다.");
      else toast.error("공유에 실패했습니다.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info("공유를 취소했습니다.");
        return;
      }
      toast.error("공유에 실패했습니다.");
    }
  };

  if (isUserLoading || !user) {
    return (
      <Layout canGoBack title="경매 등록" seoTitle="경매 등록">
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="불러오는 중">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout canGoBack title="경매 등록" seoTitle="경매 등록">
      <div className="flex flex-col gap-5 bg-app-bg px-5 pt-5 pb-[calc(140px+env(safe-area-inset-bottom))]">
        {/* 사진 */}
        <div>
          <div className="flex gap-2 overflow-x-auto pt-1.5 pr-1.5 scrollbar-hide">
            {photos.length < AUCTION_PHOTOS_MAX ? (
              <PhotoAddTile
                count={photos.length}
                max={AUCTION_PHOTOS_MAX}
                uploading={uploading}
                onFiles={(files) => void handlePhotos(files)}
              />
            ) : null}
            {photos.map((photo, index) => (
              <PhotoTile
                key={`${photo}-${index}`}
                id={photo}
                index={index}
                onRemove={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
          </div>
          <ErrorText message={errors.photos} />
        </div>

        {/* 제목 */}
        <div>
          <FieldLabel label="제목" htmlFor="auction-title" />
          <input
            id="auction-title"
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            placeholder="예: 슈퍼 팻테일 게코 암컷 분양합니다"
            className={cn(FIELD_INPUT_CLASS, fieldBorder(Boolean(errors.title)))}
          />
          <ErrorText message={errors.title} />
        </div>

        {/* 카테고리 */}
        <div>
          <FieldLabel label="카테고리" />
          {isToolRoute ? (
            <ChipRow>
              <FormChip label={TOOL_FIXED_CATEGORY} active onClick={() => undefined} />
            </ChipRow>
          ) : (
            <>
              <ChipRow>
                {TOP_LEVEL_CATEGORIES.map((category) => (
                  <FormChip
                    key={category.id}
                    label={category.name}
                    active={selectedCategory === category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSelectedSubcategory("");
                      setErrors((prev) => ({ ...prev, category: undefined }));
                    }}
                  />
                ))}
              </ChipRow>
              {subcategories.length > 0 ? (
                <ChipRow className="mt-1.5">
                  {subcategories.map((subcategory) => (
                    <FormChip
                      key={subcategory}
                      label={subcategory}
                      active={selectedSubcategory === subcategory}
                      onClick={() => {
                        setSelectedSubcategory(subcategory);
                        setErrors((prev) => ({ ...prev, category: undefined }));
                      }}
                    />
                  ))}
                </ChipRow>
              ) : null}
            </>
          )}
          <ErrorText message={errors.category} />
        </div>

        {/* 설명 */}
        <div>
          <FieldLabel label="설명" htmlFor="auction-description" />
          <textarea
            id="auction-description"
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            placeholder="개체 정보, 사육 환경, 거래 방식 등 입찰자가 궁금할 내용을 적어주세요."
            className={cn(FIELD_TEXTAREA_CLASS, "min-h-[160px]", fieldBorder(Boolean(errors.description)))}
          />
          <ErrorText message={errors.description} />
        </div>

        {/* 시작가 */}
        <div>
          <FieldLabel label="시작가" htmlFor="auction-start-price" />
          <PriceInput
            id="auction-start-price"
            value={startPrice}
            onChange={(value) => {
              setStartPrice(value);
              setErrors((prev) => ({ ...prev, startPrice: undefined }));
            }}
            prefix="₩"
            placeholder="10,000"
            className={errors.startPrice ? "border-app-danger" : undefined}
          />
          <ErrorText message={errors.startPrice} />
        </div>

        {/* 최소 입찰 단위 */}
        <BidIncrementField
          value={bidIncrement.value}
          onChange={(value) => {
            bidIncrement.onChange(value);
            setErrors((prev) => ({ ...prev, bidIncrement: undefined }));
          }}
          onBlur={bidIncrement.onBlur}
          error={errors.bidIncrement}
        />

        {/* 종료 시각 */}
        <div>
          <FieldLabel label="종료 시각" />
          <ChipRow>
            {DURATION_PRESETS.map((preset) => (
              <FormChip
                key={preset.hours}
                label={preset.label}
                active={selectedDuration === preset.hours}
                onClick={() => {
                  setSelectedDuration(preset.hours);
                  setNowTick(Date.now());
                  setErrors((prev) => ({ ...prev, duration: undefined }));
                }}
              />
            ))}
          </ChipRow>
          <div
            className={cn(
              "mt-2 flex h-12 items-center truncate rounded-lg border border-app-border bg-app-surface px-3.5 text-[15px]",
              selectedEndAt ? "text-app-text" : "text-app-caption"
            )}
          >
            {selectedEndAt ? formatConfirmDateTime(selectedEndAt) : "기간을 선택해주세요"}
          </div>
          <ErrorText message={errors.duration} />
        </div>

        {/* 혈통(선택) + 부모·누대 */}
        <AuctionBloodlineField
          value={selectedBloodlineRootId}
          onChange={(value) => {
            setSelectedBloodlineRootId(value);
            setErrors((prev) => ({ ...prev, pedigreeNote: undefined }));
          }}
          note={pedigreeNote}
          onNoteChange={(note) => {
            setPedigreeNote(note);
            setErrors((prev) => ({ ...prev, pedigreeNote: undefined }));
          }}
        />

        {/* 판매자 신뢰 정보(선택) */}
        <div>
          <FieldLabel label="판매자 신뢰 정보" caption="선택" />
          <div className="flex flex-col gap-2">
            <input
              value={form.sellerPhone}
              onChange={(event) => updateForm("sellerPhone", event.target.value)}
              placeholder="연락처(전화번호)"
              inputMode="tel"
              aria-label="연락처(전화번호)"
              className={cn(FIELD_INPUT_CLASS, "border-app-border")}
            />
            <input
              value={form.sellerEmail}
              onChange={(event) => updateForm("sellerEmail", event.target.value)}
              placeholder="연락 이메일"
              type="email"
              autoCapitalize="none"
              aria-label="연락 이메일"
              className={cn(FIELD_INPUT_CLASS, "border-app-border")}
            />
            <input
              value={form.sellerBlogUrl}
              onChange={(event) => updateForm("sellerBlogUrl", event.target.value)}
              placeholder="블로그/프로필 URL"
              type="url"
              autoCapitalize="none"
              aria-label="블로그/프로필 URL"
              className={cn(FIELD_INPUT_CLASS, "border-app-border")}
            />
            <input
              value={form.sellerCafeNick}
              onChange={(event) => updateForm("sellerCafeNick", event.target.value)}
              placeholder="카페 닉네임"
              aria-label="카페 닉네임"
              className={cn(FIELD_INPUT_CLASS, "border-app-border")}
            />
            <input
              value={form.sellerBandNick}
              onChange={(event) => updateForm("sellerBandNick", event.target.value)}
              placeholder="밴드 닉네임"
              aria-label="밴드 닉네임"
              className={cn(FIELD_INPUT_CLASS, "border-app-border")}
            />
            <textarea
              value={form.sellerTrustNote}
              onChange={(event) => updateForm("sellerTrustNote", event.target.value)}
              placeholder="예: OO카페 활동 4년, 최근 3개월 거래 20건 무분쟁"
              aria-label="추가 안내"
              className={cn(FIELD_TEXTAREA_CLASS, "min-h-[96px] border-app-border")}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <label
              className={cn(
                "inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text",
                proofUploading && "pointer-events-none opacity-60"
              )}
            >
              {proofUploading ? "업로드 중..." : "프로필 캡처 올리기"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleProof(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {sellerProofImage ? (
              <button type="button" onClick={() => setSellerProofImage(null)} className="text-[14px] text-app-muted">
                삭제
              </button>
            ) : null}
          </div>
          {sellerProofImage ? (
            <div className="relative mt-2.5 h-28 w-40 overflow-hidden rounded-md bg-app-placeholder">
              <Image src={makeImageUrl(sellerProofImage, "public")} alt="판매자 신뢰 자료" fill sizes="160px" className="object-cover" />
            </div>
          ) : null}
        </div>

        {/* 운영 룰 동의 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-app-text">운영 룰 동의</span>
            {/* 툴 전용 룰 화면이 없어 공용 룰 화면을 쓴다. 툴에서는 작성 중인 폼을 두고 새 탭으로 연다. */}
            <Link
              href="/auctions/rules"
              {...(isToolRoute ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-[14px] font-semibold text-app-brand"
            >
              룰 전체 보기
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <AgreeRow
              checked={agreedAuctionNotice}
              onToggle={() => {
                const next = !agreedAuctionNotice;
                setAgreedAuctionNotice(next);
                if (next && agreedDisputePolicy) setErrors((prev) => ({ ...prev, agreement: undefined }));
              }}
              label="경매 룰(입찰 단위, 자동 연장, 수정 가능 조건)을 확인했어요."
            />
            <AgreeRow
              checked={agreedDisputePolicy}
              onToggle={() => {
                const next = !agreedDisputePolicy;
                setAgreedDisputePolicy(next);
                if (agreedAuctionNotice && next) setErrors((prev) => ({ ...prev, agreement: undefined }));
              }}
              label="분쟁 책임 제한 및 신고 접수 정책을 확인했어요."
            />
          </div>
          <ErrorText message={errors.agreement} />
        </div>
      </div>

      <BottomCta
        label={submitting ? "등록 중..." : "경매 등록하기"}
        disabled={busy}
        onClick={submit}
        errorText={customErrorMessages.length ? customErrorMessages.join(" / ") : undefined}
      />

      {/* 등록 확인 */}
      <CenterModal
        open={confirmPayload !== null}
        onClose={() => {
          if (!submitting) setConfirmPayload(null);
        }}
        label="등록 확인 팝업"
      >
        <h2 className="text-[18px] font-bold text-app-text">이 내용으로 등록할까요?</h2>
        <p className="mt-2 text-[15px] leading-[22px] text-app-muted">
          등록 후에는 동일 내용 재등록이 제한될 수 있어요. 가격과 시간을 다시 확인해주세요.
        </p>
        {confirmPayload ? (
          <dl className="mt-4 flex flex-col gap-2.5 text-[15px]">
            <div className="flex items-center justify-between">
              <dt className="text-app-muted">시작가</dt>
              <dd className="font-semibold text-app-text">{confirmPayload.startPrice.toLocaleString()}원</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-app-muted">입찰 단위</dt>
              <dd className="font-semibold text-app-text">{confirmPayload.minBidIncrement.toLocaleString()}원</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-app-muted">종료 시각</dt>
              <dd className="font-semibold text-app-text">{formatConfirmDateTime(confirmPayload.endAt)}</dd>
            </div>
          </dl>
        ) : null}
        <div className="mt-5 flex gap-2">
          <SheetButton label="다시 확인" tone="ghost" disabled={submitting} fill onClick={() => setConfirmPayload(null)} />
          <SheetButton
            label={submitting ? "등록 중..." : "이대로 등록"}
            tone="primary"
            disabled={submitting}
            fill
            onClick={() => void confirmCreate()}
          />
        </div>
      </CenterModal>

      {/* 공유 */}
      <CenterModal open={shareOpen} onClose={moveToCreatedAuction} label="공유 팝업">
        <h2 className="text-[18px] font-bold text-app-text">경매를 공유해보세요</h2>
        <p className="mt-2 text-[15px] leading-[22px] text-app-muted">지금 공유하면 더 빠르게 입찰자를 모을 수 있어요.</p>
        <div className="mt-5 flex flex-col gap-2">
          <SheetButton label="링크 복사하기" tone="ghost" onClick={() => void copyCreatedLink()} />
          <SheetButton label="바로 공유하기" tone="primary" onClick={() => void shareCreated()} />
          <SheetButton label="경매 상세로 이동" tone="ghost" onClick={moveToCreatedAuction} />
        </div>
      </CenterModal>

      {leaveDialog}
    </Layout>
  );
};

export default CreateAuctionClient;
