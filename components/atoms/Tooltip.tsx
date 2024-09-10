import React, { useEffect, useRef, useState } from "react";
import { Colors } from "styles/colors";

import Close from "@hero/plus.svg";
import Tip from "@hero/plus.svg";

const Tooltip = ({ tip }: { tip: { title?: string; text: string } }) => {
  const [isOpenTooltip, setIsOpenTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClose = (e: { target: any }) => {
      // useRef current에 담긴 엘리먼트 바깥을 클릭 시 tooltip 닫힘
      if (isOpenTooltip && !tooltipRef.current?.contains(e.target)) {
        setIsOpenTooltip(false);
      }
    };
    document.addEventListener("click", handleOutsideClose);

    return () => document.removeEventListener("click", handleOutsideClose);
  }, [isOpenTooltip]);
  return (
    <div ref={tooltipRef} className="relative ml-[1px]">
      <Tip
        className="ml-[2px] cursor-pointer"
        fill={Colors.GRAY_300}
        onClick={() => setIsOpenTooltip(true)}
      />
      {isOpenTooltip && (
        <div className="absolute left-0 top-[20px] z-10 flex h-auto w-[343px] flex-col items-start gap-1 rounded-lg border-[0.6px] border-Gray-300 bg-White p-[16px_20px] pr-[18px] shadow-[0px_10px_25px_4px_rgba(0,0,0,0.06),0px_0px_1px_0px_rgba(0,0,0,0.08)]">
          {tip?.title && <p className="title-2 text-Black">{tip.title}</p>}
          <p className="body-1 text-Black">{tip.text}</p>
          <button
            type="button"
            className="absolute right-[20px] top-[20px]"
            onClick={() => setIsOpenTooltip(false)}
          >
            <Close width="12" height="12" fill={Colors.BLACK} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
