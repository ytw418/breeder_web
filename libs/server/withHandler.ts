import { NextApiRequest, NextApiResponse } from "next";

export interface ResponseType {
  success?: boolean;
  message?: string;
  [key: string]: any;
}

type method = "GET" | "POST" | "DELETE" | "PATCH";

interface ConfigType {
  methods: method[];
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
  isPrivate: boolean;
}

export default function withHandler({
  methods,
  handler,
  isPrivate = true,
}: ConfigType) {
  return async function (
    req: NextApiRequest,
    res: NextApiResponse
  ): Promise<any> {
    if (req.method && !methods.includes(req.method as any)) {
      return res.status(405).json({ message: "요청 method가 일치하지 않음." });
    }
    if (isPrivate && !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "로그인이 필요한 요청입니다!",
      });
    }
    try {
      await handler(req, res);
    } catch (error) {
      console.error("withHandler.error", error);
      const message =
        error instanceof Error ? error.message : "서버 내부 오류가 발생했습니다.";
      return res.status(500).json({ success: false, message });
    }
  };
}
