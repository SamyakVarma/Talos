import cv2
import os
from ultralytics import YOLO


class YOLODetector:
    def __init__(self, model_path="models/yolov8n.pt"):
        """
        model_path: Local path where model should be stored
        If not present, it will auto-download from ultralytics.
        """

        self.model_path = model_path
        self._ensure_model()

        # Load YOLO model
        self.model = YOLO(self.model_path)

    def _ensure_model(self):
        """
        Ensures the YOLO model exists locally.
        If not, downloads automatically.
        """
        model_dir = os.path.dirname(self.model_path)
        if model_dir and not os.path.exists(model_dir):
            os.makedirs(model_dir)

        if not os.path.exists(self.model_path):
            print(f"[INFO] Model not found. Downloading YOLO model to {self.model_path}...")
            YOLO(self.model_path)  # ultralytics auto-downloads to this path
            print("[INFO] Model downloaded successfully.")

    def run(self, image_path):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        # YOLO inference
        results = self.model(image_path)[0]

        detections = []
        for box in results.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].tolist()

            detections.append({
                "class": results.names[cls],
                "confidence": conf,
                "box": xyxy
            })

        # Save annotated image
        annotated = results.plot()
        save_path = os.path.join(os.path.dirname(image_path), "annotated.jpg")
        cv2.imwrite(save_path, annotated)

        return detections, save_path
