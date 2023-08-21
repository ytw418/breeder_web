"use client";

import { useEffect } from "react";

const Error = ({ error, reset }: { error: Error; reset: () => void }) => {
  useEffect(() => {
    // Log the error to an error reporting service
    console.log("error페이지 :>> ", error);
  }, [error]);
  return <div>{error.message}</div>;
};

export default Error;
