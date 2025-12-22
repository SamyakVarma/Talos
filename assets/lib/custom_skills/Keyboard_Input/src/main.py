# Auto generated code
import os, sys

home = os.path.expanduser("~")  # -> C:/Users/<username>
path = os.path.join(
    home,
    "Documents",
    "talos",
    "assets",
    "lib",
    "std_functs",
    "utility_functs"
)

if path not in sys.path:
    sys.path.append(path)

from read_write_temp import *


CURRENT = os.path.abspath(os.path.dirname(__file__))
T_O_P = os.path.abspath(os.path.join(CURRENT, "..", "..", "..", "out"))
os.makedirs(T_O_P, exist_ok=True)
OUTPUT_FILE = os.path.join(T_O_P, "keyboard_input_out.glob")

#--------------------------
from assets.lib.skills.Keyboard_Input.src.user_main import userMain

from skill_io import *

def main():

    keys = ["w", "a", "s", "d", "space"]
    print("Press some keys...")

    try:
        while True:
            keyboard_input_IP = KeyboardInput_IP()
            # keyboard_input_IP = readFromFile(...)
            keyboard_input_OP = userMain(keyboard_input_IP.keys)

            writeToFile(keyboard_input_OP, OUTPUT_FILE)

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()