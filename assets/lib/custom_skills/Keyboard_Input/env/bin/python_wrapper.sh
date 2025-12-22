#!/usr/bin/env bash
set -e

# ---------------------------------
# Define paths
# ---------------------------------
BASE_DIR="$(dirname "$(realpath "$0")")"
ENV_META="$BASE_DIR/../env_meta.json"
DEP_REG="$BASE_DIR/../../../..//global_deps/dep_registry.json"

# ---------------------------------
# Read python_version
# ---------------------------------
PY_VER=$(python3 - <<EOF
import json
print(json.load(open("$ENV_META")).get("python_version", ""))
EOF
)

if [ -z "$PY_VER" ]; then
  echo "[ERROR] No python_version found in env_meta.json"
  exit 1
fi

# ---------------------------------
# Look up interpreter path
# ---------------------------------
PY_EXE=$(python3 - <<EOF
import json
print(json.load(open("$DEP_REG"))["python_interpreters"].get("$PY_VER", ""))
EOF
)

if [ -z "$PY_EXE" ]; then
  echo "[ERROR] Python version $PY_VER not found in dep_registry.json"
  exit 1
fi

# ---------------------------------
# Read python_paths
# ---------------------------------
PY_PATHS=$(python3 - <<EOF
import json
print(":".join(json.load(open("$ENV_META")).get("python_paths", [])))
EOF
)

# ---------------------------------
# Export environment
# ---------------------------------
export PYTHONPATH="$PY_PATHS:$PYTHONPATH"

echo "[INFO] Using Python $PY_VER at $PY_EXE"
echo "[INFO] PYTHONPATH = $PYTHONPATH"

# ---------------------------------
# Execute script
# ---------------------------------
exec "$PY_EXE" -u "$@"
