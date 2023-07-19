import React from "react";
import ChatsClient from "../chat/ChatClient";
import { getUser } from "@libs/client/getUser";
import { redirect, useRouter } from "next/navigation";

const Page = async () => {
  const user = await getUser();

  if (!user) {
    return redirect("/auth/login");
  }
  return <ChatsClient />;
};

export default Page;
