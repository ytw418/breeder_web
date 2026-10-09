#!/usr/bin/env python3
"""
앱·웹 동시 개발 하네스 — Claude Code 훅(PreToolUse 커밋 게이트 + Stop 마무리 점검).

2026-10-09 사용자 결정: 앱(bredy_app)과 웹(breeder_web)은 화면·기능을 항상 같이 바꾼다.
예외는 기기에서만 되는 것(앱 전용: 푸시 권한·기기 설정·광고·햅틱 …)과 웹에만 있는 것(웹 전용: SEO·관리자·랜딩 …)뿐이다.
같은 의도를 플랫폼에 맞게 다르게 구현하는 것(앱 설치 첫 실행 온보딩 ↔ 웹 첫 로그인 온보딩)은 both 다.
기준표·플랫폼 대응표: bredy_app docs/parity/README.md

1) 커밋 게이트 — PreToolUse(Bash, Desktop Commander start_process)
   화면·기능 코드를 커밋하는데 메시지에 `Parity:` 트레일러가 없으면 막는다(deny).
     Parity: both — <상대편 브랜치·PR·커밋, 또는 '이 세션에서 이어서'>
     Parity: app-only — <이유>      (앱 저장소만, 기준표 '앱 전용')
     Parity: web-only — <이유>      (웹 저장소만, 기준표 '웹 전용')
   화면·기능 코드
     앱: src/app, src/components, src/hooks, src/lib, src/theme, src/constants (테스트 제외).
         앱 전용 경로(광고·푸시·햅틱)만 바꾼 커밋은 트레일러 없이 통과한다.
     웹: app/ 아래(api·admin·e2e·SEO 파일 제외), components, hooks, libs/client, styles (테스트 제외).
2) 마무리 점검 — Stop
   이번 세션(서브에이전트 포함)에서 한쪽 화면·기능 코드만 고치고 상대편 작업도, 선언도 없으면 한 번 되돌려 보낸다.
   선언: 커밋 트레일러, 또는 답변 속 `Parity: app-only|web-only|both|pending — <이유>` 한 줄(마지막 수정 뒤에 있어야 한다).
   pending 은 사용자 결정·서버 배포를 기다릴 때 쓰고 남은 일을 사용자에게 알린다.
   같은 상태로는 다시 묻지 않는다(세션별 기록: $TMPDIR/parity-guard/).

사본: bredy_app·breeder_web 의 .claude/hooks/parity-guard.py(같은 내용으로 유지한다). 테스트: parity-guard_test.py.
"""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

GUIDE = "bredy_app docs/parity/README.md"

APP_UI = re.compile(r"^src/(app|components|hooks|lib|theme|constants)/")
APP_ONLY_PATHS = re.compile(
    r"^src/(lib/ads/|components/features/ads/|lib/notifications/"
    r"|components/features/PushPermissionPrompt\.tsx$|lib/haptics\.ts$)"
)
WEB_UI = re.compile(r"^(app/|components/|hooks/|libs/client/|styles/)")
WEB_ONLY_PATHS = re.compile(
    r"^(app/(api|admin|e2e|sentry-example-page)/|app/(robots|sitemap|manifest)\.ts$"
    r"|app/(opengraph|twitter)-image\.tsx$|components/admin/)"
)
TEST_PATH = re.compile(r"(^|/)__tests__/|\.(test|spec)\.[jt]sx?$")

PARITY = re.compile(
    r"\bParity:[ \t]*(both|app-only|web-only|pending)\b[ \t]*(?:[—–:\-(]+[ \t]*)?([^\n\"'`]*)",
    re.IGNORECASE,
)
COMMIT = re.compile(
    r"(?:^|[;&|(\n`]|\$\(|\bthen\b|\bdo\b)\s*(?:[A-Za-z_]\w*=\S*\s+)*"
    r"git((?:\s+-[Cc]\s+(?:\"[^\"]+\"|'[^']+'|\S+))*)\s+commit\b"
)
CD = re.compile(r"(?:^|[;&|(\n])\s*cd\s+(\"[^\"]+\"|'[^']+'|[^\s;&|)]+)")
GIT_ADD = re.compile(r"\bgit((?:\s+-[Cc]\s+(?:\"[^\"]+\"|'[^']+'|\S+))*)\s+add\b([^;&|\n]*)")
EDIT_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")
LABEL = {"app": "앱(bredy_app)", "web": "웹(breeder_web)"}
OTHER = {"app": "web", "web": "app"}

_REPO_CACHE = {}


def unquote(text: str) -> str:
    return text.strip().strip("\"'")


def repo_of(path: str):
    """경로가 속한 저장소 (종류 'app'|'web'|None, 루트). 새로 만드는 파일이면 있는 부모부터 찾는다."""
    if not path:
        return None, None
    path = os.path.abspath(os.path.expanduser(path))
    probe = path if os.path.isdir(path) else os.path.dirname(path)
    while probe and not os.path.isdir(probe):
        probe = os.path.dirname(probe)
    seen = []
    while probe:
        if probe in _REPO_CACHE:
            result = _REPO_CACHE[probe]
            break
        seen.append(probe)
        if os.path.exists(os.path.join(probe, ".git")):
            if os.path.isdir(os.path.join(probe, "src", "app")) and os.path.isfile(os.path.join(probe, "app.config.js")):
                result = ("app", probe)
            elif os.path.isdir(os.path.join(probe, "app", "(web)")):
                result = ("web", probe)
            else:
                result = (None, probe)
            break
        parent = os.path.dirname(probe)
        if parent == probe:
            result = (None, None)
            break
        probe = parent
    else:
        result = (None, None)
    for item in seen:
        _REPO_CACHE[item] = result
    return result


def ui_side(kind: str, rel: str):
    """화면·기능 코드면 'app'|'web', 아니면(문서·테스트·서버·전용 경로) None."""
    rel = rel.replace(os.sep, "/")
    if TEST_PATH.search(rel):
        return None
    if kind == "app" and APP_UI.match(rel) and not APP_ONLY_PATHS.match(rel):
        return "app"
    if kind == "web" and WEB_UI.match(rel) and not WEB_ONLY_PATHS.match(rel):
        return "web"
    return None


def ui_side_of_path(path: str):
    kind, root = repo_of(path)
    if not kind:
        return None
    rel = os.path.relpath(os.path.abspath(os.path.expanduser(path)), root)
    return ui_side(kind, rel)


def git(repo: str, *args: str) -> str:
    try:
        return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return ""


def changed_files(repo: str) -> list:
    """작업 트리에서 바뀐(추적 + 새) 파일 전체."""
    out = git(repo, "status", "--porcelain", "--untracked-files=all")
    files = []
    for line in out.splitlines():
        name = line[3:]
        if " -> " in name:
            name = name.split(" -> ", 1)[1]
        files.append(unquote(name))
    return files


def option_dir(options: str):
    match = re.search(r"-C\s+(\"[^\"]+\"|'[^']+'|\S+)", options or "")
    return unquote(match.group(1)) if match else None


def dir_at(command: str, pos: int, cwd: str) -> str:
    """명령의 pos 위치에서 실행 위치(그 앞의 마지막 `cd X`)."""
    current = cwd
    for match in CD.finditer(command, 0, pos):
        target = os.path.expanduser(unquote(match.group(1)))
        current = target if os.path.isabs(target) else os.path.normpath(os.path.join(current, target))
    return current


def added_files(command: str, end: int, cwd: str, repo: str) -> list:
    """커밋 앞 `git add …` 로 함께 올라갈 파일(아직 stage 전). 범위가 넓으면 바뀐 파일 전체."""
    files = []
    changed = None
    for match in GIT_ADD.finditer(command, 0, end):
        base = option_dir(match.group(1)) or dir_at(command, match.start(), cwd)
        base = base if os.path.isabs(base) else os.path.normpath(os.path.join(cwd, base))
        if repo_of(base)[1] != repo:
            continue
        if changed is None:
            changed = changed_files(repo)
        tokens = [unquote(t) for t in re.findall(r"\"[^\"]+\"|'[^']+'|\S+", match.group(2))]
        specs = [t for t in tokens if not t.startswith("-")]
        broad = any(t in ("-A", "--all", "-u", "--update") for t in tokens) or not specs
        if broad or any(s in (".", ":/", "*") or any(ch in s for ch in "*?[") for s in specs):
            files.extend(changed)
            continue
        for spec in specs:
            rel = os.path.relpath(os.path.normpath(os.path.join(base, spec)), repo).replace(os.sep, "/")
            files.extend(f for f in changed if f == rel or f.startswith(rel.rstrip("/") + "/"))
    return files


def commit_message(segment: str, prefix: str, repo: str, amend: bool) -> str:
    """커밋 명령 조각(heredoc 포함)에 든 메시지. -F 파일·--amend --no-edit 도 읽는다.
    -F 파일을 같은 명령 앞부분에서 만드는 중이면(아직 없으면) 앞부분 글자에서 찾는다."""
    text = segment
    file_match = re.search(r"(?:\s-F|\s--file)(?:=|\s+)(\"[^\"]+\"|'[^']+'|[^\s;&|]+)", segment)
    if file_match and unquote(file_match.group(1)) != "-":
        path = os.path.expanduser(unquote(file_match.group(1)))
        path = path if os.path.isabs(path) else os.path.join(repo, path)
        try:
            with open(path, encoding="utf-8", errors="ignore") as handle:
                text += "\n" + handle.read()
        except OSError:
            text += "\n" + prefix
    if amend and not re.search(r"\s(-m|--message|-F|--file)\b", segment):
        text += "\n" + git(repo, "log", "-1", "--format=%B")
    return text


def parse_commits(command: str, cwd: str) -> list:
    """명령 안의 `git commit` 마다 (저장소 종류, 루트, 메시지, 시작, 끝)."""
    found = []
    matches = list(COMMIT.finditer(command))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(command)
        where = option_dir(match.group(1)) or dir_at(command, match.start(), cwd)
        where = where if os.path.isabs(where) else os.path.normpath(os.path.join(cwd, where))
        kind, root = repo_of(where)
        if not kind:
            continue
        segment = command[match.end():end]
        amend = bool(re.search(r"--amend\b", segment))
        prefix = command[matches[index - 1].end() if index else 0:match.start()]
        found.append({"kind": kind, "root": root, "message": commit_message(segment, prefix, root, amend),
                      "start": match.start(), "segment": segment})
    return found


def declared(text: str):
    """텍스트 속 `Parity:` 선언 [(값, 이유)]."""
    return [(m.group(1).lower(), m.group(2).strip()) for m in PARITY.finditer(text or "")]


# ── 1) 커밋 게이트 ──────────────────────────────────────────────

def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"[앱·웹 동시 개발 하네스] {reason} (기준표: {GUIDE})",
        }
    }, ensure_ascii=False))
    sys.exit(0)


def check_commit_command(command: str, cwd: str) -> None:
    for commit in parse_commits(command.replace("\\\n", " "), cwd):
        kind, root = commit["kind"], commit["root"]
        files = git(root, "diff", "--cached", "--name-only").splitlines()
        files += added_files(command, commit["start"], cwd, root)
        if re.search(r"(?:^|\s)(-a|--all|-[a-zA-Z]*a[a-zA-Z]*m?)(?=\s|$)", commit["segment"].split("\n", 1)[0]):
            files += git(root, "diff", "--name-only", "HEAD").splitlines()
        ui = sorted({f for f in files if ui_side(kind, f)})
        if not ui:
            continue
        sample = ", ".join(ui[:3]) + (f" 외 {len(ui) - 3}개" if len(ui) > 3 else "")
        allowed = ("both", "app-only") if kind == "app" else ("both", "web-only")
        decls = declared(commit["message"])
        good = [d for d in decls if d[0] in allowed and len(d[1]) >= 2]
        if good:
            continue
        wrong = [d for d in decls if d[0] not in allowed]
        if wrong:
            deny(f"{LABEL[kind]} 커밋에 `Parity: {wrong[0][0]}` 는 맞지 않다. {' / '.join(allowed)} 중 하나와 이유를 적는다.")
        if decls:
            deny(f"`Parity: {decls[0][0]}` 뒤에 상대편 작업(브랜치·PR·커밋) 또는 예외 이유를 적는다. 예: `Parity: {allowed[0]} — 웹 feat/home-banner`")
        only = "app-only — <이유(푸시 권한·기기 설정·광고처럼 앱에서만 되는 것)>" if kind == "app" \
            else "web-only — <이유(SEO·관리자·랜딩처럼 웹에만 있는 것)>"
        deny(
            f"{LABEL[kind]} 화면·기능 코드({sample})를 커밋하는데 `Parity:` 트레일러가 없다. "
            f"{LABEL[OTHER[kind]]}도 같이 바꿨거나 바꿀 차례면 `Parity: both — <상대편 브랜치·PR·커밋 또는 '이 세션에서 이어서'>`, "
            f"한쪽에만 해당하면 `Parity: {only}` 를 커밋 메시지 끝에 한 줄 넣는다. "
            f"상대편을 아직 안 고쳤다면 커밋 전에 같이 고치는 것이 기본이다."
        )


# ── 2) 마무리 점검 ──────────────────────────────────────────────

def transcript_files(path: str) -> list:
    files = [path]
    base = path[:-len(".jsonl")] if path.endswith(".jsonl") else path
    files += sorted(glob.glob(os.path.join(base, "subagents", "*.jsonl")))
    return files


def scan_transcript(path: str, fallback_cwd: str):
    """(앱 화면 수정 [(시각, 경로)], 웹 화면 수정, 선언 [(시각, 값, 저장소 종류|None)])."""
    edits = {"app": [], "web": []}
    decls = []
    for file_path in transcript_files(path):
        try:
            handle = open(file_path, encoding="utf-8", errors="ignore")
        except OSError:
            continue
        with handle:
            for number, line in enumerate(handle):
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if entry.get("type") != "assistant":
                    continue
                stamp = str(entry.get("timestamp") or f"~{number:09d}")
                cwd = entry.get("cwd") or fallback_cwd
                for block in (entry.get("message") or {}).get("content") or []:
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") == "text":
                        decls += [(stamp, value, None) for value, _ in declared(block.get("text", ""))]
                    elif block.get("type") == "tool_use":
                        name = str(block.get("name", ""))
                        tool_input = block.get("input") or {}
                        if name in EDIT_TOOLS or name.endswith(("__write_file", "__edit_block")):
                            target = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("notebook_path")
                            side = ui_side_of_path(str(target or ""))
                            if side:
                                edits[side].append((stamp, str(target)))
                        elif name == "Bash" or name.endswith("__start_process"):
                            for commit in parse_commits(str(tool_input.get("command", "")), cwd):
                                decls += [(stamp, value, commit["kind"]) for value, _ in declared(commit["message"])]
    return edits["app"], edits["web"], decls


def state_path(session: str) -> str:
    folder = os.path.join(tempfile.gettempdir(), "parity-guard")
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, re.sub(r"[^\w.-]", "_", session or "unknown") + ".json")


def check_stop(payload: dict) -> None:
    if payload.get("stop_hook_active"):
        return
    transcript = str(payload.get("transcript_path") or "")
    if not transcript or not os.path.isfile(transcript):
        return
    app_edits, web_edits, decls = scan_transcript(transcript, str(payload.get("cwd") or os.getcwd()))
    pending = []
    for side, mine, theirs in (("app", app_edits, web_edits), ("web", web_edits, app_edits)):
        if not mine or theirs:
            continue
        last = max(stamp for stamp, _ in mine)
        ok_values = ("both", "pending", "app-only" if side == "app" else "web-only")
        if any(stamp >= last and value in ok_values and kind in (None, side) for stamp, value, kind in decls):
            continue
        pending.append((side, last, sorted({p for _, p in mine})))
    if not pending:
        return
    signature = "|".join(f"{side}@{last}" for side, last, _ in pending)
    state = state_path(str(payload.get("session_id") or ""))
    try:
        with open(state, encoding="utf-8") as handle:
            reminded = json.load(handle)
    except (OSError, ValueError):
        reminded = []
    if signature in reminded:
        return
    with open(state, "w", encoding="utf-8") as handle:
        json.dump(reminded + [signature], handle)
    lines = []
    for side, _, paths in pending:
        names = [os.path.basename(p) for p in paths]
        sample = ", ".join(names[:3]) + (f" 외 {len(names) - 3}개" if len(names) > 3 else "")
        only = "app-only" if side == "app" else "web-only"
        example = "푸시 권한·기기 설정·광고처럼 앱에서만 되는 것" if side == "app" else "SEO·관리자·랜딩처럼 웹에만 있는 것"
        lines.append(
            f"이번 세션에서 {LABEL[side]} 화면·기능 코드({sample})만 고쳤고 {LABEL[OTHER[side]]} 대응도, 예외 선언도 없다. "
            f"다음 중 하나를 하고 마친다. "
            f"① 같은 변경을 {LABEL[OTHER[side]]}에도 반영한다(플랫폼 대응표: 앱 설치 첫 실행 ↔ 웹 첫 로그인 등). "
            f"② {example}이면 답변에 `Parity: {only} — <이유>` 한 줄을 적는다. "
            f"③ 사용자 결정·서버 배포를 기다려야 하면 `Parity: pending — <이유>` 를 적고 남은 일을 사용자에게 알린다."
        )
    print(json.dumps({"decision": "block", "reason": f"[앱·웹 동시 개발 하네스] {' '.join(lines)} (기준표: {GUIDE})"},
                     ensure_ascii=False))


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # 입력을 못 읽으면 막지 않는다
    try:
        if payload.get("hook_event_name") == "Stop":
            check_stop(payload)
        else:
            tool = str(payload.get("tool_name", ""))
            if tool == "Bash" or tool.endswith("__start_process"):
                command = str((payload.get("tool_input") or {}).get("command", ""))
                if "commit" in command:
                    check_commit_command(command, str(payload.get("cwd") or os.getcwd()))
    except SystemExit:
        raise
    except Exception:
        pass  # 훅 오류로 작업을 막지 않는다
    sys.exit(0)


if __name__ == "__main__":
    main()
