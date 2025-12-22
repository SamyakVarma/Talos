import os
import requests
import zipfile
import io
import json

def install_python(version, base_dir):
    dest = os.path.join(base_dir, version)
    dep_registry = os.path.join(os.path.dirname(base_dir), "dep_registry.json")
    os.makedirs(dest, exist_ok=True)

    url = f"https://www.python.org/ftp/python/{version}/python-{version}-embed-amd64.zip"
    print(f"Downloading Python {version} from:\n  {url}")

    r = requests.get(url)
    r.raise_for_status()

    print(f"Extracting to {dest} ...")
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        z.extractall(dest)

    python_exe = os.path.join(dest, "python.exe")
    if not os.path.exists(python_exe):
        raise RuntimeError(f"python.exe not found in extracted folder {dest}")

    if os.path.exists(dep_registry):
        with open(dep_registry, "r") as f:
            try:
                registry = json.load(f)
            except json.JSONDecodeError:
                registry = {}
    else:
        registry = {}

    # Ensure structure exists
    registry.setdefault("python_interpreters", {})
    registry.setdefault("python", {})
    registry.setdefault("cpp", {})

    registry["python_interpreters"][version] = python_exe
    # update Registry
    with open(dep_registry, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"Python {version} installed successfully.")
    print(f"Registered in dep_registry.json:\n  {dep_registry}")
    print(f"Interpreter path: {python_exe}")

if __name__ == "__main__":
    install_python("3.10.0", "C:/Users/nssam/Documents/talos/global_deps/python")
