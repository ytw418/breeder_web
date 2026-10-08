/**
 * 운영자가 숨긴 콘텐츠를 작성자·관리자가 볼 때 상세 위에 띄우는 한 줄 안내(앱 HiddenContentNotice).
 * 브리더 뱃지와 같은 중립 톤(surface 배경, muted 글자).
 */
import { MODERATION_TARGET_LABEL, type ModerationTargetType } from "@libs/client/moderation";
import { cn } from "@libs/client/utils";

export default function HiddenContentNotice({
  targetType,
  className,
}: {
  targetType: ModerationTargetType;
  className?: string;
}) {
  return (
    <p role="alert" className={cn("rounded-lg bg-app-surface px-3 py-2.5 text-[13px] leading-[19px] text-app-muted", className)}>
      운영 정책에 따라 비공개된 {MODERATION_TARGET_LABEL[targetType]}입니다. 작성자와 관리자에게만 보입니다.
    </p>
  );
}
