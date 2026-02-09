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
      className="app-fab fixed z-50 bottom-24 right-5 flex aspect-square w-14 items-center justify-center rounded-2xl border border-slate-700/20 bg-slate-900 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)] transition-all hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}
