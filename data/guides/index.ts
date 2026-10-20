import type { SpeciesGuide } from "@libs/shared/guides";
import crestedGecko from "./crested-gecko.json";

/**
 * 종별 사육 가이드 본문(앱 docs/prd/species-guide.md). 파일을 추가하면 여기와 manifest.ts 에 한 줄씩 더한다.
 * 정적 import 라 Vercel 번들에 들어간다. 클라이언트 컴포넌트는 본문이 큰 이 파일 대신 manifest.ts 를 쓴다.
 */
export const GUIDES: readonly SpeciesGuide[] = [crestedGecko as SpeciesGuide];
