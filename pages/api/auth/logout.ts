import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";

/**
 * stateless JWT 방식이라 서버에 보관하는 세션이 없다.
 * 실제 로그아웃은 클라이언트가 저장한 access/refresh 토큰을 폐기하는 것으로 완료된다.
 * 본 엔드포인트는 호환성을 위해 200 만 반환한다.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  res.status(200).json({ success: true });
}

export default withAuth(
  withHandler({ methods: ["POST"], handler, isPrivate: false })
);
