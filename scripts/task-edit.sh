#!/usr/bin/env bash
# Open a new task brief in $EDITOR (defaults to vi), then submit it.
#
# Usage:
#   scripts/task-edit.sh --project <id> [--task-id <id>]
#
# Behaviour:
#   - Creates a temporary file pre-populated with the task-brief template.
#   - Opens it in $EDITOR. On save, runs `task submit --from-file <tmpfile>`.
#   - If the editor is closed without changes, the brief is NOT submitted.
#   - If parsing fails, the temp file is preserved at $TMPDIR/task-edit-*.md
#     and the path is printed so the human can fix and re-run with
#     `./run-v1.sh task submit --project <id> --from-file <path>`.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_V1="$ROOT_DIR/run-v1.sh"
EDITOR_CMD="${EDITOR:-vi}"

PROJECT_ID=""
TASK_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --task-id) TASK_ID="$2"; shift 2 ;;
    -h|--help)
      grep -E "^#( |$)" "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "--project is required" >&2
  exit 1
fi

TMPFILE="$(mktemp -t task-edit-XXXXXX.md)"

cat > "$TMPFILE" <<'TEMPLATE'
# Task: <one-line title>

intent:
  <2-4 sentences. What should this task accomplish? What's the
  showrunner intent?>

characters:
  - <character_id> (POV)
  - <character_id>

emotional-target:
  <optional. What emotional/relational vector should shift?>

constraints:
  - <something that must NOT happen anywhere in this task>

texture-must:
  - <a concrete sensory or behavioural anchor>
  - <another concrete anchor>

chapter-budget: auto

pacing-hint: <optional free-text hint about pace>

preferred-shapes:
  - relationship_beat
  - character_moment
  - aftermath

forbidden-shapes:
  - confrontation
  - payoff
TEMPLATE

cp "$TMPFILE" "$TMPFILE.original"

"$EDITOR_CMD" "$TMPFILE"

if cmp -s "$TMPFILE" "$TMPFILE.original"; then
  echo "No changes detected — task not submitted." >&2
  rm -f "$TMPFILE" "$TMPFILE.original"
  exit 0
fi

rm -f "$TMPFILE.original"

if [[ -n "$TASK_ID" ]]; then
  if "$RUN_V1" task submit --project "$PROJECT_ID" --from-file "$TMPFILE" --task-id "$TASK_ID"; then
    rm -f "$TMPFILE"
  else
    echo "Submit failed. Brief preserved at: $TMPFILE" >&2
    exit 1
  fi
else
  if "$RUN_V1" task submit --project "$PROJECT_ID" --from-file "$TMPFILE"; then
    rm -f "$TMPFILE"
  else
    echo "Submit failed. Brief preserved at: $TMPFILE" >&2
    exit 1
  fi
fi
