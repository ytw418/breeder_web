#!/usr/bin/env python3
"""pr-guard.py 테스트. 훅을 JSON stdin 으로 불러 막는지(deny) 통과하는지 확인한다.

사용: python3 .claude/hooks/pr-guard_test.py
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "pr-guard.py")
ROOT = tempfile.mkdtemp(prefix="pr-guard-test-")
IMG = "https://raw.githubusercontent.com/ytw418/pr-assets/main/breeder_web/x/01-home.png"


def write(name: str, text: str) -> str:
    path = os.path.join(ROOT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    return path


def decision(command: str, cwd: str = ROOT, tool: str = "Bash") -> str:
    payload = {"tool_name": tool, "tool_input": {"command": command}, "cwd": cwd}
    out = subprocess.run([sys.executable, GUARD], input=json.dumps(payload), capture_output=True, text=True, check=True)
    if not out.stdout.strip():
        return "allow"
    return json.loads(out.stdout)["hookSpecificOutput"]["permissionDecision"]


write("with-img.md", f"## 변경\n- 프로필\n\n## 스크린샷\n| 앱 | 웹 |\n|---|---|\n| <img src=\"{IMG}\" width=\"280\"> | ![웹]({IMG}) |\n")
write("no-shot.md", "## 변경\n- 훅만\n\n스크린샷 없음 — 훅·문서만 바꿈\n")
write("plain.md", "## 변경\n- 프로필 화면\n")
write("sub/body.md", f"![홈]({IMG})\n")

CASES = [
    # (설명, 명령, cwd, 기대)
    ("PR 아닌 명령", "git status && gh pr list", ROOT, "allow"),
    ("이미지 없는 인라인 본문", 'gh pr create --base dev --title "feat: x" --body "## 변경\n- 프로필"', ROOT, "deny"),
    ("--fill", "gh pr create --base dev --fill", ROOT, "deny"),
    ("인라인 마크다운 이미지", f'gh pr create --base dev --title t --body "## 스크린샷\n![홈]({IMG})"', ROOT, "allow"),
    ("인라인 img 태그", f"gh pr create -t t -b '<img src=\"{IMG}\" width=\"280\">'", ROOT, "allow"),
    ("heredoc 본문 + 스크린샷 없음", "gh pr create --base dev --title t --body \"$(cat <<'EOF'\n## 변경\n스크린샷 없음 — API 만\nEOF\n)\"", ROOT, "allow"),
    ("빈 이미지 문법은 인정 안 함", 'gh pr create -t t --body "![]()"', ROOT, "deny"),
    ("--body-file 이미지 있음", "gh pr create --base dev --title t --body-file with-img.md", ROOT, "allow"),
    ("--body-file= 형식", f"gh pr create --base dev --title t --body-file={os.path.join(ROOT, 'with-img.md')}", "/", "allow"),
    ("-F 스크린샷 없음 줄", "gh pr create -t t -F no-shot.md", ROOT, "allow"),
    ("--body-file 이미지 없음", "gh pr create --base dev --title t --body-file plain.md", ROOT, "deny"),
    ("없는 본문 파일", "gh pr create --base dev --title t --body-file nope.md", ROOT, "deny"),
    ("cd 뒤 상대 경로", "cd sub && gh pr create --base dev --title t --body-file body.md", ROOT, "allow"),
    ("$(cat 파일) 본문", f'gh pr create --base dev --title t --body "$(cat {os.path.join(ROOT, "with-img.md")})"', "/", "allow"),
    ("--web 은 통과", "gh pr create --web", ROOT, "allow"),
    ("pr edit 본문 이미지 없음", "gh pr edit 201 --body-file plain.md", ROOT, "deny"),
    ("pr edit 본문 이미지 있음", "gh pr edit 201 --body-file with-img.md", ROOT, "allow"),
    ("pr edit 라벨만", "gh pr edit 201 --add-label bug", ROOT, "allow"),
    ("Desktop Commander", 'gh pr create -t t -b "x"', ROOT, "deny"),
]


def main() -> None:
    failed = 0
    for index, (label, command, cwd, expected) in enumerate(CASES):
        tool = "mcp__plugin_desktop-commander_desktop-commander__start_process" if label == "Desktop Commander" else "Bash"
        got = decision(command, cwd, tool)
        mark = "ok " if got == expected else "FAIL"
        failed += got != expected
        print(f"{mark} {index + 1:2d}. {label}: {got} (기대 {expected})")
    garbage = subprocess.run([sys.executable, GUARD], input="not json", capture_output=True, text=True)
    if garbage.returncode != 0 or garbage.stdout.strip():
        failed += 1
        print("FAIL 잘못된 입력은 막지 않고 통과해야 한다")
    print(f"\n{len(CASES) + 1 - failed}/{len(CASES) + 1} 통과")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
