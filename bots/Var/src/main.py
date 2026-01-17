# main bot logic goes here
# Orchestrator
import subprocess
import threading
import platform
import os
import sys
import time
from typing import Dict, List

BOT_ROOT = os.path.dirname(os.path.abspath(__file__))  # /src
BOT_DIR = os.path.dirname(BOT_ROOT)                    # /bot root
SKILLS_DIR = os.path.join(BOT_DIR, "skills")
def get_wrapper_path(skill_dir: str) -> str:
    if platform.system() == "Windows":
        wrapper = os.path.join(skill_dir, "env", "Scripts", "python_wrapper.py")
    else:
        wrapper = os.path.join(skill_dir, "env", "bin", "python_wrapper.sh")
    return wrapper

def run_skill(skill_name: str):
    skill_dir = os.path.join(SKILLS_DIR, skill_name)
    wrapper = get_wrapper_path(skill_dir)
    main_py = os.path.join(skill_dir, "src", "main.py")

    if not os.path.exists(wrapper):
        print(f"[{skill_name}] Wrapper not found: {wrapper}")
        return
    if not os.path.exists(main_py):
        print(f"[{skill_name}] main.py not found: {main_py}")
        return

    # Launch process
    try:
        process = subprocess.Popen(
            [sys.executable, "-u",  os.path.abspath(wrapper), os.path.abspath(main_py)],  # run wrapper, pass main.py
            cwd=skill_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=False
        )

        # Live log stream
        for line in iter(process.stdout.readline, ""):
            print(f"[{skill_name}] {line.strip()}")

        process.wait()
        print(f"[{skill_name}] exited with code {process.returncode}")

    except Exception as e:
        print(f"[{skill_name}] Error: {e}")

class SkillOrchestrator:
    def __init__(self):
        self.threads: Dict[str, threading.Thread] = {}

    def start_skill(self, skill_name: str):
        if skill_name in self.threads and self.threads[skill_name].is_alive():
            print(f"[{skill_name}] Already running.")
            return

        thread = threading.Thread(target=run_skill, args=(skill_name,), daemon=True)
        self.threads[skill_name] = thread
        thread.start()
        print(f"[{skill_name}] Started.")

    def stop_all(self):
        print("\n Stopping all skills...")
        # Threads will stop automatically when their process exits (daemon=True)
        for name, thread in self.threads.items():
            if thread.is_alive():
                print(f"[{name}] (thread running)")
        print(" All threads cleaned up.")

def main():
    orchestrator = SkillOrchestrator()

    # List of skills to start
    skills_to_run = [
        "Keyboard_Input__0",
        "teleop_bot",
        "debug__0",
]

    for skill in skills_to_run:
        orchestrator.start_skill(skill)

    # Keep orchestrator alive while skills runasd
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        orchestrator.stop_all()


if __name__ == "__main__":
    main()
