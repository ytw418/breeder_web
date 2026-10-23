import fs from "fs";
import path from "path";

import { DEAL_TYPES } from "@libs/shared/categories";

/**
 * Product.dealType 은 DB CHECK(Product_dealType_check)로도 막는다. 코드의 DEAL_TYPES 에 값을 더하고
 * CHECK 를 넓히는 마이그레이션을 빠뜨리면 그 거래 유형 글 저장이 운영에서 500 으로 깨진다(2026-10-23 임보 구해요 foster).
 */
describe("Product.dealType DB CHECK", () => {
  it("마지막 마이그레이션의 CHECK 가 DEAL_TYPES 를 모두 받는다", () => {
    const dir = path.join(process.cwd(), "prisma/migrations");
    const definitions = fs
      .readdirSync(dir)
      .sort()
      .flatMap((name) => {
        const file = path.join(dir, name, "migration.sql");
        if (!fs.existsSync(file)) return [];
        const sql = fs.readFileSync(file, "utf8");
        const match = sql.match(/ADD CONSTRAINT "Product_dealType_check"\s+CHECK \("dealType" IN \(([^)]*)\)\)/);
        return match ? [match[1]] : [];
      });
    expect(definitions.length).toBeGreaterThan(0);
    const allowed = definitions[definitions.length - 1].split(",").map((value) => value.trim().replace(/'/g, ""));
    expect([...allowed].sort()).toEqual([...DEAL_TYPES].sort());
  });
});
