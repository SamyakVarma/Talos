#!/usr/bin/env python3
import os
import sys
import json
import subprocess
from pathlib import Path

# ------------------------------------------------------------
# Resolve essential paths
# ------------------------------------------------------------
WRAPPER_DIR = Path(__file__).parent
SKILL_DIR = WRAPPER_DIR.parent.parent      # /skill
ENV_META = SKILL_DIR / "env" / "env_meta.json"

USER_DIR = Path(os.path.expanduser("~"))
GLOBAL_DEPS = USER_DIR / "Documents" / "talos" / "global_deps"
DEP_REG = GLOBAL_DEPS / "dep_registry.json"

# ------------------------------------------------------------
# Debug helper
# ------------------------------------------------------------
def debug(*args):
    print("[DEBUG]", *args)


# ------------------------------------------------------------
# Load JSON safely
# ------------------------------------------------------------
def load_json(path: Path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to load JSON: {path} ({e})")
        sys.exit(1)


# ------------------------------------------------------------
# 1. Load env_meta.json
# ------------------------------------------------------------
meta = load_json(ENV_META)

python_version = meta.get("python_version")
python_paths = meta.get("python_paths", [])

if not python_version:
    print("[ERROR] python_version missing in env_meta.json")
    sys.exit(1)

debug("python_version:", python_version)
debug("python_paths:", python_paths)


# ------------------------------------------------------------
# 2. Load dep_registry.json
# ------------------------------------------------------------
if python_version == "X":
    # Use SYSTEM default interpreter 
    python_exe = Path(sys.executable)
    debug("Using default system Python:", python_exe)

else:
    registry = load_json(DEP_REG)
    interp_map = registry.get("python_interpreters", {})

    python_exe = interp_map.get(python_version)
    if not python_exe:
        print(f"[ERROR] Python {python_version} not found in dep_registry.json")
        sys.exit(1)

    python_exe = Path(python_exe)
    if not python_exe.exists():
        print(f"[ERROR] Interpreter does not exist: {python_exe}")
        sys.exit(1)

    debug("python_exe:", python_exe)


# ------------------------------------------------------------
# Prepare forced sys.path code (works even in embedded Python)
# ------------------------------------------------------------
forced_paths = [str(Path(p)) for p in python_paths]
FORCE_PATH_CODE = ";".join(forced_paths)


inject_sys_path = f"""
import sys
for p in r"{FORCE_PATH_CODE}".split(";"):
    if p and p not in sys.path:
        sys.path.insert(0, p)
"""
# ------------------------------------------------------------
# 3. Run the actual target script using runpy
# ------------------------------------------------------------
if len(sys.argv) < 2:
    print("[ERROR] No target script provided.")
    sys.exit(1)

target_script = sys.argv[1]
script_args = sys.argv[2:]

debug("Executing:", python_exe, target_script)
print("----------------------------------------------------------")


run_code = inject_sys_path + f"""
import sys, runpy, os

# Ensure the script's directory is importable
script_path = r"{target_script}"
script_dir = os.path.dirname(script_path)
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

sys.argv = [r"{target_script}"] + {script_args}

# Execute the file
runpy.run_path(script_path, run_name="__main__")
"""

proc = subprocess.Popen(
    [str(python_exe),"-u", "-c", run_code],
    stdout=sys.stdout,      # forward to wrapper stdout
    stderr=sys.stderr,      # forward errors too
)
proc.wait()
sys.exit(proc.returncode)
