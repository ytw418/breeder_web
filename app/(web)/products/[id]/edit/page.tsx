import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import { extractProductId } from "@libs/product-route";
import EditClient from "./EditClient";

export const metadata: Metadata = {
  title: "상품 수정 | 브리디",
  robots: { index: false, follow: false },
};

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <AuthGuard>
      <EditClient productId={extractProductId(id)} />
    </AuthGuard>
  );
};

export default page;
