import axios from "axios";

export default function useLogout() {
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
