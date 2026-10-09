#!/usr/bin/env python3
"""
PR 스크린샷 하네스 — Claude Code 훅(PreToolUse: Bash, Desktop Commander start_process).

2026-10-09 사용자 요청: "PR 생성할 때랑 작업 다 했다고 보고할 때 스크린샷을 보여주고 PR 에 넣어줘.
어떻게 생긴 건지 보고 머지하게."

`gh pr create` 와 본문을 바꾸는 `gh pr edit`(--body/-b/--body-file/-F) 의 본문에
이미지(`![캡션](주소)`·`<img`)도, `스크린샷 없음 — <이유>` 줄도 없으면 막는다(deny).
본문은 명령 문자열(--body "...", heredoc)과 --body-file/-F 파일에서 찾는다. `--web` 은 브라우저에서 쓰므로 통과시킨다.

캡처 올리기: scripts/pr-screenshots.sh. 규칙: AGENTS.md 'PR·완료 보고 스크린샷'.
사본: bredy_app·breeder_web 의 .claude/hooks/pr-guard.py(같은 내용으로 유지한다). 테스트: pr-guard_test.py.
"""
import json
import os
import re
import shlex
import sys

PR_CREATE = re.compile(r"\bgh\s+pr\s+create\b")
PR_EDIT = re.compile(r"\bgh\s+pr\s+edit\b")
BODY_FLAG = re.compile(r"(?:^|\s)(?:--body(?:-file)?|-b|-F)(?:[\s=]|$)")
WEB_FLAG = re.compile(r"(?:^|\s)(?:--web|-w)(?:\s|$)")
EVIDENCE = re.compile(r"!\[[^\]\n]*\]\(\s*[^\s)]+|<img\b|스크린샷\s*없음")
CD = re.compile(r"(?:^|[;&|(\n])\s*cd\s+(\"[^\"]+\"|'[^']+'|[^\s;&|)]+)")
CAT = re.compile(r"\$\(\s*cat\s+(\"[^\"]+\"|'[^']+'|[^\s)]+)\s*\)")


def body_files(command: str):
    """--body-file/-F 로 넘긴 파일과 --body "$(cat 파일)" 의 파일 경로들."""
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        tokens = command.split()
    paths = []
    for index, token in enumerate(tokens):
        if token in ("--body-file", "-F") and index + 1 < len(tokens):
            paths.append(tokens[index + 1])
        elif token.startswith("--body-file="):
            paths.append(token.split("=", 1)[1])
    paths += [match.strip("\"'") for match in CAT.findall(command)]
    return [path for path in paths if path != "-"]


def read_body_file(path: str, cwd: str, command: str) -> str:
    bases = [cwd] + [os.path.join(cwd, os.path.expanduser(m.strip("\"'"))) for m in CD.findall(command)]
    for base in bases:
        full = os.path.join(base, os.path.expanduser(path))
        if os.path.isfile(full):
            try:
                with open(full, encoding="utf-8", errors="replace") as handle:
                    return handle.read()
            except OSError:
                return ""
    return ""


def check(command: str, cwd: str):
    """막아야 하면 이유 문자열, 아니면 None."""
    creating = bool(PR_CREATE.search(command))
    editing = bool(PR_EDIT.search(command)) and bool(BODY_FLAG.search(command))
    if not (creating or editing):
        return None
    if creating and WEB_FLAG.search(command):
        return None
    if EVIDENCE.search(command):
        return None
    for path in body_files(command):
        if EVIDENCE.search(read_body_file(path, cwd, command)):
            return None
    action = "PR 을 만들" if creating else "PR 본문을 바꿀"
    return (
        f"{action} 때는 본문에 화면 스크린샷을 넣는다. 사용자가 PR 에서 화면을 보고 머지한다. "
        "① 바뀐 화면을 캡처한다(앱: 에뮬레이터 adb exec-out screencap -p, 웹: Playwright 모바일 뷰포트). "
        "Read 로 직접 열어 의도한 화면인지 확인한다. "
        "② scripts/pr-screenshots.sh <파일...> 로 ytw418/pr-assets 에 올린다. "
        "③ 찍힌 <img> 줄을 본문 '## 스크린샷' 표에 넣는다. 앱·웹을 같이 바꿨으면 한 행에 앱 | 웹을 둔다. "
        "릴리스 PR(dev→main)은 포함 PR 의 이미지 줄을 모아 넣는다. "
        "화면 변화가 없거나(API·훅·문서) 캡처할 수 없으면 본문에 '스크린샷 없음 — <이유>' 한 줄을 넣는다. "
        "완료 보고에도 같은 이미지(![캡션](URL))를 보여 준다."
    )


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"[PR 스크린샷 하네스] {reason} (규칙: AGENTS.md 'PR·완료 보고 스크린샷')",
        }
    }, ensure_ascii=False))
    sys.exit(0)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # 입력을 못 읽으면 막지 않는다
    tool_input = payload.get("tool_input") or {}
    command = str(tool_input.get("command", ""))
    cwd = str(tool_input.get("cwd") or payload.get("cwd") or os.getcwd())
    reason = check(command, cwd)
    if reason:
        deny(reason)
    sys.exit(0)


if __name__ == "__main__":
    main()
