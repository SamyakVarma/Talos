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
CONF_FILE = os.path.join(S_A_P, "config.yaml")
# only 1 output file.
OUTPUT_FILE = os.path.join(T_O_P, "move_bot_out")

#--------------------------
from user_main import userMain

from skill_io import *

def main():

    try:
        while True:
            move_bot_IP_obj = move_bot_IP()
            input_descriptor = [
                ("separate_list__0", "list_out<1>", "forw", 2),
                ("separate_list__0", "list_out<2>", "left", 2),
                ("separate_list__0", "list_out<3>", "back", 2),
                ("separate_list__0", "list_out<4>", "right", 2)
] #[(fromSkillID, fromAttributeID, toAttributeID, isStatic? 1:0), ...]
            move_bot_IP_obj = readFromFile(S_A_P, move_bot_IP_obj, input_descriptor)
            move_bot_OP_obj = userMain(move_bot_IP_obj)

            writeToFile(move_bot_OP_obj, OUTPUT_FILE, "move_bot")

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()