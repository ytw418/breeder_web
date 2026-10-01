/** 게시글 사진 최대 장수. 앱 업로드 화면이 같은 값을 쓴다. */
export const POST_IMAGES_MAX = 10;

export type PostImagesErrorCode = "POST_INVALID_IMAGES" | "POST_TOO_MANY_IMAGES";

export type PostImagesInputResult =
  | { ok: true; image: string; images: string[] }
  | { ok: false; errorCode: PostImagesErrorCode; message: string };

/**
 * 게시글 작성 요청의 사진 필드를 저장할 값으로 정규화한다.
 * - `images`(Cloudflare 이미지 id 배열)를 보내면 그대로 저장하고 `image` 는 첫 장(없으면 "")으로 맞춘다.
 * - `images` 없이 `image` 만 보내는 기존 웹 요청은 `image` 를 그대로 저장하고 `images = image ? [image] : []`.
 */
export const resolvePostImagesInput = (input: {
  image?: unknown;
  images?: unknown;
}): PostImagesInputResult => {
  if (input.images !== undefined && input.images !== null) {
    const images = input.images;
    if (
      !Array.isArray(images) ||
      !images.every((id) => typeof id === "string" && id.trim() !== "")
    ) {
      return {
        ok: false,
        errorCode: "POST_INVALID_IMAGES",
        message: "사진 정보가 올바르지 않습니다.",
      };
    }
    if (images.length > POST_IMAGES_MAX) {
      return {
        ok: false,
        errorCode: "POST_TOO_MANY_IMAGES",
        message: `사진은 최대 ${POST_IMAGES_MAX}장까지 올릴 수 있습니다.`,
      };
    }
    return { ok: true, image: images[0] ?? "", images };
  }

  const image = typeof input.image === "string" ? input.image : "";
  return { ok: true, image, images: image ? [image] : [] };
};

/**
 * 응답용 보정. `images` 컬럼이 비어 있는 구 데이터는 `image` 로 채운다. `image` 필드는 그대로 둔다.
 */
export const withPostImages = <
  T extends { image?: string | null; images?: string[] | null },
>(
  post: T
): T & { images: string[] } => {
  const images =
    Array.isArray(post.images) && post.images.length > 0
      ? post.images
      : post.image
        ? [post.image]
        : [];
  return { ...post, images };
};
