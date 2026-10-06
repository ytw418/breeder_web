"use client";

/**
 * 채팅 화면 공용 조각(시안 A-karrot.html 의 아이콘 path, 앱 CenterNotice/PrimaryButton).
 */

export function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function PersonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-app-caption"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 19.5c1.2-3.3 4-5 7.5-5s6.3 1.7 7.5 5" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 5L8 12l6.5 7" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="18.5" r="1" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M12 6l6 6-6 6" />
    </svg>
  );
}

/** 가운데 안내: 제목 18/700 + 설명 14 muted + 주 CTA(h52 r6 brand 16/600). */
export function ChatCenterNotice({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center px-[21px] py-16 text-center">
      <p className="text-[18px] font-bold tracking-[-0.3px] text-app-text">{title}</p>
      {description ? <p className="mt-2 text-[14px] text-app-muted">{description}</p> : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-[17.5px] h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
