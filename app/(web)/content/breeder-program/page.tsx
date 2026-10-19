import type { Metadata } from "next";
import { getFoundingBreederCount } from "@libs/server/breeder-programs";

import BreederProgramClient from "./BreederProgramClient";

export const metadata: Metadata = {
  title: "창립 브리더 프로그램",
  description: "브리디 창립 브리더 100인 — 번호 뱃지와 경매 수수료 혜택을 계정에 함께 드려요.",
  alternates: { canonical: "https://bredy.app/content/breeder-program" },
};

export default async function Page() {
  let foundingBreederCount: number | null = null;

  try {
    foundingBreederCount = await getFoundingBreederCount();
  } catch {
    foundingBreederCount = null;
  }

  return <BreederProgramClient foundingBreederCount={foundingBreederCount} />;
}
