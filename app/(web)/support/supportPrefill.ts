// 고객의 소리 쿼리 프리필(앱 src/app/support/index.tsx 와 같은 규칙).
// /support?type=FEATURE_REQUEST&title=..&description=..&contactEmail=..

export type VoiceType = "BUG_REPORT" | "FEATURE_REQUEST" | "DEV_TEAM_REQUEST";

export const VOICE_TYPES: readonly VoiceType[] = [
  "BUG_REPORT",
  "FEATURE_REQUEST",
  "DEV_TEAM_REQUEST",
];

export interface SupportPrefill {
  type: VoiceType;
  title: string;
  description: string;
  contactEmail: string;
}

export const EMPTY_SUPPORT_PREFILL: SupportPrefill = {
  type: "BUG_REPORT",
  title: "",
  description: "",
  contactEmail: "",
};

type ParamReader = { get(name: string): string | null } | null | undefined;

export function parseSupportPrefill(params: ParamReader): SupportPrefill {
  const read = (name: string) => params?.get(name) ?? "";
  const rawType = read("type");
  const type = (VOICE_TYPES as readonly string[]).includes(rawType)
    ? (rawType as VoiceType)
    : "BUG_REPORT";
  return {
    type,
    title: read("title"),
    description: read("description"),
    contactEmail: read("contactEmail").trim(),
  };
}

/** 프리필이 바뀌면 폼을 다시 그리기 위한 키. */
export function supportPrefillKey(prefill: SupportPrefill): string {
  return [
    prefill.type,
    prefill.title,
    prefill.description,
    prefill.contactEmail,
  ].join("\u001f");
}
