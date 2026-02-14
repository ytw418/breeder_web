import type { Metadata } from "next";
import EditAuctionClient from "./EditAuctionClient";

export const metadata: Metadata = {
  title: "경매 수정",
  robots: {
    index: false,
    follow: false,
  },
};

const page = () => {
  return <EditAuctionClient />;
};

export default page;
