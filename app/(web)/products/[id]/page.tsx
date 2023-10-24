import React from "react";
import ProductClient from "./ProductClient";
import { getProduct } from "@libs/server/apis";

const page = async ({ params: { id } }: { params: { id: string } }) => {
  const data = await getProduct(id);

  return (
    <div>
      <ProductClient
        product={data.product}
        relatedProducts={data.relatedProducts}
        success={true}
      />
    </div>
  );
};

export default page;
