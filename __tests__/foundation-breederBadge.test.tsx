import { render, screen } from "@testing-library/react";
import {
  BreederProgramBadge,
  BreederProgramBadgeList,
} from "@components/features/breeder/BreederProgramDecorators";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

const program = (
  overrides: Partial<BreederProgramSummary> & Pick<BreederProgramSummary, "id" | "programType">
): BreederProgramSummary => ({
  status: "ACTIVE",
  source: "MANUAL_ADMIN",
  badgeLabel: "",
  frameVariant: "",
  foundingNo: null,
  feeBenefitType: "NONE",
  feeDiscountPercent: null,
  grantedAt: "2026-01-01T00:00:00.000Z",
  revokedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("BreederProgramBadge", () => {
  it("창립 브리더는 번호를 붙여 중립 pill 로 보인다", () => {
    render(
      <BreederProgramBadge
        programs={[program({ id: 1, programType: "FOUNDING_BREEDER", foundingNo: 1 })]}
      />
    );
    const pill = screen.getByText("창립 브리더 No.001");
    expect(pill).toHaveClass("bg-app-surface text-app-muted text-[12px] rounded");
  });

  it("우선순위(창립 → 파트너 → 인증) 순으로 그리고, 해지된 프로그램은 뺀다", () => {
    render(
      <BreederProgramBadge
        programs={[
          program({ id: 3, programType: "VERIFIED_BREEDER" }),
          program({ id: 2, programType: "PARTNER_BREEDER" }),
          program({ id: 4, programType: "FOUNDING_BREEDER", status: "REVOKED", foundingNo: 7 }),
        ]}
      />
    );
    const labels = screen.getAllByText(/브리더/).map((node) => node.textContent);
    expect(labels).toEqual(["파트너 브리더", "인증 브리더"]);
    expect(screen.queryByText(/창립/)).not.toBeInTheDocument();
  });

  it("활성 프로그램이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<BreederProgramBadge programs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("기존 BreederProgramBadgeList 도 같은 중립 pill 이다", () => {
    render(
      <BreederProgramBadgeList
        compact
        programs={[program({ id: 1, programType: "FOUNDING_BREEDER", foundingNo: 12 })]}
      />
    );
    expect(screen.getByText("창립 브리더 No.012")).toHaveClass("bg-app-surface");
  });
});
