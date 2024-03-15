import React, { useState } from "react";
import { UseFormRegisterReturn } from "react-hook-form";

import CheckBoxActive from "@hero/plus.svg";
import CheckBoxDefault from "@hero/plus.svg";
import CheckBoxDisable from "@hero/plus.svg";
import RadioActive from "@hero/plus.svg";
import RadioDefault from "@hero/plus.svg";
import RadioDisable from "@hero/plus.svg";

interface CheckProps {
  type: "checkbox" | "radio";
  disabled?: boolean;
  isChecked: boolean;

  register: UseFormRegisterReturn;
  [key: string]: any;
}

const Check = ({
  type,
  isChecked,
  disabled,
  register,

  ...props
}: CheckProps) => {
  const { onChange, ...registerProps } = register;
  return (
    <div className="inline-block">
      <label>
        <input
          {...registerProps}
          onChange={(e) => {
            onChange?.(e);
          }}
          type={type}
          hidden
          {...props}
        />
        {type === "checkbox" &&
          (disabled ? (
            <CheckBoxDisable />
          ) : isChecked ? (
            <CheckBoxActive />
          ) : (
            <CheckBoxDefault />
          ))}
        {type === "radio" &&
          (disabled ? (
            <RadioDisable />
          ) : isChecked ? (
            <RadioActive />
          ) : (
            <RadioDefault />
          ))}
      </label>
    </div>
  );
};

export default Check;
