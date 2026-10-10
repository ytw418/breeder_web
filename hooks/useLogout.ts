import axios from "axios";
import { clearTokens } from "@libs/client/authToken";
import { clearGuinnessDrafts } from "@libs/client/guinnessDraft";
import { resetPosthogUser } from "@libs/client/posthog";

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
      // 같은 브라우저의 다음 계정에 브리디북 신청서 임시저장이 보이지 않게 지운다.
      clearGuinnessDrafts(null);
      // 같은 브라우저의 다음 방문자가 이 계정으로 기록되지 않게 PostHog 식별을 푼다.
      resetPosthogUser();
      window.location.replace("/");
    }
  };
  return handleLogout;
}
