

# def main():
#     inp = object_detector_IP()
#     #inp.image_path = os.path.join(os.path.dirname(__file__), "..", "test.jpg")
#     inp.image_path="C:/Users/prart/cpp_projects/SEMV/Skills/Object_Detector/src/tests.jpg"

#     result = userMain(inp)

#     print("Detections:")
#     for det in result.detections:
#         print(det)

#     print("\nAnnotated image saved at:", result.annotated_image_path)


# Auto generated code
import os, sys

home = os.path.expanduser("~")  # -> C:/Users/<username>
path = os.path.join(
    home,
    "Documents",
    "talos",
    "assets",
    "lib",
    "std_functs"
)

if path not in sys.path:
    sys.path.append(path)

from read_write_temp import *

CURRENT = os.path.abspath(os.path.dirname(__file__))
T_O_P = os.path.abspath(os.path.join(CURRENT, "..", "..", "..", "out"))
S_A_P = os.path.abspath(os.path.join(CURRENT, "..", "..", ".."))
os.makedirs(T_O_P, exist_ok=True)
CONF_FILE = os.path.join(S_A_P, "config.yaml")
OUTPUT_FILE = os.path.join(T_O_P, "object_detector_out.glob")

#--------------------------
from user_main import userMain

from skill_io import *

def main():

    try:
        while True:
            object_detector_IP_obj = object_detector_IP()
            input_descriptor =  [
    ("img_path", "v_out", "image_path", 1),
]
            object_detector_IP_obj = readFromFile(S_A_P, object_detector_IP_obj, input_descriptor) # temp_path -> /out i.e T_O_P for dynamic. If static, temp_path -> bot's config.yaml
            object_detector_OP_obj = userMain(object_detector_IP_obj)

            writeToFile(object_detector_OP_obj, OUTPUT_FILE, "object_detector")

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()