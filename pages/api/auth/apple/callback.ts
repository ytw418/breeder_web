import jwtDecode from "jwt-decode";
import { NextApiRequest, NextApiResponse } from "next";

import { DEFAULT_THUMBNAIL_CDN, Provider, Role } from "@libs/constants";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";

interface Decoded {
  iss: string; // https://appleid.apple.com
  aud: string; 
  exp: number; // 1645789996
  iat: number;
  sub: string; // snsId
  c_hash?: string;
  email: string;
  email_verified?: string; // "true"
  is_private_email?: string; // "true"
  auth_time?: number;
  nonce_supported?: boolean; // true
}
interface AppleAuthorization {
  code: string;
  id_token: string;
  state: string;
}
interface AppleUser {
  name: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  email: string;
}
// popup callback data 포맷이 다름
interface ApplePayload {
  authorization: AppleAuthorization;
  user?: AppleUser;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    authorization: { code, id_token, state },
  } = req.body as ApplePayload;
  if (!id_token) {
    return res.status(401).end();
  }
  let flashMsg = null;
  const { iss, aud, sub, email } = jwtDecode(id_token) as Decoded;
  if (iss !== "https://appleid.apple.com") {
    flashMsg = "Unknown issuer or audience";
  } else if (!sub) {
    flashMsg = "Unknown subject of JWT";
  } else if (!email) {
    flashMsg = "Email undefined";
  }
  if (flashMsg) {
    return res.json({
      success: false,
      error: flashMsg,
    });
  }

}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: false })
);
