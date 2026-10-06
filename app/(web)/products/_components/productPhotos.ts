import type { PhotoItem } from "@components/app/PhotoGridEditor";
import { authFetch } from "@libs/client/authFetch";
import { makeImageUrl } from "@libs/client/utils";

/** 서버에 이미 올라간 사진은 remoteId 를 갖는다. 새로 고른 사진은 file 만 있다. */
export type ProductPhoto = PhotoItem & { remoteId?: string };

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 2;

export const toRemoteProductPhotos = (ids: string[] | null | undefined): ProductPhoto[] =>
  (ids ?? []).map((id) => ({ key: `remote-${id}`, src: makeImageUrl(id, "product"), remoteId: id }));

let localSeq = 0;
/** 고른 파일을 사진 항목으로. 이미지가 아니거나 10MB 를 넘으면 오류 문구를 돌려준다(앱 ProductPhotoPicker 문구). */
export function toLocalProductPhotos(
  files: File[]
): { photos: ProductPhoto[]; error?: string } {
  if (files.some((file) => !file.type.startsWith("image/"))) {
    return { photos: [], error: "이미지 파일만 업로드할 수 있습니다." };
  }
  if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
    return { photos: [], error: "이미지 1장당 최대 10MB까지 업로드할 수 있습니다." };
  }
  return {
    photos: files.map((file) => ({
      key: `local-${Date.now()}-${localSeq++}`,
      src: URL.createObjectURL(file),
      file,
    })),
  };
}

/** 올라간 사진(uploaded)을 remote 로 바꾼다. 미리보기 주소·키는 그대로 둬 다시 그리지 않는다. */
export const markProductPhotoUploaded = (
  photos: ProductPhoto[],
  uploaded: ProductPhoto,
  id: string
): ProductPhoto[] =>
  photos.map((photo) =>
    photo.key === uploaded.key ? { ...photo, remoteId: id, file: undefined } : photo
  );

async function uploadProductImage(file: File): Promise<string> {
  const urlResponse = await authFetch("/api/files");
  const urlResult = (await urlResponse.json().catch(() => null)) as {
    uploadURL?: string;
    id?: string;
  } | null;
  if (!urlResponse.ok || !urlResult?.uploadURL) {
    throw new Error("이미지 업로드 URL 발급에 실패했습니다.");
  }
  const form = new FormData();
  form.append("file", file, file.name);
  const uploaded = await fetch(urlResult.uploadURL, { method: "POST", body: form });
  const payload = (await uploaded.json().catch(() => null)) as {
    success?: boolean;
    result?: { id?: string };
  } | null;
  const imageId = payload?.result?.id || urlResult.id;
  if (!uploaded.ok || !imageId) throw new Error("이미지 업로드에 실패했습니다.");
  return imageId;
}

/**
 * 새로 고른 사진만 올리고 화면 순서대로 이미지 id 목록을 돌려준다(앱 resolveProductPhotoIds).
 * 2장씩 올리고, 한 장이 실패하면 아직 시작하지 않은 사진은 올리지 않는다.
 * 한 장이 올라갈 때마다 onUploaded(index, id) 를 불러 화면이 remote 로 바꿔 두면 재시도 때 다시 올리지 않는다.
 */
export async function resolveProductPhotoIds(
  photos: ProductPhoto[],
  onUploaded?: (index: number, id: string) => void,
  upload: (file: File) => Promise<string> = uploadProductImage
): Promise<string[]> {
  const ids = new Array<string>(photos.length);
  let nextIndex = 0;
  const failedIndexes: number[] = [];
  const worker = async () => {
    while (!failedIndexes.length && nextIndex < photos.length) {
      const index = nextIndex++;
      const photo = photos[index];
      if (photo.remoteId) {
        ids[index] = photo.remoteId;
        continue;
      }
      try {
        ids[index] = await upload(photo.file as File);
      } catch {
        failedIndexes.push(index);
        continue;
      }
      onUploaded?.(index, ids[index]);
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
  if (failedIndexes.length) {
    const numbers = failedIndexes
      .sort((a, b) => a - b)
      .map((index) => index + 1)
      .join(", ");
    throw new Error(`${numbers}번째 사진을 올리지 못했어요. 네트워크를 확인하고 다시 시도해주세요.`);
  }
  return ids;
}
