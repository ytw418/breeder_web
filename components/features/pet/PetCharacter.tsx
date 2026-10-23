import Image from "next/image";
import type { PetArt } from "@libs/shared/petSpace";

/**
 * 브리디 2D 캐릭터(첫 질문 카드·공간 전환 시트, docs/prd/pet-space.md §4).
 * 시안 design/mockups/pet-space/assets/chibi-*.svg 를 public/images/pets 에 둔 그림. 앱 PetCharacter 와 같은 그림이다.
 */
export function PetCharacter({ art, size, className }: { art: PetArt; size: number; className?: string }) {
  return (
    <Image
      src={`/images/pets/chibi-${art}.svg`}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

export default PetCharacter;
