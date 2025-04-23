import React from "react";
import MySellHistoryList from "@components/features/profile/MySellHistoryList";

const page = ({ params }: { params: { id: string } }) => {
  if (params?.id) {
    return (
      <div>
        <MySellHistoryList kind="sales" id={Number(params?.id)} />
      </div>
    );
  }
};

export default page;
