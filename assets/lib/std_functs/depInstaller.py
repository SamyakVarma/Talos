#!/usr/bin/env python3
import os
import sys
import json
import subprocess

def get_global_deps_dir():
    # Cross-platform Documents/talos/global_deps
    user_home = os.path.expanduser("~")
    return os.path.join(user_home, "Documents", "talos", "global_deps")

def load_dep_registry(dep_reg_path):
    if not os.path.exists(dep_reg_path):
        return {"python_interpreters": {}, "python": {}, "cpp": {}}
    with open(dep_reg_path, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            print("[WARN] dep_registry.json is corrupted, recreating...")
            return {"python_interpreters": {}, "python": {}, "cpp": {}}

def save_dep_registry(dep_reg_path, data):
    with open(dep_reg_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"[INFO] Updated registry at: {dep_reg_path}")

def install_dependency(package_name, version):
    global_deps = get_global_deps_dir()
    dep_reg_path = os.path.join(global_deps, "dep_registry.json")

    # Ensure folder structure
    target_dir = os.path.join(global_deps, "python", package_name, version)
    os.makedirs(target_dir, exist_ok=True)

    # Run pip install -t <target_dir>
    print(f"[INFO] Installing {package_name}=={version} to {target_dir}")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install",
            f"{package_name}=={version}", "-t", target_dir
        ])
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] pip failed with exit code {e.returncode}")
        sys.exit(1)

    # Update dep_registry.json
    dep_registry = load_dep_registry(dep_reg_path)

    if "python" not in dep_registry:
        dep_registry["python"] = {}

    if package_name not in dep_registry["python"]:
        dep_registry["python"][package_name] = {"versions": {}}

    dep_registry["python"][package_name]["versions"][version] = target_dir

    save_dep_registry(dep_reg_path, dep_registry)
    print(f"[SUCCESS] Installed {package_name}=={version}")

def main():
    if len(sys.argv) != 3:
        print("Usage: python install_dep.py <package_name> <version>")
        sys.exit(1)

    package_name = sys.argv[1]
    version = sys.argv[2]
    install_dependency(package_name, version)

if __name__ == "__main__":
    main()
