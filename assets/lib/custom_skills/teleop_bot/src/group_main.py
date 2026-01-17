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
)

if path not in sys.path:
    sys.path.append(path)

from read_write_temp import readFromFile, writeToFile


CURRENT = os.path.abspath(os.path.dirname(__file__))
T_O_P = os.path.abspath(os.path.join(CURRENT, "..", "..", "..", "out"))
S_A_P = os.path.abspath(os.path.join(CURRENT, "..", "..", ".."))
os.makedirs(T_O_P, exist_ok=True)
# Define for input files.. might have to read multiple out files based on attributes being connected.
# read from /out if dynamic attribute is being read. If static attribute is used read from bot's config.yaml
GROUP_ROOT_PATH = os.path.abspath(os.path.join(CURRENT, ".."))
# only 1 output file.
PARENT_SKILL_ID = os.path.basename(os.path.abspath(os.path.join(CURRENT, "..")))
OUTPUT_FILE = os.path.join(T_O_P, f"{PARENT_SKILL_ID}_out")

#--------------------------

from skill_io import *

def main():

    try:
        while True:
            teleop_bot_OP_obj = teleop_bot_OP()
            output_descriptor = [
    ("move_bot", "x", "x", 0),
    ("move_bot", "y", "y", 0),
] #[(fromSkillID, fromAttributeID, toAttributeID, isStatic? 1:0), ...]
            teleop_bot_OP_obj = readFromFile(GROUP_ROOT_PATH, teleop_bot_OP_obj, output_descriptor)
            writeToFile(teleop_bot_OP_obj, OUTPUT_FILE, "teleop_bot")

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()