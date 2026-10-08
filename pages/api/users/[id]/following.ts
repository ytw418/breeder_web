import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { followListHandler } from "@libs/server/followList";

/** GET /api/users/:id/following?page=&size= — libs/server/followList.ts */
export default withAuth(
  withHandler({
    methods: ["GET"],
    handler: followListHandler("following"),
    isPrivate: false,
  })
);
