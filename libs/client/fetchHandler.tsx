import { request, RequestDocument, Variables } from "graphql-request";

import { SessionToken } from "./getToken";

export const fetcher = async ([RequestDocument, variables, token]: [
  RequestDocument,
  Variables,
  SessionToken
]): Promise<any> => {
  if (!RequestDocument) {
    return null;
  }

  const data = await request({
    url: process.env.NEXT_PUBLIC_API_SERVER_URL! + "/graphql",
    document: RequestDocument,
    variables: variables,
    ...(token && {
      requestHeaders: {
        authorization: `Bearer ${token}`,
      },
    }),
  });
  return data;
};
