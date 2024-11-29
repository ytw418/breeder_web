import React from "react";
import ProductClient from "./PostClient";
import { getPost } from "@libs/server/apis";

const page = async ({ params: { id } }: { params: { id: string } }) => {
  const data = await getPost(id);

  return (
    <div>
      <ProductClient post={data.post} success={true} />
    </div>
  );
};

export default page;
