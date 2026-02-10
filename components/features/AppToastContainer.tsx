"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ToastContainer } from "react-toastify";

export default function AppToastContainer() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toastTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <ToastContainer
      position="bottom-center"
      autoClose={2200}
      hideProgressBar
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      closeButton={false}
      limit={3}
      theme={toastTheme}
      className="app-toast-container"
      toastClassName="app-toast"
    />
  );
}
