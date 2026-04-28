#!/usr/bin/env bash
# End-to-end pipeline: bootstrap a new project and generate the first N chapters.
#
# Usage:
#   scripts/generate-project.sh --project <id> --count <1..10> \
#       [--profile <preset_id>] [--approver <name>] [--note <text>] \
#       [--outline-count <chapters>] [--with-eval] [--strict-eval] \
#       [--with-offscreen] [--with-runtime-eval] [--force]
#
# Steps (each is skipped if its output already exists, unless --force is set):
#   1. project bootstrap        -> data/projects/<id>/project.json
#   2. outline generate-stack   -> arc-outlines.json + beat-outlines.json
#   3. outline generate-drafts  -> detailed-outline.md
#   4. outline approve-detail   -> detailed-outline-approved.json
#   5. threads seed             -> narrative-threads.json + story-contracts.json
#   6. offscreen schedule (opt) -> offscreen-moves.json (only with --with-offscreen)
#   7. chapter generate-first   -> chapters/chapter-NNN/{draft.md,result.json,...}
#   8. runtime eval (optional)  -> memory/eval/runtime-eval-report.json

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_V1="$ROOT_DIR/run-v1.sh"

if [[ ! -x "$RUN_V1" ]]; then
  echo "Cannot find run-v1.sh at $RUN_V1" >&2
  exit 1
fi

PROJECT_ID=""
COUNT=""
PROFILE_ID=""
APPROVER="auto-script"
NOTE="auto-approved by scripts/generate-project.sh"
OUTLINE_COUNT=""
WITH_EVAL=""
STRICT_EVAL=""
WITH_OFFSCREEN=""
WITH_RUNTIME_EVAL=""
FORCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="$2"; shift 2 ;;
    --count)
      COUNT="$2"; shift 2 ;;
    --profile)
      PROFILE_ID="$2"; shift 2 ;;
    --approver)
      APPROVER="$2"; shift 2 ;;
    --note)
      NOTE="$2"; shift 2 ;;
    --outline-count)
      OUTLINE_COUNT="$2"; shift 2 ;;
    --with-eval)
      WITH_EVAL="--with-eval"; shift ;;
    --strict-eval)
      STRICT_EVAL="--strict-eval"; shift ;;
    --with-offscreen)
      WITH_OFFSCREEN="1"; shift ;;
    --with-runtime-eval)
      WITH_RUNTIME_EVAL="1"; shift ;;
    --force)
      FORCE="1"; shift ;;
    -h|--help)
      grep -E "^#( |$)" "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "--project is required" >&2
  exit 1
fi
if [[ -z "$COUNT" ]]; then
  echo "--count is required" >&2
  exit 1
fi
if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || (( COUNT < 1 )) || (( COUNT > 10 )); then
  echo "--count must be an integer between 1 and 10 (got: $COUNT)" >&2
  exit 1
fi
if ! [[ "$PROJECT_ID" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "--project must match [a-zA-Z0-9_-]+ (got: $PROJECT_ID)" >&2
  exit 1
fi

PROJECT_DIR="$ROOT_DIR/data/projects/$PROJECT_ID"
PROJECT_FILE="$PROJECT_DIR/project.json"
BEATS_FILE="$PROJECT_DIR/beat-outlines.json"
DETAILED_MD="$PROJECT_DIR/detailed-outline.md"
APPROVED_FILE="$PROJECT_DIR/detailed-outline-approved.json"
THREADS_FILE="$PROJECT_DIR/narrative-threads.json"
OFFSCREEN_FILE="$PROJECT_DIR/offscreen-moves.json"

step_header() {
  echo ""
  echo "============================================================"
  echo "[step $1] $2"
  echo "============================================================"
}

should_run() {
  local marker="$1"
  if [[ -n "$FORCE" ]]; then
    return 0
  fi
  if [[ -f "$marker" ]]; then
    echo "  -> already present: $(realpath --relative-to="$ROOT_DIR" "$marker")"
    return 1
  fi
  return 0
}

step_header 1 "project bootstrap (project=$PROJECT_ID${PROFILE_ID:+, profile=$PROFILE_ID})"
if should_run "$PROJECT_FILE"; then
  set -x
  if [[ -n "$PROFILE_ID" ]]; then
    "$RUN_V1" project bootstrap --project "$PROJECT_ID" --profile "$PROFILE_ID"
  else
    "$RUN_V1" project bootstrap --project "$PROJECT_ID"
  fi
  set +x
else
  echo "  -> skipping bootstrap"
fi

step_header 2 "outline generate-stack${OUTLINE_COUNT:+ (count=$OUTLINE_COUNT)}"
if should_run "$BEATS_FILE"; then
  set -x
  if [[ -n "$OUTLINE_COUNT" ]]; then
    "$RUN_V1" outline generate-stack --project "$PROJECT_ID" --count "$OUTLINE_COUNT"
  else
    "$RUN_V1" outline generate-stack --project "$PROJECT_ID"
  fi
  set +x
else
  echo "  -> skipping outline generate-stack"
fi

step_header 3 "outline generate-drafts (writes detailed-outline.md)"
if should_run "$DETAILED_MD"; then
  set -x
  "$RUN_V1" outline generate-drafts --project "$PROJECT_ID"
  set +x
else
  echo "  -> skipping outline generate-drafts"
fi

step_header 4 "outline approve-detail (approver=$APPROVER)"
if should_run "$APPROVED_FILE"; then
  set -x
  "$RUN_V1" outline approve-detail --project "$PROJECT_ID" --approver "$APPROVER" --note "$NOTE"
  set +x
else
  echo "  -> skipping outline approve-detail"
fi

step_header 5 "threads seed"
if should_run "$THREADS_FILE"; then
  set -x
  "$RUN_V1" threads seed --project "$PROJECT_ID"
  set +x
else
  echo "  -> skipping threads seed"
fi

if [[ -n "$WITH_OFFSCREEN" ]]; then
  step_header 6 "offscreen schedule"
  if should_run "$OFFSCREEN_FILE"; then
    set -x
    "$RUN_V1" offscreen schedule --project "$PROJECT_ID"
    set +x
  else
    echo "  -> skipping offscreen schedule"
  fi
fi

step_header 7 "chapter generate-first --count $COUNT${WITH_EVAL:+ $WITH_EVAL}${STRICT_EVAL:+ $STRICT_EVAL}"
set -x
"$RUN_V1" chapter generate-first --project "$PROJECT_ID" --count "$COUNT" $WITH_EVAL $STRICT_EVAL
set +x

if [[ -n "$WITH_RUNTIME_EVAL" ]]; then
  step_header 8 "runtime eval --chapter $COUNT${STRICT_EVAL:+ $STRICT_EVAL}"
  set -x
  "$RUN_V1" runtime eval --project "$PROJECT_ID" --chapter "$COUNT" $STRICT_EVAL
  set +x
fi

echo ""
echo "============================================================"
echo "[done] project: $PROJECT_ID  (chapters generated up to $COUNT)"
echo "       data: $PROJECT_DIR"
echo "============================================================"
