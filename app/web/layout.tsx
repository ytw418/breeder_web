import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-[1024px] justify-center">{children}</div>;
}
