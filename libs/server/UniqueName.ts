import { randomUsername } from "@libs/randomName";
import client from "@libs/server/client";
import { v4 } from "uuid";
// 유니크한 무작위 닉네임 생성 함수
export const UniqueName = async () => {
  let randomNickname = "";
  while (true) {
    randomNickname = randomUsername({ maxLength: 10, maxNum: 100 }); // 무작위 닉네임 생성
    // 이미 존재하는 닉네임인지 확인
    const existingUser = await client.user.findUnique({
      where: { name: randomNickname },
    });

    if (!existingUser) {
      break; // 존재하지 않으면 반복 종료
    }
  }

  return randomNickname.substring(0, 8);
};
