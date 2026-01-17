# Skill description
#--------IMPORTS-------------#
# import <library>
#----------------------------

from skill_io import *

def userMain(debug_IP_obj) -> debug_OP:
    #----------- Input unwrapping -----------#
    param1 = debug_IP_obj.d_in
     #----------------------------------------
    OP_obj = debug_OP()
    #----------- User-Driver Code -----------#
    print(param1)
    #----------------------------------------

    #-------- Output->Object wrapping -------#

    #----------------------------------------
    return OP_obj