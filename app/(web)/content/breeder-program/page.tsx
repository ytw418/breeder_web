import { getFoundingBreederCount } from "@libs/server/breeder-programs";

import BreederProgramClient from "./BreederProgramClient";

export default async function Page() {
  let foundingBreederCount: number | null = null;

  try {
    foundingBreederCount = await getFoundingBreederCount();
  } catch {
    foundingBreederCount = null;
  }

  return <BreederProgramClient foundingBreederCount={foundingBreederCount} />;
}
