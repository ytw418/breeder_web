import axios from "axios";
import {
  notifySessionCleared,
  readStoredMobilePushDevice,
} from "@libs/client/mobile/bridge";

export default function useLogout() {
  const handleLogout = async () => {
    // TODO: SNS 로그아웃 연동?
    try {
      const device = readStoredMobilePushDevice();
      if (device?.token) {
        await fetch("/api/mobile/push-token", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: device.token }),
        }).catch(() => undefined);
      }

      await axios.post("/api/auth/logout");
      notifySessionCleared();
      window.location.replace("/");
    } catch (error) {
      console.log("logout error: ", error);
    }
  };
  return handleLogout;
}
