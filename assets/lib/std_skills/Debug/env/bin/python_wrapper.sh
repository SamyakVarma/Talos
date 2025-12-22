#!/usr/bin/env bash

# ------------------------------------------------------------
# Resolve paths
# ------------------------------------------------------------
WRAPPER_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$WRAPPER_DIR/../.." && pwd)"
ENV_META="$SKILL_DIR/env/env_meta.json"

USER_DIR="$HOME"
GLOBAL_DEPS="$USER_DIR/Documents/talos/global_deps"
DEP_REG="$GLOBAL_DEPS/dep_registry.json"

# ------------------------------------------------------------
# Debug logging
# ------------------------------------------------------------
debug() {
    echo "[DEBUG] $@"
}

# ------------------------------------------------------------
# Load JSON values using Python
# ------------------------------------------------------------
load_json() {
    python3 - <<EOF
import json, sys
try:
    print(json.load(open("$1")))
except Exception as e:
    print("ERROR", e)
    sys.exit(1)
EOF
}

# ------------------------------------------------------------
# Extract fields safely using Python
# ------------------------------------------------------------
get_value() {
    python3 - <<EOF
import json
data=json.load(open("$1"))
print(data.get("$2",""))
EOF
}

# ------------------------------------------------------------
# Load env_meta.json
# ------------------------------------------------------------
python_version=$(get_value "$ENV_META" "python_version")
python_paths=$(python3 - <<EOF
import json
meta=json.load(open("$ENV_META"))
print(";".join(meta.get("python_paths", [])))
EOF
)

if [ -z "$python_version" ]; then
    echo "[ERROR] python_version missing in env_meta.json"
    exit 1
fi

debug "python_version: $python_version"
debug "python_paths: $python_paths"

# ------------------------------------------------------------
# Load dep_registry.json
# ------------------------------------------------------------
python_exe=$(python3 - <<EOF
import json
reg=json.load(open("$DEP_REG"))
print(reg.get("python_interpreters", {}).get("$python_version", ""))
EOF
)

if [ ! -f "$python_exe" ]; then
    echo "[ERROR] Interpreter not found or does not exist: $python_exe"
    exit 1
fi

debug "python_exe: $python_exe"

# ------------------------------------------------------------
# Build Python injection code
# ------------------------------------------------------------
inject_sys_path=$(cat <<EOF
import sys
for p in "$python_paths".split(";"):
    if p and p not in sys.path:
        sys.path.insert(0, p)
EOF
)

# ------------------------------------------------------------
# Handle target script
# ------------------------------------------------------------
if [ $# -lt 1 ]; then
    echo "[ERROR] No target script provided."
    exit 1
fi

target_script="$1"
shift
script_args="$@"

debug "Executing: $python_exe $target_script"
echo "----------------------------------------------------------"

# ------------------------------------------------------------
# Build execution code
# ------------------------------------------------------------
run_code=$(cat <<EOF
$inject_sys_path
import sys, runpy, os

script_path = r"$target_script"
script_dir = os.path.dirname(script_path)
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

sys.argv = ["$target_script"] + "$script_args".split()

runpy.run_path(script_path, run_name="__main__")
EOF
)

# ------------------------------------------------------------
# Run the code
# ------------------------------------------------------------
"$python_exe" -c "$run_code"
exit $?
