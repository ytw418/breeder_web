import { getFoundingBreederCount } from "@libs/server/breeder-programs";

import BreederProgramClient from "./BreederProgramClient";

export default async function Page() {
  const foundingBreederCount = await getFoundingBreederCount();

  return <BreederProgramClient foundingBreederCount={foundingBreederCount} />;
}
