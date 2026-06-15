import axios from "axios";
import { clearTokens } from "@libs/client/authToken";

export default function useLogout() {
  const handleLogout = async () => {
    // TODO: SNS 로그아웃 연동?
    try {
      await axios.post("/api/auth/logout");
    } catch (error) {
      console.log("logout error: ", error);
    } finally {
      // stateless 방식이므로 클라이언트 토큰 폐기가 실제 로그아웃이다.
      clearTokens();
      window.location.replace("/");
    }
  };
  return handleLogout;
}
