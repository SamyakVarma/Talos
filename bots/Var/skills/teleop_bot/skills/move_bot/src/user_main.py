# Skill description
#--------IMPORTS-------------#

#----------------------------

from skill_io import *

# def checkPress(key_list):
#     res = [keyboard.is_pressed(key) for key in key_list]
#     return res

x = 0
y = 0

def userMain(move_bot_IP_obj) -> move_bot_OP:
    global x, y
    #----------- Input unwrapping -----------#
    forw = move_bot_IP_obj.forw
    back = move_bot_IP_obj.back
    left = move_bot_IP_obj.left
    right = move_bot_IP_obj.right
    #----------------------------------------
    OP_obj = move_bot_OP()
    #----------- User-Driver Code -----------#
    res_x = x + (forw * 0.1 + back * -0.1)
    res_y = y + (right * 0.1 + left * -0.1)
    x = res_x
    y = res_y
    #----------------------------------------

    #-------- Output->Object wrapping -------#
    OP_obj.x = res_x
    OP_obj.y = res_y
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
