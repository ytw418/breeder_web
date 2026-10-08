#!/usr/bin/env python3
"""parity-guard.py 테스트. 임시 앱·웹 저장소를 만들고 훅을 JSON stdin 으로 불러 결정을 확인한다.

사용: python3 .claude/hooks/parity-guard_test.py
"""
import json
import os
import subprocess
import sys
import tempfile
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "parity-guard.py")
ROOT = tempfile.mkdtemp(prefix="parity-guard-test-")
APP = os.path.join(ROOT, "bredy_app")
WEB = os.path.join(ROOT, "breeder_web")
OUTSIDE = os.path.join(ROOT, "elsewhere")


def sh(cwd: str, *args: str) -> None:
    subprocess.run(args, cwd=cwd, check=True, capture_output=True)


def write(repo: str, rel: str, text: str = "x\n") -> str:
    path = os.path.join(repo, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    return path


def init_repos() -> None:
    os.makedirs(OUTSIDE)
    for repo, seed in ((APP, ["app.config.js", "src/app/_layout.tsx", "docs/a.md"]),
                       (WEB, ["app/(web)/layout.tsx", "app/api/x/route.ts", "docs/a.md"])):
        os.makedirs(repo)
        sh(repo, "git", "init", "-q")
        sh(repo, "git", "config", "user.email", "t@t")
        sh(repo, "git", "config", "user.name", "t")
        for rel in seed:
            write(repo, rel)
        sh(repo, "git", "add", "-A")
        sh(repo, "git", "commit", "-qm", "init\n\nParity: both — 초기화")


def reset(repo: str) -> None:
    sh(repo, "git", "reset", "-q", "--hard")
    sh(repo, "git", "clean", "-qfd")


def stage(repo: str, *rels: str) -> None:
    for rel in rels:
        write(repo, rel, str(uuid.uuid4()))
    sh(repo, "git", "add", *rels)


def bash(command: str, cwd: str) -> str:
    payload = json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Bash",
                          "tool_input": {"command": command}, "cwd": cwd})
    out = subprocess.run([sys.executable, GUARD], input=payload, capture_output=True, text=True).stdout.strip()
    return json.loads(out)["hookSpecificOutput"]["permissionDecision"] if out else "allow"


def commit_case(repo: str, staged: list, command: str, cwd: str = None, modified: list = ()):
    def run() -> str:
        reset(repo)
        if staged:
            stage(repo, *staged)
        for rel in modified:
            write(repo, rel, str(uuid.uuid4()))
        return bash(command, cwd or repo)
    return run


# ── Stop 훅용 가짜 transcript ──

def entry(stamp: str, blocks: list, cwd: str = APP) -> str:
    return json.dumps({"type": "assistant", "timestamp": stamp, "cwd": cwd,
                       "message": {"role": "assistant", "content": blocks}}, ensure_ascii=False)


def edit(path: str) -> dict:
    return {"type": "tool_use", "name": "Edit", "input": {"file_path": path, "old_string": "a", "new_string": "b"}}


def text(value: str) -> dict:
    return {"type": "text", "text": value}


def bash_block(command: str) -> dict:
    return {"type": "tool_use", "name": "Bash", "input": {"command": command}}


def stop_case(lines: list, sub_lines: list = None, active: bool = False, session: str = None, repeat: int = 1):
    def run() -> str:
        folder = tempfile.mkdtemp(dir=ROOT)
        sid = session or str(uuid.uuid4())
        path = os.path.join(folder, f"{sid}.jsonl")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
        if sub_lines:
            os.makedirs(os.path.join(folder, sid, "subagents"))
            with open(os.path.join(folder, sid, "subagents", "agent-x.jsonl"), "w", encoding="utf-8") as handle:
                handle.write("\n".join(sub_lines) + "\n")
        payload = json.dumps({"hook_event_name": "Stop", "session_id": sid, "transcript_path": path,
                              "stop_hook_active": active, "cwd": APP})
        result = "allow"
        for _ in range(repeat):
            out = subprocess.run([sys.executable, GUARD], input=payload, capture_output=True, text=True).stdout.strip()
            result = json.loads(out)["decision"] if out else "allow"
        return result
    return run


A_SCREEN = os.path.join(APP, "src/app/(tabs)/index.tsx")
A_NEW = os.path.join(APP, "src/components/features/home/NewBar.tsx")  # 아직 없는 파일
A_ADS = os.path.join(APP, "src/lib/ads/adRows.ts")
A_DOC = os.path.join(APP, "docs/a.md")
W_SCREEN = os.path.join(WEB, "app/(web)/(main)/MainClient.tsx")
W_API = os.path.join(WEB, "app/api/x/route.ts")

HEREDOC_BOTH = 'git commit -m "$(cat <<\'EOF\'\nfeat(home): 배너 문구\n\nParity: both — 웹 feat/home-banner\nEOF\n)"'
HEREDOC_NONE = 'git commit -m "$(cat <<\'EOF\'\nfeat(home): 배너 문구\n\n본문\nEOF\n)"'

CASES = [
    # ── 커밋 게이트: 앱 ──
    ("deny", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'git commit -m "feat(home): 배너"')),
    ("allow", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'git commit -m "feat(home): 배너" -m "Parity: both — 웹 feat/home-banner"')),
    ("allow", commit_case(APP, ["src/app/(tabs)/index.tsx"], HEREDOC_BOTH)),
    ("deny", commit_case(APP, ["src/app/(tabs)/index.tsx"], HEREDOC_NONE)),
    ("allow", commit_case(APP, ["src/lib/haptics2.ts"], 'git commit -m "x" -m "Parity: app-only - 햅틱"')),
    ("deny", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'git commit -m "x" -m "Parity: app-only"')),       # 이유 없음
    ("deny", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'git commit -m "x" -m "Parity: web-only — SEO"')),  # 저장소와 안 맞음
    ("allow", commit_case(APP, ["docs/a.md"], 'git commit -m "docs: 문서"')),
    ("allow", commit_case(APP, ["src/lib/ads/adRows.ts"], 'git commit -m "fix(ads): 광고 행"')),               # 앱 전용 경로
    ("allow", commit_case(APP, ["src/app/__tests__/x.test.tsx"], 'git commit -m "test: x"')),
    ("deny", commit_case(APP, [], 'git add src/app/posts.tsx && git commit -m "feat: x"', modified=["src/app/posts.tsx"])),
    ("deny", commit_case(APP, [], 'git add -A && git commit -m "feat: x"', modified=["src/app/posts.tsx"])),
    ("allow", commit_case(APP, [], 'git add docs/a.md && git commit -m "docs"', modified=["docs/a.md", "src/app/posts.tsx"])),
    ("deny", commit_case(APP, [], 'git commit -am "feat: x"', modified=["src/app/_layout.tsx"])),
    ("deny", commit_case(APP, ["src/app/(tabs)/index.tsx"], f'git -C "{APP}" commit -m "feat: x"', cwd=OUTSIDE)),
    ("deny", commit_case(APP, ["src/app/(tabs)/index.tsx"], f'cd {APP} && git commit -m "feat: x"', cwd=OUTSIDE)),
    ("allow", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'git status && git log -1')),
    ("allow", commit_case(APP, ["src/app/(tabs)/index.tsx"], "git commit --amend --no-edit")),                 # 직전 메시지에 Parity
    ("allow", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'echo "Parity: both — 웹 #181" > /tmp/pg-msg-$$.txt && git commit -F /tmp/pg-msg-$$.txt')),
    ("allow", commit_case(APP, ["src/app/(tabs)/index.tsx"], 'printf "%s" "git commit 은 나중에"')),          # 명령이 아니라 글자
    # ── 커밋 게이트: 웹 ──
    ("deny", commit_case(WEB, ["app/(web)/(main)/MainClient.tsx"], 'git commit -m "feat(home): 배너"')),
    ("allow", commit_case(WEB, ["app/(web)/(main)/MainClient.tsx"], 'git commit -m "feat(home): 배너" -m "Parity: both — 앱 c5b086a"')),
    ("allow", commit_case(WEB, ["app/(web)/tool/page.tsx"], 'git commit -m "x" -m "Parity: web-only — 도구 랜딩"')),
    ("deny", commit_case(WEB, ["components/app/PostCard.tsx"], 'git commit -m "x" -m "Parity: app-only — 푸시"')),
    ("allow", commit_case(WEB, ["app/api/x/route.ts", "libs/server/a.ts", "prisma/schema.prisma"], 'git commit -m "feat(api): x"')),
    ("allow", commit_case(WEB, ["app/admin/users/page.tsx"], 'git commit -m "feat(admin): x"')),
    ("allow", commit_case(WEB, ["__tests__/a.test.ts"], 'git commit -m "test: x"')),
    ("deny", commit_case(WEB, ["hooks/useUser.ts"], f'cd {APP} && git status; cd {WEB} && git commit -m "x"', cwd=OUTSIDE)),
    # ── 마무리 점검(Stop) ──
    ("block", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)])])),
    ("block", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_NEW)])])),                       # 새 파일
    ("block", stop_case([entry("2026-10-09T01:00:00Z", [edit(W_SCREEN)], cwd=WEB)])),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)]),
                         entry("2026-10-09T01:05:00Z", [edit(W_SCREEN)])])),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)]),
                         entry("2026-10-09T01:05:00Z", [text("완료.\n\nParity: app-only — 푸시 권한 시트")])])),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)]),
                         entry("2026-10-09T01:05:00Z", [text("Parity: pending — 웹은 서버 #178 배포 뒤")])])),
    ("block", stop_case([entry("2026-10-09T01:00:00Z", [text("Parity: app-only — 지난번 건")]),
                         entry("2026-10-09T01:05:00Z", [edit(A_SCREEN)])])),                   # 선언이 수정보다 앞
    ("block", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)]),
                         entry("2026-10-09T01:05:00Z", [text("Parity: web-only — 잘못된 쪽")])])),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)]),
                         entry("2026-10-09T01:05:00Z", [bash_block(f'cd {APP} && git commit -m "x" -m "Parity: both — 웹 #181"')])])),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)])],
                        sub_lines=[entry("2026-10-09T01:03:00Z", [edit(W_SCREEN)], cwd=WEB)])),  # 서브에이전트가 웹 수정
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_DOC), edit(A_ADS), edit(W_API)])])),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)])], active=True)),
    ("allow", stop_case([entry("2026-10-09T01:00:00Z", [edit(A_SCREEN)])], repeat=2)),         # 같은 상태는 한 번만
    ("allow", stop_case([])),
]


def main() -> None:
    init_repos()
    failures = 0
    for index, (expected, run) in enumerate(CASES, 1):
        got = run()
        if got != expected:
            failures += 1
            print(f"FAIL #{index}: expected {expected}, got {got}")
    print(f"{len(CASES) - failures}/{len(CASES)} 통과")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
