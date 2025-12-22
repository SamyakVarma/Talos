
# from object_detector import YOLODetector
# import os

# # Load YOLO model
# MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "yolov8n.pt")
# detector = YOLODetector(MODEL_PATH)


# def userMain(input_obj):
#     out = object_detector_OP()

#     detections, annotated_path = detector.run(input_obj.image_path)
    
#     out.detections = detections
#     out.annotated_image_path = annotated_path

#     return out
# Skill description
#--------IMPORTS-------------#
from object_detector import YOLODetector
import os
#----------------------------

from skill_io import *

def userMain(object_detector_IP_obj) -> object_detector_OP:
    #----------- Input unwrapping -----------#
    param1 = object_detector_IP_obj.image_path

     #----------------------------------------
    OP_obj = object_detector_OP()
    #----------- User-Driver Code -----------#
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "yolov8n.pt")
    detector = YOLODetector(MODEL_PATH)
    detections, annotated_path = detector.run(param1)
    #----------------------------------------

    #-------- Output->Object wrapping -------#
    OP_obj.detections = detections
    OP_obj.annotated_image_path = annotated_path
    #----------------------------------------
    return OP_obj
