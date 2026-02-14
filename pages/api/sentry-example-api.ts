import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, _res: NextApiResponse) {
  throw new Error("Sentry test error from /api/sentry-example-api");
}
