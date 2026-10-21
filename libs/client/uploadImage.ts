"use client";
import { authFetch } from "@libs/client/authFetch";

/** Cloudflare 직접 업로드 후 이미지 id 를 돌려준다(프로필 수정·시작하기의 아바타·커버 공용, 앱 uploadImageAsset). */
export async function uploadImageFile(file: File, name: string): Promise<string> {
  const fileApiRes = await authFetch(`/api/files`);
  if (!fileApiRes.ok) throw new Error("이미지 업로드 URL을 가져오지 못했습니다.");
  const { uploadURL } = await fileApiRes.json();
  if (!uploadURL) throw new Error("이미지 업로드 URL이 유효하지 않습니다.");
  const form = new FormData();
  form.append("file", file, name);
  const uploadRes = await fetch(uploadURL, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("이미지 업로드에 실패했습니다.");
  const uploadData = await uploadRes.json();
  const id = uploadData?.result?.id;
  if (!id) throw new Error("업로드 이미지 ID를 확인할 수 없습니다.");
  return id as string;
}
