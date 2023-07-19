import axios from "axios";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import { useAuth } from "@libs/client/AuthProvider";

export default function useLogout() {
  const router = useRouter();
  const { kakaoLogout, googleLogout } = useAuth();

  const handleLogout = async () => {
    // TODO: SNS 로그아웃 연동?
    try {
      await axios.post("/api/auth/logout");
      window.location.replace("/");
    } catch (error) {
      console.log("logout error: ", error);
    }
  };
  return handleLogout;
}
