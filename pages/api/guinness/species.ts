import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import {
  GuinnessSpecies,
  readGuinnessSpecies,
  searchGuinnessSpecies,
} from "@libs/server/guinness-species";

export type { GuinnessSpecies } from "@libs/server/guinness-species";

export interface GuinnessSpeciesListResponse extends ResponseType {
  species?: GuinnessSpecies[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GuinnessSpeciesListResponse>
) {
  if (req.method === "GET") {
    const { q = "", limit = "20", includeUnofficial = "false" } = req.query;

    const all = await readGuinnessSpecies();
    const canIncludeUnofficial = includeUnofficial === "true";
    const visible = all.filter(
      (item) => item.isActive && (canIncludeUnofficial || item.isOfficial)
    );

    const searched = searchGuinnessSpecies(visible, String(q), Number(limit) || 20);
    return res.json({ success: true, species: searched });
  }
}

export default withHandler({
  methods: ["GET"],
  isPrivate: false,
  handler,
});
