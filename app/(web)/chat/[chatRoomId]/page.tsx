import React from "react";
import ChatRoomClient from "./ChatRoomClient";

const page = () => {
  console.log("서버컴포넌트");
  return <ChatRoomClient />;
};

export default page;
