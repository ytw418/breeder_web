// 스레드 영업 도구(2026-10-19). 브리디 자동화 크롬(CDP 9222)의 '자기 탭'에서 돈다. 규칙: docs/operations/threads-outreach.md
//   node scripts/marketing/threads-outreach.mjs find "크레스티드게코,구피" out.json   최근 글 모으기(이미 연락한 사람 제외)
//   node scripts/marketing/threads-outreach.mjs run plan.json                        댓글·DM 보내기
//   node scripts/marketing/threads-outreach.mjs post <글 파일> [주제] [--dry-run]     내 글 올리기(마지막 줄에 글 주소 출력)
//   node scripts/marketing/threads-outreach.mjs selfreply <내 글 URL> "<댓글>"       내 글 첫 댓글(링크 허용)
//   node scripts/marketing/threads-outreach.mjs requests <답장 파일>                들어온 DM 요청 수락 → 답장
// plan.json: [{"kind":"comment","href":"/@a/post/X","text":"…"}, {"kind":"dm","handle":"a","text":"…"}]
// - 남의 글 댓글·DM 에는 링크를 넣지 않는다(맞팔 아닌 사람에게 가는 메시지 요청은 링크·미디어 불가, 댓글 링크는 반응이 적다). 링크가 있으면 거부.
// - 21시~8시엔 멈춘다. 하루 상한 THREADS_DM_DAILY(기본 20)·THREADS_COMMENT_DAILY(기본 20). 동작 사이 고정 간격(댓글 60초, DM 90초).
// - 보낸 뒤 다시 열어 남아 있는지 확인한다. 기록·대기열: ~/Documents/bredy-outreach/threads/(저장소에 올리지 않는다).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ME = "bredy_breeder";
const DIR = path.join(os.homedir(), "Documents/bredy-outreach/threads");
const LOG = path.join(DIR, "log.tsv");
const DM_DAILY = Number(process.env.THREADS_DM_DAILY || 20);
const COMMENT_DAILY = Number(process.env.THREADS_COMMENT_DAILY || 20);
const GAP = { comment: 60_000, dm: 90_000 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kst = () => new Date(Date.now() + 9 * 3600_000);
const today = () => kst().toISOString().slice(0, 10);
const quiet = () => kst().getUTCHours() >= 21 || kst().getUTCHours() < 8;

fs.mkdirSync(DIR, { recursive: true });
const readLog = () =>
  fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => l.split("\t")) : [];
const contacted = () => new Set(readLog().filter((r) => r[4] === "ok").map((r) => r[3]));
const sentToday = (kind) => readLog().filter((r) => r[0] === today() && r[2] === kind && r[4] === "ok").length;
function log(kind, handle, result, url) {
  const row = [today(), kst().toISOString().slice(11, 16), kind, handle, result, url];
  fs.appendFileSync(LOG, row.join("\t") + "\n");
  console.log(row.slice(2).join("\t"));
}

// 같은 사이트 작업은 잠금으로 차례대로(bpw.py 와 같은 규칙)
const LOCK = "/tmp/bredy-chrome-locks/threads";
function lock() {
  execFileSync(path.join(os.homedir(), ".local/bin/bredy-chrome"));
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      return;
    } catch {
      try {
        if (Date.now() - fs.statSync(LOCK).mtimeMs > 1_800_000) fs.rmSync(LOCK, { recursive: true, force: true });
      } catch {}
      execFileSync("sleep", ["2"]);
    }
  }
}
const unlock = () => fs.rmSync(LOCK, { recursive: true, force: true });

async function open() {
  lock();
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = await browser.contexts()[0].newPage();
  // 같은 크롬의 스레드에 다른 계정(예: 개인 lcaros_rn)이 로그인돼 있을 수 있다(10-20) → 내 계정이 아니면 아무것도 하지 않는다
  await page.goto("https://www.threads.com/");
  await sleep(5000);
  const who = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/@"]')].find((a) => a.querySelector('svg[aria-label="프로필"]'))?.getAttribute("href")?.slice(2) || "",
  );
  if (who !== ME) {
    await page.close().catch(() => {});
    unlock();
    throw new Error(`스레드 로그인 계정이 ${who || "없음"} — ${ME} 가 아니라서 멈춤`);
  }
  const done = async () => {
    await page.close().catch(() => {});
    unlock();
  };
  process.on("SIGINT", async () => {
    await done();
    process.exit(130);
  });
  return { page, done };
}

// 여러 줄은 Shift+Enter 로 줄바꿈(한글·이모지는 insertText)
async function typeLines(page, text) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) await page.keyboard.insertText(lines[i]);
    if (i < lines.length - 1) await page.keyboard.press("Shift+Enter");
  }
}
// 확인용 글귀: 첫 이모지 앞까지(스레드는 이모지를 이미지로 바꿔 보여 줄 수 있다)
const probe = (text) => text.split("\n").find((l) => l.trim()).split(/\p{Extended_Pictographic}/u)[0].trim().slice(0, 18);
const bodyHas = (page, s) => page.evaluate((s) => document.body.innerText.includes(s), s);

async function find(queries, out) {
  const { page, done } = await open();
  const seen = contacted();
  const posts = new Map();
  try {
    for (const q of queries) {
      await page.goto(`https://www.threads.com/search?q=${encodeURIComponent(q)}&serp_type=default&filter=recent`);
      await sleep(6000);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 3000);
        await sleep(1500);
      }
      const found = await page.evaluate(() =>
        [...new Set([...document.querySelectorAll('a[href*="/post/"]')].map((a) => a.getAttribute("href").split("/media")[0]))].map((h) => {
          let c = document.querySelector(`a[href="${h}"]`);
          for (let i = 0; i < 8 && c; i++) c = c.parentElement;
          return { href: h, text: c ? c.innerText.replace(/\n/g, " / ").slice(0, 240) : "" };
        }),
      );
      for (const p of found) {
        const handle = p.href.split("/")[1].slice(1);
        if (handle === ME || seen.has(handle) || posts.has(p.href)) continue;
        posts.set(p.href, { query: q, handle, ...p });
      }
    }
  } finally {
    await done();
  }
  fs.writeFileSync(out, JSON.stringify([...posts.values()], null, 1));
  console.log(`${posts.size}개 → ${out}`);
}

async function comment(page, it) {
  const url = "https://www.threads.com" + it.href;
  await page.goto(url);
  await sleep(5000);
  if (await bodyHas(page, probe(it.text))) return "이미 있음";
  const box = page.locator('[contenteditable=true][aria-placeholder$="답글 남기기..."]').first();
  if (!(await box.count())) return "입력칸 없음";
  await box.click();
  await typeLines(page, it.text);
  await sleep(1500);
  // 보내기 = 입력칸 뒤에 나오는 첫 '답글' 아이콘 버튼(글 아래 '답글 N' 버튼은 입력칸 앞에 있다)
  const sent = await page.evaluate(() => {
    const box = document.querySelector('[contenteditable=true][aria-placeholder$="답글 남기기..."]');
    const btn = [...document.querySelectorAll('[role=button]')].find(
      (b) => b.querySelector('svg[aria-label="답글"]') && box.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!sent) return "보내기 버튼 없음";
  await sleep(5000);
  // 답글 많은 인기 글은 다시 열어도 내 댓글이 위에 안 보인다 → 내 '답글' 탭에서 확인
  await page.goto(it.verify || `https://www.threads.com/@${ME}/replies`);
  await sleep(6000);
  return (await bodyHas(page, probe(it.text))) ? "ok" : "확인 안 됨";
}

async function dm(page, it) {
  await page.goto(`https://www.threads.com/@${it.handle}`);
  await sleep(5000);
  const btn = page.getByRole("button", { name: "메시지 보내기", exact: true });
  if (!(await btn.count())) return "메시지 버튼 없음";
  await btn.first().click();
  await page.waitForURL(/\/messages\/t\//, { timeout: 15000 }).catch(() => {});
  await sleep(4000);
  const thread = page.url();
  if (!/\/messages\/t\//.test(thread)) return "대화창 안 열림";
  if ((await bodyHas(page, "혼자 만들고")) || (await bodyHas(page, probe(it.text)))) return "이미 대화 있음";
  const box = page.locator("[contenteditable=true]").last();
  if (!(await box.count())) return "입력칸 없음";
  await box.click();
  await typeLines(page, it.text);
  await sleep(1000);
  await page.keyboard.press("Enter");
  await sleep(5000);
  await page.goto(thread);
  await sleep(6000);
  return (await bodyHas(page, probe(it.text))) ? "ok" : "확인 안 됨";
}

async function run(planFile) {
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const bad = plan.filter((p) => /https?:\/\/|bredy\.app|www\./i.test(p.text));
  if (bad.length) throw new Error(`링크가 든 항목 ${bad.length}개 — 스레드에는 링크를 넣지 않는다`);
  const { page, done } = await open();
  const seen = contacted();
  try {
    for (const it of plan) {
      if (quiet()) {
        console.log("21시~8시라 멈춤");
        break;
      }
      const handle = it.handle || it.href.split("/")[1].slice(1);
      const cap = it.kind === "dm" ? DM_DAILY : COMMENT_DAILY;
      if (sentToday(it.kind) >= cap) {
        log(it.kind, handle, `오늘 상한 ${cap}`, "");
        continue;
      }
      if (it.kind === "dm" && seen.has(handle) && readLog().some((r) => r[2] === "dm" && r[3] === handle && r[4] === "ok")) {
        log("dm", handle, "이미 DM 보냄", "");
        continue;
      }
      if (it.kind === "comment" && readLog().some((r) => r[2] === "comment" && r[4] === "ok" && r[5].endsWith(it.href))) {
        log("comment", handle, "이미 댓글 남김", "");
        continue;
      }
      let res;
      try {
        res = it.kind === "dm" ? await dm(page, it) : await comment(page, it);
      } catch (e) {
        res = "오류: " + String(e.message).split("\n")[0].slice(0, 80);
      }
      log(it.kind, handle, res, it.kind === "dm" ? page.url() : "https://www.threads.com" + it.href);
      await sleep(GAP[it.kind] || 60_000);
    }
  } finally {
    await done();
  }
}

// 내 글 올리기: 홈 '새로운 소식을 공유해보세요' → 본문 → 주제(선택) → 게시 → 프로필에서 첫 줄로 글 주소 찾기
async function post(file, topic, dryRun) {
  const text = fs.readFileSync(file, "utf8").trim();
  const { page, done } = await open();
  try {
    await page.goto("https://www.threads.com/");
    await sleep(5000);
    await page.getByText("새로운 소식을 공유해보세요", { exact: false }).first().click();
    await sleep(2500);
    const dialog = page.getByRole("dialog").last();
    await dialog.locator("[contenteditable=true]").first().click();
    await typeLines(page, text);
    await sleep(1000);
    if (topic) {
      const search = dialog.getByRole("searchbox", { name: "커뮤니티 또는 주제" });
      if (await search.count()) {
        await search.first().click();
        await page.keyboard.insertText(topic);
        await sleep(3000);
        const exact = page.getByRole("option", { name: topic, exact: true });
        const opt = (await exact.count()) ? exact.first() : page.getByRole("option").first();
        if (await opt.count()) await opt.click();
        else console.log("주제 없음: " + topic);
        await sleep(1000);
      } else console.log("주제 칸 없음: " + topic);
    }
    const publish = dialog.getByRole("button", { name: "게시", exact: true }).last();
    if (!(await publish.count())) return console.log("게시 버튼 없음");
    if (dryRun) return console.log("dry-run: 게시 직전까지 확인함(올리지 않음)");
    await publish.click();
    await sleep(8000);
    await page.goto(`https://www.threads.com/@${ME}`);
    await sleep(6000);
    const first = probe(text);
    const url = await page.evaluate((first) => {
      for (const a of document.querySelectorAll('a[href*="/post/"]')) {
        let c = a;
        for (let i = 0; i < 8 && c; i++) c = c.parentElement;
        if (c && c.innerText.includes(first)) return a.href.split("/media")[0];
      }
      return "";
    }, first);
    console.log(url ? `ok ${url}` : "확인 안 됨");
  } finally {
    await done();
  }
}

// 내 글에 링크 첫 댓글(내 글이라 링크 허용)
async function selfReply(postUrl, text) {
  const { page, done } = await open();
  try {
    const href = new URL(postUrl).pathname;
    log("selfreply", ME, await comment(page, { href, text, verify: postUrl }), postUrl);
  } finally {
    await done();
  }
}

// 들어온 메시지 요청(맞팔 아닌 사람이 먼저 보낸 DM): 수락 → 답장(수락하면 일반 대화라 링크 가능). 받은 메시지함 대화는 건드리지 않는다.
async function requests(replyText) {
  const { page, done } = await open();
  const answered = new Set(readLog().filter((r) => r[2] === "request" && r[4] === "ok").map((r) => r[5]));
  try {
    await page.goto("https://www.threads.com/messages/requests");
    await sleep(6000);
    const threads = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('a[href*="/messages/t/"]')].map((a) => a.href))],
    );
    if (!threads.length) console.log("새 요청 없음");
    for (const t of threads) {
      if (answered.has(t)) continue;
      await page.goto(t);
      await sleep(5000);
      const handle = await page.evaluate(
        (me) => [...document.querySelectorAll('a[href^="/@"]')].map((a) => a.getAttribute("href").slice(2).split("/")[0]).find((h) => h && h !== me) || "",
        ME,
      );
      const accept = page.getByRole("button", { name: /^(수락|Accept)$/ });
      if (await accept.count()) {
        await accept.first().click();
        await sleep(4000);
      }
      const box = page.locator("[contenteditable=true]").last();
      if (!(await box.count())) {
        log("request", handle, "입력칸 없음", t);
        continue;
      }
      await box.click();
      await typeLines(page, replyText);
      await sleep(1000);
      await page.keyboard.press("Enter");
      await sleep(5000);
      await page.goto(t);
      await sleep(6000);
      log("request", handle, (await bodyHas(page, probe(replyText))) ? "ok" : "확인 안 됨", t);
      await sleep(20_000);
    }
  } finally {
    await done();
  }
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "find") await find(a.split(",").map((s) => s.trim()).filter(Boolean), b || "/tmp/threads-find.json");
else if (cmd === "run") await run(a);
else if (cmd === "post") await post(a, b && !b.startsWith("--") ? b : "", process.argv.includes("--dry-run"));
else if (cmd === "selfreply") await selfReply(a, b);
else if (cmd === "requests") await requests(fs.readFileSync(a, "utf8").trim());
else console.log("사용: find <검색어,…> <out.json> | run <plan.json> | post <글 파일> [주제] [--dry-run] | selfreply <내 글 URL> <댓글> | requests <답장 파일>");
process.exit(0);
