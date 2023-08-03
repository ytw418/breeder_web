import React, { FC } from "react";

import chevron_left from "@hero/chevron_left.svg";
import chevron_right from "@hero/chevron_right.svg";
import clsx from "clsx";

export const iconTypes: any = {
  chevron_left: chevron_left,
  chevron_right: chevron_right,
} as const;
export type IconName = keyof typeof iconTypes;

interface IIconProps {
  name: IconName;
  stroke?: string;
  strokeWidth?: string;
  fill?: string;
  width?: string;
  height?: string;
  [key: string]: any;
}
const Icon: FC<IIconProps> = ({ name, className, ...props }) => {
  let Icon: any = iconTypes[name];
  return (
    <Icon
      {...props}
      className={clsx("cursor-pointer ", className)}
      style={{ display: "inline" }}
    />
  );
};

export default Icon;
