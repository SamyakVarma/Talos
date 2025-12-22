# Skill description
#--------IMPORTS-------------#
import keyboard
#----------------------------

from skill_io import *

# def checkPress(key_list):
#     res = [keyboard.is_pressed(key) for key in key_list]
#     return res

def userMain(Keyboard_Input_IP_obj) -> Keyboard_Input_OP:
    #----------- Input unwrapping -----------#
    key_list = Keyboard_Input_IP_obj.keys
    #----------------------------------------
    OP_obj = Keyboard_Input_OP()
    #----------- User-Driver Code -----------#
    res =  [keyboard.is_pressed(key) for key in key_list]
    #----------------------------------------

    #-------- Output->Object wrapping -------#
    OP_obj.pressed = res
    #----------------------------------------
    
    return OP_obj


# # Example usage:
# if __name__ == "__main__":
#     keys = ["a", "b", "space", "ctrl", "shift"]
#     print("Press some keys...")

#     try:
#         while True:
#             states = checkPress(keys)
#             print(dict(zip(keys, states)))
#     except KeyboardInterrupt:
#         print("\nStopped.")
