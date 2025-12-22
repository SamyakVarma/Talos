class object_detector_IP:
    def __init__(self):
        self.image_path: str = ""


class object_detector_OP:
    def __init__(self):
        self.detections = []  # [{class, conf, box}, ...]
        # self.annotated_image_path = ""
