import React from "react";
import EditClient from "./EditClient";
import { getProduct } from "@libs/server/apis";

const page = async ({ params: { id } }: { params: { id: string } }) => {
  const data = await getProduct(id);

  return (
    <div>
      <EditClient product={data.product} />
    </div>
  );
};

export default page;
