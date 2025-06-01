import React from "react";
import ChatsClient from "../chat/ChatClient";
import { getSessionUser } from "@libs/server/getUser";
import { redirect } from "next/navigation";

const Page = async () => {
  const user = await getSessionUser();

  if (!user) {
    return redirect("/auth/login");
  }
  return <ChatsClient />;
};

export default Page;
