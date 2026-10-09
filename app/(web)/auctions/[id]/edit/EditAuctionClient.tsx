"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { PriceInput } from "@components/app/PriceInput";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import type { AuctionDetailResponse } from "pages/api/auctions/[id]";
import {
  AUCTION_EDIT_LOCK_MESSAGES,
  AUCTION_MIN_START_PRICE,
  AUCTION_PHOTOS_MAX,
  getAuctionEditLockReason,
  getPresetEndAtMs,
  isAuctionDurationValid,
  resolveBidIncrement,
  type AuctionEditLockReason,
} from "@libs/auctionRules";
import { getAuctionResultMessage } from "@libs/client/auctionErrorMessage";
import { extractAuctionIdFromPath, toAuctionPath } from "@libs/auction-route";
import { TOP_LEVEL_CATEGORIES, findCategoryBranch, getSubcategories } from "@libs/categoryTaxonomy";
import { PEDIGREE_NOTE_INVALID_MESSAGE, type PedigreeNote } from "@libs/shared/pedigree-note";
import {
  BID_INCREMENT_ERROR,
  BidIncrementField,
  BottomCta,
  ChipRow,
  DURATION_PRESETS,
  ErrorText,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
  FieldLabel,
  FormChip,
  HelpText,
  PhotoAddTile,
  PhotoTile,
  fieldBorder,
  formatConfirmDateTime,
  uploadImageFile,
  useBidIncrementInput,
} from "../../AuctionFormParts";
import {
  AuctionBloodlineField,
  attachableOptionLabel,
  auctionPedigreePayload,
} from "../../AuctionBloodlineParts";

type Auction = NonNullable<AuctionDetailResponse["auction"]>;
type TextKey =
  | "title"
  | "description"
  | "endAt"
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
  | "endAt"
  | "pedigreeNote";
type ErrorState = Partial<Record<ErrorKey, string>>;

interface AuctionUpdateResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
  status?: number;
  auction?: { id: number };
}

const normalizeText = (value: string) => value.trim();

/** datetime-local 값("YYYY-MM-DDTHH:mm", 로컬 시각). */
const toLocalInputValue = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const toIsoDateTimeValue = (value: string) => {
  const date = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};
const toPresetEndAtInput = (hours: number) => toLocalInputValue(new Date(getPresetEndAtMs(hours)));

const buildInitialForm = (auction: Auction): FormState => ({
  title: auction.title,
  description: auction.description,
  endAt: toLocalInputValue(auction.endAt),
  sellerPhone: auction.sellerPhone || "",
  sellerEmail: auction.sellerEmail || "",
  sellerBlogUrl: auction.sellerBlogUrl || "",
  sellerCafeNick: auction.sellerCafeNick || "",
  sellerBandNick: auction.sellerBandNick || "",
  sellerTrustNote: auction.sellerTrustNote || "",
});

function MessageState({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <p className="text-[18px] font-bold text-app-text">{title}</p>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-[22px] text-app-muted">{description}</p>
      {buttonLabel && onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-5 h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}

function AuctionEditFormBody({
  auction,
  auctionId,
  editAvailableUntilText,
  lockReason,
  onEditRejected,
}: {
  auction: Auction;
  auctionId: number;
  editAvailableUntilText: string;
  /** 수정 중 입찰·시간 경과로 막히면 폼은 유지하고 저장만 막는다. */
  lockReason: AuctionEditLockReason | null;
  onEditRejected: () => void;
}) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const initialCategory = useMemo(() => findCategoryBranch(auction.category || ""), [auction.category]);
  const [form, setForm] = useState<FormState>(() => buildInitialForm(auction));
  // 종료 시각을 건드리지 않았으면 원래 값을 그대로 보낸다(입력칸은 분 단위라 초가 잘린다).
  const [initialEndAt] = useState(() => ({ iso: new Date(auction.endAt).toISOString(), input: toLocalInputValue(auction.endAt) }));
  const [startPrice, setStartPrice] = useState<number | null>(auction.startPrice || null);
  const [photos, setPhotos] = useState<string[]>(() => auction.photos || []);
  const [sellerProofImage, setSellerProofImage] = useState<string | null>(auction.sellerProofImage || null);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory.parent);
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialCategory.child);
  const [selectedBloodlineRootId, setSelectedBloodlineRootId] = useState(
    auction.bloodlineRootId ? String(auction.bloodlineRootId) : ""
  );
  // 저장된 부모·누대로 채운다. 저장할 때 늘 지금 칸 값을 함께 보낸다(서버는 보낸 때만 바꾼다).
  const [pedigreeNote, setPedigreeNote] = useState<PedigreeNote>(() => ({ ...(auction.pedigreeNote ?? {}) }));
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [errors, setErrors] = useState<ErrorState>({});
  const [uploading, setUploading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const submitLockRef = useRef(false);

  const [updateAuction, { loading: submitting }] = useMutation<AuctionUpdateResponse>(`/api/auctions/${auctionId}`);

  // 수정은 저장된 입찰 단위로 채우고, 시작가를 바꿔도 따라 바꾸지 않는다.
  const bidIncrement = useBidIncrementInput(resolveBidIncrement(auction));
  const subcategories = selectedCategory ? getSubcategories(selectedCategory) : [];
  const categoryForSubmit = selectedSubcategory || selectedCategory;
  const bloodlineRootId = selectedBloodlineRootId ? Number(selectedBloodlineRootId) : null;
  // 혈통이 없거나 칸이 비면 null, 규칙에 안 맞으면 "invalid"(저장을 막는다).
  const pedigreePayload = auctionPedigreePayload(bloodlineRootId, pedigreeNote);
  // 지금 연결된 혈통을 넘겼거나 숨겨져 붙일 수 있는 목록에 없을 때 select 에 남길 라벨.
  const currentBloodlineLabel = auction.bloodline
    ? attachableOptionLabel({ ...auction.bloodline, relation: "mine" })
    : null;
  const customErrorMessages = [
    errors.photos,
    errors.category,
    errors.title,
    errors.description,
    errors.startPrice,
    errors.bidIncrement,
    errors.endAt,
    errors.pedigreeNote,
  ].filter((message): message is string => Boolean(message));
  const busy = submitting || uploading || proofUploading;
  const locked = lockReason !== null;
  const lockMessage = lockReason ? AUCTION_EDIT_LOCK_MESSAGES[lockReason] : null;
  const endAtChanged = form.endAt.trim() !== initialEndAt.input;

  const updateForm = (key: TextKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
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

  /** 칩(+N시간)은 저장 시점 기준으로 다시 계산해, 고른 뒤 시간이 흘러도 기간 제약을 넘지 않게 한다. */
  const resolveEndAtInput = () => (selectedDuration !== null ? toPresetEndAtInput(selectedDuration) : form.endAt);

  const validate = (endAtInput: string, changed: boolean) => {
    const next: ErrorState = {};
    if (photos.length === 0) next.photos = "최소 1장의 사진을 등록해주세요.";
    if (!categoryForSubmit) next.category = "카테고리를 선택해주세요.";
    if (!normalizeText(form.title)) next.title = "제목을 입력해주세요.";
    if (!normalizeText(form.description)) next.description = "설명을 입력해주세요.";
    if (startPrice === null || startPrice < AUCTION_MIN_START_PRICE) {
      next.startPrice = `최소 ${AUCTION_MIN_START_PRICE.toLocaleString()}원 이상`;
    }
    if (!bidIncrement.isValid) next.bidIncrement = BID_INCREMENT_ERROR;
    const endAtIso = toIsoDateTimeValue(endAtInput);
    if (!endAtIso) next.endAt = "유효한 종료 시각을 입력해주세요.";
    else if (changed && !isAuctionDurationValid(endAtIso)) {
      next.endAt = "종료 시각은 지금부터 1시간~72시간 사이로 정해주세요.";
    }
    if (pedigreePayload === "invalid") next.pedigreeNote = PEDIGREE_NOTE_INVALID_MESSAGE;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy || locked || submitLockRef.current) return;
    const endAtInput = resolveEndAtInput();
    if (endAtInput !== form.endAt) setForm((prev) => ({ ...prev, endAt: endAtInput }));
    const changed = endAtInput.trim() !== initialEndAt.input;
    if (!validate(endAtInput, changed)) {
      toast.error("필수 항목을 확인해주세요.");
      return;
    }
    submitLockRef.current = true;
    try {
      const result = await updateAuction({
        data: {
          action: "update",
          title: normalizeText(form.title),
          description: normalizeText(form.description),
          category: categoryForSubmit,
          photos,
          sellerProofImage,
          startPrice: startPrice ?? 0,
          minBidIncrement: bidIncrement.value ?? 0,
          endAt: changed ? toIsoDateTimeValue(endAtInput) : initialEndAt.iso,
          sellerPhone: normalizeText(form.sellerPhone),
          sellerEmail: normalizeText(form.sellerEmail),
          sellerBlogUrl: normalizeText(form.sellerBlogUrl),
          sellerCafeNick: normalizeText(form.sellerCafeNick),
          sellerBandNick: normalizeText(form.sellerBandNick),
          sellerTrustNote: normalizeText(form.sellerTrustNote),
          bloodlineRootId,
          pedigreeNote: pedigreePayload === "invalid" ? null : pedigreePayload,
        },
      });
      if (!result.success) {
        // 폴링 사이에 입찰·마감이 생긴 경우: 최신 상태로 사유를 다시 판별한다.
        if (result.errorCode === "AUCTION_EDIT_NOT_ALLOWED" || result.status === 403) onEditRejected();
        toast.error(getAuctionResultMessage(result, "경매 수정 중 오류가 발생했습니다."));
        return;
      }
      void globalMutate((key) => typeof key === "string" && key.startsWith("/api/auctions"), undefined, {
        revalidate: true,
      });
      toast.success("경매가 수정되었습니다.");
      router.replace(toAuctionPath(result.auction?.id || auctionId, normalizeText(form.title)));
    } catch {
      toast.error("네트워크 연결을 확인해 주세요.");
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <>
      <div className="flex flex-col gap-5 bg-app-bg px-5 pt-5 pb-[calc(140px+env(safe-area-inset-bottom))]">
        {lockMessage ? (
          <div role="alert" className="rounded-lg bg-app-danger-soft px-3.5 py-3">
            <p className="text-[14px] font-semibold text-app-danger">{lockMessage.title}</p>
            <p className="mt-1 text-[13px] leading-5 text-app-muted">
              {lockMessage.description} 입력한 내용은 저장되지 않아요.
            </p>
          </div>
        ) : null}

        <p className="text-[13px] leading-5 text-app-muted">
          진행중 + 등록 후 10분 이내 + 입찰 없음일 때만 수정할 수 있어요.
          <br />
          수정 가능 마감: {editAvailableUntilText}
        </p>

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
          <FieldLabel label="종료 시각" htmlFor="auction-end-at" />
          <ChipRow>
            {DURATION_PRESETS.map((preset) => (
              <FormChip
                key={preset.hours}
                label={`+${preset.label}`}
                active={selectedDuration === preset.hours}
                onClick={() => {
                  setSelectedDuration(preset.hours);
                  updateForm("endAt", toPresetEndAtInput(preset.hours));
                  setErrors((prev) => ({ ...prev, endAt: undefined }));
                }}
              />
            ))}
          </ChipRow>
          <input
            id="auction-end-at"
            type="datetime-local"
            value={form.endAt}
            onChange={(event) => {
              setSelectedDuration(null);
              updateForm("endAt", event.target.value);
            }}
            className={cn(FIELD_INPUT_CLASS, "mt-2", fieldBorder(Boolean(errors.endAt)))}
          />
          <HelpText>
            {endAtChanged
              ? `바꾼 종료 시각은 지금부터 1시간~72시간 사이여야 해요.${
                  selectedDuration !== null ? ` (${formatConfirmDateTime(toIsoDateTimeValue(form.endAt))})` : ""
                }`
              : "그대로 두면 기존 종료 시각이 유지돼요."}
          </HelpText>
          <ErrorText message={errors.endAt} />
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
          currentRootId={auction.bloodlineRootId}
          currentLabel={currentBloodlineLabel}
        />

        {/* 판매자 신뢰 정보(선택) */}
        <div>
          <FieldLabel label="판매자 신뢰 정보" caption="선택" />
          <p className="-mt-0.5 mb-2 text-[13px] leading-[18px] text-app-muted">
            전화·이메일은 가려서 보이고, 낙찰되면 낙찰자에게만 모두 보여요.
          </p>
          <div className="flex flex-col gap-2">
            {(
              [
                ["sellerPhone", "연락처(전화번호)", "tel"],
                ["sellerEmail", "연락 이메일", "email"],
                ["sellerBlogUrl", "블로그/프로필 URL", "url"],
                ["sellerCafeNick", "카페 닉네임", "text"],
                ["sellerBandNick", "밴드 닉네임", "text"],
              ] as const
            ).map(([key, placeholder, type]) => (
              <input
                key={key}
                type={type}
                value={form[key]}
                onChange={(event) => updateForm(key, event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                autoCapitalize={type === "email" || type === "url" ? "none" : undefined}
                className={cn(FIELD_INPUT_CLASS, "border-app-border")}
              />
            ))}
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
      </div>

      <BottomCta
        label={submitting ? "수정 중..." : "경매 수정 완료"}
        disabled={busy || locked}
        onClick={() => void submit()}
        errorText={lockMessage ? lockMessage.title : customErrorMessages.length ? customErrorMessages.join(" / ") : undefined}
      />
    </>
  );
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return formatConfirmDateTime(value);
};

const EditAuctionClient = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const auctionId = params?.id ? extractAuctionIdFromPath(params.id) : Number.NaN;
  const validAuctionId = Number.isFinite(auctionId);
  const idParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;

  const { data, error, mutate } = useSWR<AuctionDetailResponse>(
    validAuctionId && user ? `/api/auctions/${auctionId}` : null,
    { refreshInterval: 5000 }
  );
  const auction = data?.auction;
  const lockReason =
    data && auction
      ? getAuctionEditLockReason({
          canEdit: Boolean(data.canEdit),
          status: auction.status,
          bidCount: auction._count?.bids ?? auction.bids?.length ?? 0,
        })
      : null;
  // 한 번이라도 폼을 열었으면, 이후 폴링에서 수정 불가가 되어도 폼을 내리지 않는다(입력 유지).
  const [formOpened, setFormOpened] = useState(false);
  useEffect(() => {
    if (data?.canEdit && !formOpened) setFormOpened(true);
  }, [data?.canEdit, formOpened]);

  useEffect(() => {
    if (!isUserLoading && !user && validAuctionId) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/auctions/${idParam ?? ""}/edit`)}`);
    }
  }, [isUserLoading, user, validAuctionId, idParam, router]);

  const errorStatus = (error as { status?: number } | undefined)?.status;
  const spinner = (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="불러오는 중">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand" />
    </div>
  );

  const renderBody = () => {
    if (!validAuctionId) {
      return (
        <MessageState
          title="경매를 찾을 수 없습니다"
          description="잘못된 경매 주소입니다."
          buttonLabel="경매 목록으로 가기"
          onClick={() => router.replace("/auctions")}
        />
      );
    }
    if (isUserLoading || !user) return spinner;
    if (!data && !error) return spinner;
    // 삭제(404)·권한 없음(403)은 다시 받아도 같으므로 받아 둔 폼을 내리고 목록으로 보낸다.
    if (errorStatus === 404 || errorStatus === 403) {
      return (
        <MessageState
          title="경매를 불러올 수 없습니다"
          description={(error as Error | undefined)?.message || "삭제되었거나 볼 수 없는 경매입니다."}
          buttonLabel="경매 목록으로 가기"
          onClick={() => router.replace("/auctions")}
        />
      );
    }
    // 폴링이 한 번 실패해도 이미 받은 경매가 있으면 폼(입력 중인 내용)을 그대로 둔다.
    if (!auction) {
      return (
        <MessageState
          title="경매 정보를 불러오지 못했습니다"
          description="잠시 후 다시 시도해주세요."
          buttonLabel="다시 시도"
          onClick={() => void mutate()}
        />
      );
    }
    if (!data?.isOwner) {
      return (
        <MessageState
          title="본인 경매만 수정할 수 있습니다"
          description="등록자가 아닌 계정으로는 경매 수정 화면에 접근할 수 없어요."
          buttonLabel="상세로 돌아가기"
          onClick={() => router.replace(toAuctionPath(auction.id, auction.title))}
        />
      );
    }
    if (lockReason && !formOpened) {
      const message = AUCTION_EDIT_LOCK_MESSAGES[lockReason];
      return (
        <MessageState
          title={message.title}
          description={
            lockReason === "time"
              ? `${message.description}\n수정 가능 마감: ${formatDateTime(data.editAvailableUntil)}`
              : message.description
          }
          buttonLabel="상세로 돌아가기"
          onClick={() => router.replace(toAuctionPath(auction.id, auction.title))}
        />
      );
    }
    return (
      <AuctionEditFormBody
        key={auction.id}
        auction={auction}
        auctionId={auctionId}
        editAvailableUntilText={formatDateTime(data.editAvailableUntil)}
        lockReason={lockReason}
        onEditRejected={() => void mutate()}
      />
    );
  };

  return (
    <Layout canGoBack title="경매 수정" seoTitle="경매 수정">
      {renderBody()}
    </Layout>
  );
};

export default EditAuctionClient;
