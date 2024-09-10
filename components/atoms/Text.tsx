import { ReactElement } from "react";

import Required from "@hero/plus.svg";

import Tooltip from "./Tooltip";

interface TextProps {
  style?: string;
  text?: string | null;
  description?: string | ReactElement;
  tip?: {
    title?: string;
    text: string;
  };
  required?: boolean;
}

export default function Text({ text, required, tip, description }: TextProps) {
  return (
    <div className="flex flex-col gap-[2px]">
      {text && (
        <div className="flex flex-row items-center">
          <span className="body-10 text-Black">{text}</span>
          {required && <Required className="ml-[1px]" />}
          {tip && <Tooltip tip={tip} />}
        </div>
      )}

      {description &&
        (typeof description === "object" ? (
          description
        ) : (
          <span className="body-2 text-Gray-400">{description}</span>
        ))}
    </div>
  );
}
