import type { UseFormRegisterReturn } from "react-hook-form";

interface InputProps {
  label?: string;
  name: string;
  kind?: "text" | "phone" | "price";
  type: string;
  register: UseFormRegisterReturn;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function Input({
  label,
  name,
  kind = "text",
  register,
  type,
  required,
  placeholder = "",
  className = "",
}: InputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor={name}
        >
          {label}
        </label>
      )}
      {kind === "text" ? (
        <div className="relative flex items-center">
          <input
            id={name}
            required={required}
            {...register}
            type={type}
            placeholder={placeholder}
            className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#3182F6]/20 focus:border-transparent transition-all ${className}`}
          />
        </div>
      ) : null}
      {kind === "price" ? (
        <div className="relative flex items-center">
          <div className="absolute left-4 pointer-events-none flex items-center justify-center">
            <span className="text-gray-500 text-sm">₩</span>
          </div>
          <input
            id={name}
            required={required}
            {...register}
            type={type}
            placeholder={placeholder}
            className={`w-full pl-10 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#3182F6]/20 focus:border-transparent transition-all ${className}`}
          />
        </div>
      ) : null}
      {kind === "phone" ? (
        <div className="flex rounded-xl overflow-hidden">
          <span className="flex items-center justify-center px-4 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 select-none text-sm">
            +82
          </span>
          <input
            id={name}
            required={required}
            {...register}
            type={type}
            className={`w-full px-4 py-3 border border-gray-200 focus:ring-2 focus:ring-[#3182F6]/20 focus:border-transparent transition-all ${className}`}
          />
        </div>
      ) : null}
    </div>
  );
}
