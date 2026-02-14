import React, { useEffect, useState } from "react";
import NextImage, { ImageProps as NextImageProps } from "next/image";
import defaultImage from "@images/defaultImage.png";

// 기본 blurDataURL - 작은 회색 이미지
const defaultBlurDataURL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface CustomImageProps extends NextImageProps {
  fallbackSrc?: string;
}

/**
 * 이미지 로드 실패 시 대체 이미지를 표시하는 커스텀 Image 컴포넌트
 * Next.js의 Image 컴포넌트를 확장하여 에러 핸들링 로직을 추가함
 */
const Image = ({
  src,
  alt,
  fallbackSrc = defaultImage.src,
  blurDataURL = defaultBlurDataURL,
  onError,
  ...props
}: CustomImageProps) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [imgError, setImgError] = useState(false);
  const isExternalUrl =
    typeof imgSrc === "string" && /^https?:\/\//i.test(imgSrc);
  const shouldUnoptimize = props.unoptimized ?? isExternalUrl;

  // 부모에서 src가 바뀌면 내부 상태도 동기화한다.
  useEffect(() => {
    setImgSrc(src);
    setImgError(false);
  }, [src]);

  // 이미지 로드 실패 시 호출되는 핸들러
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!imgError) {
      setImgSrc(fallbackSrc);
      setImgError(true);
    }

    // 기존 onError 핸들러가 있으면 호출
    if (onError) {
      onError(e);
    }
  };

  return (
    <NextImage
      {...props}
      src={imgSrc}
      alt={alt}
      unoptimized={shouldUnoptimize}
      blurDataURL={blurDataURL}
      onError={handleError}
    />
  );
};

export default Image;
