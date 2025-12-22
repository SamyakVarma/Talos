#take in keystrokes, give out boolean values for each key given in the function's parameter as a list.
import keyboard

from skill_io import *

def userMain(key_list) -> KeyboardInput_OP:
    OP_obj = KeyboardInput_OP()
    OP_obj.pressed = [keyboard.is_pressed(key) for key in key_list]
    return OP_obj


# # Example usage:
# if __name__ == "__main__":
#     keys = ["a", "b", "space", "ctrl", "shift"]
#     print("Press some keys...")

#     try:
#         while True:
#             states = keys_pressed(keys)
#             print(dict(zip(keys, states)))
#     except KeyboardInterrupt:
#         print("\nStopped.")
