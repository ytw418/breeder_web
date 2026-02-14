import React from "react";
import EditClient from "./EditClient";
import { getProduct } from "@libs/server/apis";

const page = async ({ params: { id } }: { params: { id: string } }) => {
  const productId = id.split(/[_-]/)[0];

  const data = await getProduct(productId, { mode: "no-store" });

  return (
    <div>
      <EditClient product={data.product} />
    </div>
  );
};

export default page;
