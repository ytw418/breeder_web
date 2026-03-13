import React from "react";
import MobileAppBridgeClient from "@components/features/mobile/MobileAppBridgeClient";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-h-screen">
      <MobileAppBridgeClient />
      {children}
    </div>
  );
}
