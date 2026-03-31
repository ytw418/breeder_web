import React from "react";
import MySellHistoryList from "@components/features/profile/MySellHistoryList";

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (id) {
    return (
      <div>
        <MySellHistoryList kind="purchases" id={Number(id)} />
      </div>
    );
  }
};

export default page;
