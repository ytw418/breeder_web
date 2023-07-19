import axios from "axios";

import { SessionToken } from "./getToken";

export const fileUpload = async (
  file: File,
  token: SessionToken
): Promise<{ data?: { srcKey: string; dstKey: string }; error?: any }> => {
  try {
    const result = await axios({
      headers: {
        authorization: `Bearer ${token}`,
      },
      url: `${
        process.env.NEXT_PUBLIC_API_SERVER_URL
      }/api/get-signed-url?originalname=${encodeURIComponent(file.name)}`,
      method: "GET",
    }).then((res) => res.data);
    const { srcKey, dstKey }: { srcKey: string; dstKey: string } = result.data;

    const uploadResult = await axios.put(result.data.url, file, {
      headers: {
        "Content-Type": file.type, // ex : "Content-Type":"image/jpeg"
      },
    });

    if (uploadResult.status === 200) {
      return {
        data: {
          srcKey,
          dstKey,
        },
      };
    } else {
      return { error: "s3 업로드 실패" };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return { error: error.response.data };
      } else if (error.request) {
        return { error: error.request };
      } else {
        return { error: error.message };
      }
    }
    return { error: error };
  }
};
