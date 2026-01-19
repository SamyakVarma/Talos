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
LOCAL_SKILL_ID = os.path.basename(os.path.abspath(os.path.join(CURRENT, "..")))
OUTPUT_FILE = os.path.join(T_O_P, f"{LOCAL_SKILL_ID}_out")

from user_main import userMain

from skill_io import *

#--------------------------

def main():

    try:
        while True:
            debug_IP_obj = debug_IP()
            # generate input descriptor
            input_descriptor =  [
    ("teleop_bot", "x", "d_in", 0),
]
            debug_IP_obj = readFromFile(S_A_P, debug_IP_obj, input_descriptor) # temp_path -> /out i.e T_O_P for dynamic. If static, temp_path -> bot's config.yaml
            debug_OP_obj = userMain(debug_IP_obj)

            writeToFile(debug_OP_obj, OUTPUT_FILE, "debug")

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()