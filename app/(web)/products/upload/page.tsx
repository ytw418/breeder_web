import React from "react";
import UploadClient from "./UploadClient";
import { getSessionUser } from "@libs/server/getUser";
import { redirect } from "next/navigation";
const page = async () => {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/login");
  }
  return <UploadClient />;
};

export default page;
