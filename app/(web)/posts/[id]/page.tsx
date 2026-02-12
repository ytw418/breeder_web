import React from "react";
import PostClient from "./PostClient";
import { getPost } from "@libs/server/apis";
import { notFound } from "next/navigation";

const page = async ({ params: { id } }: { params: { id: string } }) => {
  const data = await getPost(id);
  if (!data.success || !data.post) {
    notFound();
  }

  return (
    <div>
      <PostClient post={data.post} success={data.success} />
    </div>
  );
};

export default page;
