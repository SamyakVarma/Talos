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
OUTPUT_FILE = os.path.join(T_O_P, "Keyboard_Input__0_out")

#--------------------------
from user_main import userMain

from skill_io import *

def main():

    try:
        while True:
            Keyboard_Input_IP_obj = Keyboard_Input_IP()
            input_descriptor = [
    ("value__0", "v_out", "keys", 1),
] #[(fromSkillID, fromAttributeID, toAttributeID, isStatic? 1:0), ...]
            Keyboard_Input_IP_obj = readFromFile(S_A_P, Keyboard_Input_IP_obj, input_descriptor)
            Keyboard_Input_OP_obj = userMain(Keyboard_Input_IP_obj)

            writeToFile(Keyboard_Input_OP_obj, OUTPUT_FILE, "Keyboard_Input")

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()