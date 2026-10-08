import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { followListHandler } from "@libs/server/followList";

/** GET /api/users/:id/followers?page=&size= — libs/server/followList.ts */
export default withAuth(
  withHandler({
    methods: ["GET"],
    handler: followListHandler("followers"),
    isPrivate: false,
  })
);
