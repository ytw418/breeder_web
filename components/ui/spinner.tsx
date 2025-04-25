import React from "react";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "w-4 h-4",
      md: "w-6 h-6",
      lg: "w-8 h-8",
    };

    return (
      <div
        ref={ref}
        className={`animate-spin rounded-full border-2 border-gray-200 border-t-gray-600 ${sizeClasses[size]} ${className || ""}`}
        {...props}
      />
    );
  }
);

Spinner.displayName = "Spinner";

export { Spinner }; 