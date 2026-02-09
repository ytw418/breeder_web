import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { hasAdminAccess } from "./_utils";
import {
  GuinnessSpecies,
  buildAliasesFromText,
  findGuinnessSpeciesMatch,
  isValidSpeciesName,
  normalizeSpeciesText,
} from "@libs/server/guinness-species";
import client from "@libs/server/client";

interface AdminGuinnessSpeciesResponse extends ResponseType {
  species?: GuinnessSpecies[];
  speciesItem?: GuinnessSpecies;
}

const sortSpecies = (items: GuinnessSpecies[]) =>
  [...items].sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? 1 : -1;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminGuinnessSpeciesResponse>
) {
  const {
    session: { user },
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const { q = "" } = req.query;
    const keyword = normalizeSpeciesText(String(q || ""));

    const all = await client.guinnessSpecies.findMany();
    const filtered = keyword
      ? all.filter((item) => {
          const nameMatched = normalizeSpeciesText(item.name).includes(keyword);
          const aliasMatched = item.aliases.some((alias) =>
            normalizeSpeciesText(alias).includes(keyword)
          );
          return nameMatched || aliasMatched;
        })
      : all;

    return res.json({ success: true, species: sortSpecies(filtered) });
  }

  if (req.method === "POST") {
    const { action } = req.body;
    const all = await client.guinnessSpecies.findMany();

    if (action === "create") {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res
          .status(400)
          .json({ success: false, error: "종명을 입력해주세요." });
      }
      if (!isValidSpeciesName(name)) {
        return res.status(400).json({
          success: false,
          error: "종명은 한글만 2~30자로 입력해주세요.",
        });
      }

      const exists = findGuinnessSpeciesMatch(all, name);
      if (exists) {
        return res.status(400).json({
          success: false,
          error: "이미 등록된 종명/별칭입니다. 기존 데이터를 수정해주세요.",
        });
      }

      const aliases = buildAliasesFromText(String(req.body.aliases || "")).filter(
        (alias) => normalizeSpeciesText(alias) !== normalizeSpeciesText(name)
      );
      const created = await client.guinnessSpecies.create({
        data: {
          name,
          aliases,
          isActive: true,
          isOfficial: true,
        },
      });

      const nextItems = await client.guinnessSpecies.findMany();
      return res.json({
        success: true,
        speciesItem: created,
        species: sortSpecies(nextItems),
      });
    }

    if (action === "approve") {
      const id = Number(req.body.id);
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "승인할 종 id가 필요합니다." });
      }

      const target = await client.guinnessSpecies.findUnique({ where: { id } });
      if (!target) {
        return res
          .status(404)
          .json({ success: false, error: "대상을 찾을 수 없습니다." });
      }

      const updatedItem = await client.guinnessSpecies.update({
        where: { id },
        data: {
          isOfficial: true,
          isActive: true,
        },
      });
      const nextItems = await client.guinnessSpecies.findMany();
      return res.json({
        success: true,
        speciesItem: updatedItem,
        species: sortSpecies(nextItems),
      });
    }

    if (action === "toggle-active") {
      const id = Number(req.body.id);
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "수정할 종 id가 필요합니다." });
      }

      const target = await client.guinnessSpecies.findUnique({ where: { id } });
      if (!target) {
        return res
          .status(404)
          .json({ success: false, error: "대상을 찾을 수 없습니다." });
      }

      const updatedItem = await client.guinnessSpecies.update({
        where: { id },
        data: {
          isActive: !target.isActive,
        },
      });

      const nextItems = await client.guinnessSpecies.findMany();
      return res.json({
        success: true,
        speciesItem: updatedItem,
        species: sortSpecies(nextItems),
      });
    }

    if (action === "update") {
      const id = Number(req.body.id);
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "수정할 종 id가 필요합니다." });
      }

      const nextName = String(req.body.name || "").trim();
      const aliasesInput = req.body.aliases;
      const hasNameInput = Boolean(nextName);
      const hasAliasesInput = aliasesInput !== undefined;

      if (!hasNameInput && !hasAliasesInput) {
        return res
          .status(400)
          .json({ success: false, error: "수정할 값이 없습니다." });
      }

      if (hasNameInput) {
        if (!isValidSpeciesName(nextName)) {
          return res.status(400).json({
            success: false,
            error: "종명은 한글만 2~30자로 입력해주세요.",
          });
        }
        const conflict = all.find((item) => {
          if (item.id === id) return false;
          const exact = normalizeSpeciesText(item.name) === normalizeSpeciesText(nextName);
          const alias = item.aliases.some(
            (entry) => normalizeSpeciesText(entry) === normalizeSpeciesText(nextName)
          );
          return exact || alias;
        });
        if (conflict) {
          return res.status(400).json({
            success: false,
            error: "같은 이름/별칭을 가진 종이 이미 존재합니다.",
          });
        }
      }

      const current = await client.guinnessSpecies.findUnique({ where: { id } });
      if (!current) {
        return res
          .status(404)
          .json({ success: false, error: "대상을 찾을 수 없습니다." });
      }

      const name = hasNameInput ? nextName : current.name;
      const aliases = hasAliasesInput
        ? buildAliasesFromText(String(aliasesInput || ""))
            .filter(
              (alias) => normalizeSpeciesText(alias) !== normalizeSpeciesText(name)
            )
            .filter((alias, index, array) => array.indexOf(alias) === index)
        : current.aliases;

      const updatedItem = await client.guinnessSpecies.update({
        where: { id },
        data: {
          name,
          aliases,
        },
      });

      const nextItems = await client.guinnessSpecies.findMany();
      return res.json({
        success: true,
        speciesItem: updatedItem || undefined,
        species: sortSpecies(nextItems),
      });
    }

    return res
      .status(400)
      .json({ success: false, error: "지원하지 않는 action 입니다." });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
