import React, { useState } from "react";
import { UseFormRegisterReturn } from "react-hook-form";

import CheckBoxActive from "@icons/CheckBoxActive.svg";
import CheckBoxDefault from "@icons/CheckBoxDefault.svg";
import CheckBoxDisable from "@icons/CheckBoxDisable.svg";
import RadioActive from "@icons/RadioActive.svg";
import RadioDefault from "@icons/RadioDefault.svg";
import RadioDisable from "@icons/RadioDisable.svg";

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
