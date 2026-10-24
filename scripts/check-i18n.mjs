#!/usr/bin/env node
/**
 * 번역 파일 검사(docs/prd/i18n.md AC-7·AC-8). 앱 bredy_app·웹 breeder_web 에 같은 파일을 둔다.
 *
 * 1. 모든 언어의 네임스페이스·키가 한국어(원본)와 같은가
 * 2. 모든 문구가 ICU 문법으로 읽히는가(intl-messageformat)
 * 3. (--other <다른 저장소 경로>) 두 저장소의 번역 파일·언어 규칙 모듈이 바이트까지 같은가
 *
 * 번역 폴더: 앱 src/locales, 웹 locales. 언어 규칙 모듈: 앱 src/lib/i18nLocale.ts, 웹 libs/shared/i18nLocale.ts.
 * 사용: node scripts/check-i18n.mjs [--other ../breeder_web]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";

const SOURCE_LOCALE = "ko";

function layout(root) {
  const app = existsSync(join(root, "src/locales"));
  return {
    locales: join(root, app ? "src/locales" : "locales"),
    rules: join(root, app ? "src/lib/i18nLocale.ts" : "libs/shared/i18nLocale.ts"),
  };
}

function listDirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listJson(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

/** { a: { b: "x" } } → [["a.b", "x"]] */
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) return flatten(value, path);
    return [[path, value]];
  });
}

const errors = [];
const root = process.cwd();
const { locales: localesDir, rules } = layout(root);
const locales = listDirs(localesDir);

if (!locales.includes(SOURCE_LOCALE)) {
  errors.push(`원본 언어 폴더가 없다: ${relative(root, join(localesDir, SOURCE_LOCALE))}`);
} else {
  const namespaces = listJson(join(localesDir, SOURCE_LOCALE));
  for (const locale of locales) {
    const files = listJson(join(localesDir, locale));
    for (const ns of namespaces.filter((n) => !files.includes(n))) errors.push(`${locale}: ${ns} 파일이 없다`);
    for (const ns of files.filter((n) => !namespaces.includes(n))) errors.push(`${locale}: ${ns} 는 ${SOURCE_LOCALE} 에 없는 파일이다`);
  }
  for (const ns of namespaces) {
    const read = (locale) => JSON.parse(readFileSync(join(localesDir, locale, ns), "utf8"));
    const sourceKeys = new Set(flatten(read(SOURCE_LOCALE)).map(([k]) => k));
    for (const locale of locales) {
      const file = join(localesDir, locale, ns);
      if (!existsSync(file)) continue;
      const entries = flatten(read(locale));
      const keys = new Set(entries.map(([k]) => k));
      for (const k of sourceKeys) if (!keys.has(k)) errors.push(`${locale}/${ns}: 키 없음 ${k}`);
      for (const k of keys) if (!sourceKeys.has(k)) errors.push(`${locale}/${ns}: ${SOURCE_LOCALE} 에 없는 키 ${k}`);
      for (const [k, v] of entries) {
        if (typeof v !== "string" || v.trim() === "") {
          errors.push(`${locale}/${ns}: ${k} 값이 빈 문자열이거나 문자열이 아니다`);
          continue;
        }
        try {
          new IntlMessageFormat(v, locale);
        } catch (e) {
          errors.push(`${locale}/${ns}: ${k} ICU 문법 오류 — ${e.message}`);
        }
      }
    }
  }
}

const otherIndex = process.argv.indexOf("--other");
if (otherIndex !== -1) {
  const otherRoot = resolve(process.argv[otherIndex + 1] ?? "");
  const other = layout(otherRoot);
  if (!existsSync(other.locales)) {
    errors.push(`--other 경로에 번역 폴더가 없다: ${other.locales}`);
  } else {
    const same = (a, b, label) => {
      if (!existsSync(b)) return errors.push(`사본 없음: ${label}`);
      if (readFileSync(a, "utf8") !== readFileSync(b, "utf8")) errors.push(`사본이 다르다: ${label}`);
    };
    same(rules, other.rules, "i18nLocale.ts");
    const otherLocales = listDirs(other.locales);
    for (const locale of new Set([...locales, ...otherLocales])) {
      const mine = existsSync(join(localesDir, locale)) ? listJson(join(localesDir, locale)) : [];
      const theirs = existsSync(join(other.locales, locale)) ? listJson(join(other.locales, locale)) : [];
      for (const ns of new Set([...mine, ...theirs])) {
        same(join(localesDir, locale, ns), join(other.locales, locale, ns), `${locale}/${ns}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`번역 파일 검사 실패(${errors.length}건):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`번역 파일 검사 통과: 언어 ${locales.join("·")}${otherIndex !== -1 ? ", 사본 일치" : ""}`);
