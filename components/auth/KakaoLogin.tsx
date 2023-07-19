"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Spinner } from "@components/atoms/Spinner";
import useApiMutation from "@libs/client/useApiMutation";

export const KakaoLogin = () => {
  const searchParams = useSearchParams()!;
  const router = useRouter();

  const [kakaoAuth, { loading, data, error }] = useApiMutation(
    "https://kauth.kakao.com"
  );

  useEffect(() => {
    if (searchParams.get("code")) {
      kakaoAuth(
        encodeURI(
          `grant_type=authorization_code&client_id=${
            process.env.NEXT_PUBLIC_KAKAO_API_KEY
          }&code=${searchParams.get("code")}&redirect_uri=${process.env
            .NEXT_PUBLIC_DOMAIN_URL!}/login-loading`
        ),
        "/oauth/token",
        "application/x-www-form-urlencoded;charset=utf-8"
      );
      return;
    } else if (searchParams.get("error")) {
      alert("카카오 로그인에 오류가 생겼습니다. 다시 시도해주세요");
      console.log(searchParams.get("error"));
      console.log(searchParams.get("error_description"));
      router.back();
      return;
    }
    return;
  }, []);

  useEffect(() => {
    if (data && !data.error) {
      console.log(" https://kauth.kakao.com :>> ", data);
      loginWithKakao();
      return;
    }
  }, [data]);

  const loginWithKakao = async () => {
    const userData = await fetch("https://kapi.kakao.com/v2/user/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${data.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => data)
      .catch((err) => console.log(err));

    if (userData.id) {
      const {
        id,
        kakao_account: {
          email,
          profile: { is_default_image, nickname, thumbnail_image_url },
        },
      } = userData;

      console.log("userData :>> ", userData);
      alert("카카오 로그인 완료");
    } else {
      alert("오류가 생겼습니다. 다시 시도해주세요.");
      router.back();
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Spinner />
    </div>
  );
};

export default KakaoLogin;
