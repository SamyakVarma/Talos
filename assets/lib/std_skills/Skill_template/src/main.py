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

from read_write_temp import *

CURRENT = os.path.abspath(os.path.dirname(__file__))
T_O_P = os.path.abspath(os.path.join(CURRENT, "..", "..", "..", "out"))
S_A_P = os.path.abspath(os.path.join(CURRENT, "..", "..", ".."))
os.makedirs(T_O_P, exist_ok=True)
CONF_FILE = os.path.join(S_A_P, "config.yaml")
LOCAL_SKILL_ID = os.path.basename(S_A_P)
OUTPUT_FILE = os.path.join(T_O_P, f"{LOCAL_SKILL_ID}_out")

from user_main import userMain

from skill_io import readFromFile, WriteToFile

#--------------------------

def main():

    try:
        while True:
            {{skill_id}}_IP_obj = {{skill_id}}_IP()
            input_descriptor =  [(fromSkillID, fromAttributeID, toAttributeID, 0-> normal, 1-> static, 2-> utility, 3-> group_in), ...]
            {{skill_id}}_IP_obj = readFromFile(S_A_P, {{skill_id}}_IP_obj, input_descriptor) # temp_path -> /out i.e T_O_P for dynamic. If static, temp_path -> bot's config.yaml
            {{skill_id}}_OP_obj = userMain({{skill_id}}_IP_obj)

            writeToFile({{skill_id}}_OP_obj, OUTPUT_FILE, {{skill_id}})

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()