import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "GET") {
    const {
      query: { page = 1 },
    } = req;

    // const parsedLatitude = parseFloat(latitude.toString());
    // const parsedLongitude = parseFloat(longitude.toString());

    const posts = await client.post.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            Likes: true,
          },
        },
      },
      take: 10,
      skip: page ? (+page - 1) * 10 : 0,
      // where: {
      //   latitude: {
      //     gte: parsedLatitude - 0.01,
      //     lte: parsedLatitude + 0.01,
      //   },
      //   longitude: {
      //     gte: parsedLongitude - 0.01,
      //     lte: parsedLongitude + 0.01,
      //   },
      // },
    });
    const postCount = await client.product.count();

    res.json({
      success: true,
      posts,
      pages: Math.ceil(postCount / 10),
    });
  }
  if (req.method === "POST") {
    const {
      body: { description, title, image, latitude, longitude },
      session: { user },
    } = req;

    const post = await client.post.create({
      data: {
        title,
        image,
        description,
        latitude,
        longitude,
        user: {
          connect: {
            id: user?.id,
          },
        },
      },
    });
    try {
      // await res.revalidate("/community");
      // FIXME: 재검증 로직 나중에 확인
      return res.json({ success: true, post });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, error });
    }
  }
};

export default withApiSession(
  withHandler({ methods: ["POST", "GET"], isPrivate: false, handler })
);
