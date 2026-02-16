#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const input = process.argv[2];
const issueArg = process.argv.find((arg) => arg.startsWith("--issue="))?.split("=")[1];
const issueNumber = Number(input || issueArg);

const run = (command, args, options = {}) => {
  return execFileSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...options,
  }).trim();
};

const runInherit = (command, args, options = {}) => {
  return execFileSync(command, args, {
    stdio: "inherit",
    encoding: "utf8",
    ...options,
  });
};

const hasCommand = (command) => {
  try {
    execSync(`command -v ${command}`, { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
};

const showUsage = () => {
  console.log("Usage: node scripts/issue-auto-pr.mjs <issue-number>");
  console.log("예: node scripts/issue-auto-pr.mjs 123");
  process.exit(1);
};

if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  showUsage();
}

if (!hasCommand("gh")) {
  console.error("gh CLI가 필요합니다. gh가 설치되어 있지 않거나 PATH에 없습니다.");
  process.exit(1);
}

const ensureCleanWorkingTree = () => {
  const status = run("git", ["status", "--short", "--porcelain"]);
  if (status) {
    console.error("현재 작업 트리가 깨끗하지 않습니다. 다음 명령으로 저장 후 실행하세요.");
    console.error("git status");
    process.exit(1);
  }
};

const slugify = (text) => {
  return (
    text
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 45) || ""
  );
};

const ensureIssueDraft = () => {
  const issue = JSON.parse(
    run("gh", [
      "issue",
      "view",
      String(issueNumber),
      "--json",
      "title,body,state,url,labels,assignees,author",
    ])
  );

  if (issue.state !== "OPEN") {
    console.error("해당 이슈가 OPEN 상태가 아닙니다.");
    process.exit(1);
  }

  const labelString = issue.labels?.length
    ? issue.labels.map((entry) => (typeof entry === "string" ? entry : entry.name)).join(", ")
    : "없음";
  const assignees = issue.assignees?.map((entry) => entry.login).join(", ") || "없음";

  ensureCleanWorkingTree();
  runInherit("git", ["fetch", "origin"]);
  runInherit("git", ["checkout", "main"]);
  runInherit("git", ["pull", "origin", "main"]);

  const slug = slugify(issue.title) || `issue-${issue.number}`;
  const branchName = `codex/issue-${issue.number}-${slug}`;

  try {
    run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]);
    runInherit("git", ["checkout", branchName]);
  } catch {
    runInherit("git", ["checkout", "-b", branchName, "origin/main"]);
  }

  const draftDir = ".github/issue-auto-pr";
  const draftFilePath = path.join(draftDir, `issue-${issue.number}.md`);
  const draftTitle = issue.title?.trim() || "(제목 없음)";
  const bodyText = issue.body ? issue.body.trim() : "";
  const excerpt =
    bodyText.length > 8000 ? `${bodyText.slice(0, 8000)}\n\n... (이슈 본문은 생략됨)` : bodyText;

  const draftContent = [
    `# ${issue.title}`,
    "",
    `- 이슈 번호: #${issue.number}`,
    `- URL: ${issue.url}`,
    `- 작성자: ${issue.author?.login || "unknown"}`,
    `- 담당자: ${assignees}`,
    `- 라벨: ${labelString}`,
    "",
    "## 작업 메모",
    "- [ ] 코드 수정",
    "- [ ] 빌드/테스트 실행",
    "- [ ] 동작 확인",
    "",
    "## 원본 이슈 본문",
    "```text",
    `${excerpt || "_본문 없음_"}`
    ,
    "```",
    "",
    "### TODO",
    "- PR 템플릿: 본 파일을 참고해 작업 내역을 작성하고 업데이트하세요.",
  ].join("\n");

  mkdirSync(draftDir, { recursive: true });
  writeFileSync(draftFilePath, `${draftContent}\n`);

  const draftChanged = run("git", ["status", "--short", "--porcelain", draftFilePath]);
  if (draftChanged) {
    runInherit("git", ["add", draftFilePath]);
    runInherit("git", ["commit", "-m", `chore: issue #${issue.number} 작업 브랜치 초기화`]);
  } else {
    console.log("브랜치 스케치 파일이 이미 존재해 변경사항이 없습니다.");
  }

  runInherit("git", ["push", "-u", "origin", branchName]);

  const openedPrs = JSON.parse(
    run("gh", ["pr", "list", "--state", "open", "--head", branchName, "--json", "number,url"])
  );
  if (openedPrs.length > 0) {
    const currentPr = openedPrs[0];
    console.log(`이미 열린 PR이 존재합니다: ${currentPr.url}`);
    return;
  }

  const shortTitle = draftTitle.length > 60 ? `${draftTitle.slice(0, 57)}...` : draftTitle;
  const prTitle = `chore: #${issue.number} ${shortTitle}`;
  const prBody = [
    `이슈 #${issue.number} 자동 부트스트랩`,
    "",
    "## Summary",
    `- 이슈: ${issue.url}`,
    `- 라벨: ${labelString}`,
    "",
    "## Work Notes",
    "- [ ] 코드 수정",
    "- [ ] 테스트/검증",
    "- [ ] 코드 리뷰",
    "",
    "이 PR은 해당 이슈를 기준으로 생성된 작업 브랜치입니다.",
    `Closes #${issue.number}`,
    "",
    "초기 작업 파일: `.github/issue-auto-pr/issue-${issue.number}.md`",
  ].join("\n");

  const bodyFile = path.join(os.tmpdir(), `issue-${issue.number}-pr-body.md`);
  writeFileSync(bodyFile, `${prBody}\n`, { encoding: "utf8" });

  const createOutput = run("gh", [
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branchName,
    "--title",
    prTitle,
    "--body-file",
    bodyFile,
    "--draft",
  ]);
  console.log(createOutput);
  const prUrl =
    createOutput && createOutput.includes("https://")
      ? createOutput.split("\n").find((line) => line.includes("https://"))
      : run("gh", ["pr", "view", branchName, "--json", "url", "--jq", ".url"]);

  console.log("자동화 완료:");
  console.log(`- 브랜치: ${branchName}`);
  console.log(`- PR: ${prUrl}`);
  if (createOutput) {
    console.log("원문 이슈 기반 작업 노트가 생성되어 PR 템플릿으로 사용 가능합니다.");
  }
};

try {
  ensureIssueDraft();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
