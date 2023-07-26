import { NextApiRequest, NextApiResponse } from "next";

export interface ResponseType {
  success: boolean;
  [key: string]: any;
}

type method = "GET" | "POST" | "DELETE";

interface ConfigType {
  methods: method[];
  handler: (req: NextApiRequest, res: NextApiResponse) => void;
  isPrivate?: boolean;
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
      return res.status(405).end();
    }
    if (isPrivate && !req.session.user && !req.session.token) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요한 요청입니다!",
      });
    }
    try {
      await handler(req, res);
    } catch (error) {
      console.log("withHandler.error", error);
      return res.status(500).json({ error });
    }
  };
}