import Link from "next/link";
import React from "react";

interface FloatingButton {
  children: React.ReactNode;
  href: string;
}

export default function FloatingButton({ children, href }: FloatingButton) {
  return (
    <Link
      href={href}
      className="app-fab fixed z-50 bottom-24 right-5 flex aspect-square w-14 items-center justify-center rounded-2xl border border-orange-400/35 bg-orange-500 text-white shadow-[0_12px_28px_rgba(251,146,60,0.35)] transition-all hover:bg-orange-600"
    >
      {children}
    </Link>
  );
}
