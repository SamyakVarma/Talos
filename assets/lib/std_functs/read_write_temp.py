import os
import io
import json
import yaml
import time
import hashlib
import queue
import threading
import importlib.util
import re

try:
    import numpy as np
except ImportError:
    np = None

try:
    from PIL import Image
except ImportError:
    Image = None

WRITE_THREADS = 4
_last_write_hash = None
_write_threads = []

MAX_INLINE_SIZE = 2048  # bytes - anything larger gets externalized
LIST_DICT_LENGTH_THRESHOLD = 64  # tuneable


def _hash_data(obj):
    return hashlib.md5(json.dumps(obj, sort_keys=True).encode("utf-8")).hexdigest()

def safe_replace(tmp, final):
    for _ in range(20):  # retry for ~200ms
        try:
            os.replace(tmp, final)
            return
        except PermissionError:
            time.sleep(0.01)
    raise


def _safe_type(value):
    if isinstance(value, bool): return "bool"
    if isinstance(value, int): return "int"
    if isinstance(value, float): return "float"
    if isinstance(value, str): return "string"
    if isinstance(value, (bytes, bytearray)): return "binary"
    if isinstance(value, dict): return "dict"
    if isinstance(value, list): return "list"
    if np is not None and isinstance(value, np.ndarray): return "ndarray"
    if Image is not None and isinstance(value, Image.Image): return "image"
    return "unknown"

def needs_external_storage(value):
    # bytes / bytearray
    if isinstance(value, (bytes, bytearray)):
        return len(value) > MAX_INLINE_SIZE

    # strings (fast check using character length; good enough)
    if isinstance(value, str):
        return len(value) > MAX_INLINE_SIZE

    # lists / dicts – structural heuristic (fast)
    if isinstance(value, list):
        return len(value) > LIST_DICT_LENGTH_THRESHOLD
    if isinstance(value, dict):
        return len(value) > LIST_DICT_LENGTH_THRESHOLD

    # images and numpy arrays always externalize
    if Image is not None and isinstance(value, Image.Image):
        return True
    if np is not None and isinstance(value, np.ndarray):
        return True

    return False


_write_queue = queue.Queue()
_stop_event = threading.Event()
def _blob_writer():
    while not _stop_event.is_set():
        try:
            blob_path, data_bytes = _write_queue.get(timeout=0.1)
        except queue.Empty:
            continue
        try:
            os.makedirs(os.path.dirname(blob_path), exist_ok=True)
            with open(blob_path, "wb", buffering=8192) as bf:
                bf.write(data_bytes)
        except Exception as e:
            print(f"[write_worker] Error writing {blob_path}: {e}")
        finally:
            _write_queue.task_done()

# Start fixed workers
for _ in range(WRITE_THREADS):
    t = threading.Thread(target=_blob_writer, daemon=True)
    t.start()

def shutdown_writers():
    """Call this at program exit to flush and stop writers."""
    _write_queue.join()
    _stop_event.set()

#ENCODE
def encode_pil_image(img):
    """Encode PIL image to PNG bytes."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), "png"


def encode_numpy_array(arr):
    """Encode numpy/OpenCV array into PNG when possible, otherwise produce raw bytes and metadata."""
    # Try OpenCV encoding to PNG for visual arrays
    try:
        import cv2
        ok, buf = cv2.imencode(".png", arr)
        if ok:
            return buf.tobytes(), "png"
    except Exception:
        pass

    # Fallback: store raw bytes, but caller must also store shape/dtype
    return arr.tobytes(), "raw"

EXT_MAP = {
    "png": "png",
    "json": "json",
    "utf8": "txt",
    "bin": "bin",
    "raw": "raw"
}

def parse_output_index(attr_name: str):
    m = re.search(r"<(\d+)>", attr_name)
    if m:
        return max(0, int(m.group(1)) - 1)
    return 0

def readFromFile(skill_root, IP_obj, input_descriptor): # input_descriptor: [(fromSkillID, fromAttributeID, toAttributeID), ...]
    out_root = os.path.join(skill_root, "out")
    conf_path = os.path.join(skill_root, "config.yaml")
    graph_path = os.path.join(skill_root, "skillgraph.json")
    static_values = {}
    if os.path.exists(conf_path):
        with open(conf_path, "r") as f:
            conf = yaml.safe_load(f) or {}
            for a in conf.get("globals", {}).get("attributes", []):
                static_values[a["id"]] = a.get("value")

    if os.path.exists(graph_path):
        with open(graph_path, "r") as g:
            graph = json.load(g)
        nodes_map = {n["id"]: n for n in graph["nodes"]}
        conn_map = {}
        for c in graph["edges"]:
            conn_map.setdefault(c["toSkillId"], []).append(c)
    else:
        nodes_map = {}
        conn_map = {}

    def resolve_utility_in(util_node_id, from_attr, to_attr):

        util_node = nodes_map.get(util_node_id)
        if util_node is None:
            raise ValueError(f"Utility node '{util_node_id}' not found in graph")

        util_path = os.path.join(os.path.expanduser("~"), "Documents", "talos", "assets",
                                 "lib", "utility_functs")
        skill_dir = os.path.join(util_path, util_node_id)
        config_path = os.path.join(skill_dir, "config.yaml")
        script_path = os.path.join(skill_dir, "script.py")

        # Load utility config
        with open(config_path, "r") as f:
            conf = yaml.safe_load(f)

        entry = conf.get("entry")
        if not entry:
            raise ValueError(f"Utility {util_node_id} has no entry point")

        resolved_inputs = []

        # For each utility input, find its source
        for inp in util_node.get("inputs", []):
            inp_id = inp["id"]

            connections = conn_map.get(util_node_id, [])
            connection_found = False

            for edge in connections:
                if edge["toPortId"] != inp_id:
                    continue

                connection_found = True
                src_node_id = edge["fromSkillId"]
                src_attr_id = edge["fromPortId"]

                src_node = nodes_map.get(src_node_id)
                src_type = src_node["skillType"]

                # CASE 1: static
                if src_type == "static_attribute":
                    val = static_values.get(f"{src_node_id}_{src_attr_id}")
                    resolved_inputs.append(val)

                # CASE 2: utility → utility
                elif src_type == "utility_functions":
                    val = resolve_utility_in(src_node_id, src_attr_id, inp_id)
                    resolved_inputs.append(val)

                # CASE 3: normal skill output
                else:
                    temp = type("Tmp", (), {})()
                    readFromFile(skill_root, temp, [
                        (src_node_id, src_attr_id, src_attr_id, 0)
                    ])
                    resolved_inputs.append(getattr(temp, src_attr_id))

            if not connection_found:
                raise ValueError(f"No input source for utility: {util_node_id}.{inp_id}")

        # --------------------------------------------------
        # Run the utility function
        # --------------------------------------------------
        spec = importlib.util.spec_from_file_location(util_node_id, script_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        func = getattr(mod, entry)
        out_idx = parse_output_index(from_attr)

        return func(resolved_inputs, out_idx)

    for from_skill, from_attr, to_attr, is_static in input_descriptor:
        value = None

        if is_static == 2:
            value = resolve_utility_in(from_skill, from_attr, to_attr)       
        elif is_static == 1:
            value = static_values.get(from_skill+'_'+from_attr)
        else:
            skill_dir = os.path.join(out_root, from_skill)
            json_path = os.path.join(skill_dir, "output.json")

            if not os.path.exists(json_path):
                print(f"[readFromFile] Missing: {json_path}")
                continue

            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    env = json.load(f)

                attr_meta = env["attributes"].get(from_attr)
                if not attr_meta:
                    continue

                if attr_meta["storage"] == "inline":
                    value = attr_meta.get("value")

                elif attr_meta["storage"] == "file":
                    blob_path = os.path.join(skill_dir, attr_meta["path"])
                    if not os.path.exists(blob_path):
                        print(f"[readFromFile] Missing blob: {blob_path}")
                        continue

                    with open(blob_path, "rb") as bf:
                        blob_bytes = bf.read()

                    fmt = attr_meta.get("format")
                    declared_type = attr_meta.get("type")  # "ndarray" or "image" if applicable

                    # JSON (strings/lists/dicts)
                    if fmt == "json":
                        try:
                            value = json.loads(blob_bytes.decode("utf-8"))
                        except Exception:
                            value = blob_bytes

                    # UTF-8 string
                    elif fmt == "utf8":
                        try:
                            value = blob_bytes.decode("utf-8")
                        except Exception:
                            value = blob_bytes

                    # PNG: decide whether to return ndarray or PIL.Image based on declared_type
                    elif fmt == "png":
                        shape = attr_meta.get("shape")
                        dtype_str = attr_meta.get("dtype")
                        if declared_type == "ndarray" and np is not None:
                            try:
                                # Try cv2 first (fast) then PIL->np array fallback
                                try:
                                    import cv2
                                    arr = np.frombuffer(blob_bytes, dtype=np.uint8)
                                    decoded = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
                                    if decoded is not None:
                                        value = decoded
                                        # ensure we have a numeric array; continue
                                        continue
                                except Exception:
                                    pass

                                # Fallback: PIL -> numpy
                                if Image is not None:
                                    img = Image.open(io.BytesIO(blob_bytes))
                                    img.load()
                                    value = np.array(img)
                                else:
                                    # no Image; return raw bytes
                                    value = blob_bytes
                                continue
                            except Exception:
                                value = blob_bytes
                                continue

                        # If producer declared "image" or declared_type unknown, prefer PIL Image when available
                        if Image is not None:
                            try:
                                img = Image.open(io.BytesIO(blob_bytes))
                                img.load()
                                value = img
                                continue
                            except Exception:
                                pass

                        # If numpy exists and PIL not available, decode to numpy via cv2 if possible
                        if np is not None:
                            try:
                                import cv2
                                arr = np.frombuffer(blob_bytes, dtype=np.uint8)
                                decoded = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
                                if decoded is not None:
                                    value = decoded
                                    continue
                            except Exception:
                                pass

                        # fallback to raw bytes
                        value = blob_bytes

                    # Raw ndarray fallback -> must have shape and dtype metadata to reconstruct
                    elif fmt == "raw" and np is not None:
                        shape = attr_meta.get("shape")
                        dtype_str = attr_meta.get("dtype")
                        if shape is not None and dtype_str is not None:
                            try:
                                dtype = np.dtype(dtype_str)
                                arr = np.frombuffer(blob_bytes, dtype=dtype).reshape(tuple(shape))
                                value = arr
                            except Exception:
                                # can't reconstruct, fallback to bytes
                                value = blob_bytes
                        else:
                            # no metadata -> return raw bytes
                            value = blob_bytes

                    # Binary fallback
                    else:
                        value = blob_bytes

            except Exception as e:
                print(f"[readFromFile] Error reading {json_path}: {e}")

        if hasattr(IP_obj, to_attr):
            setattr(IP_obj, to_attr, value)
        else:
            print(f"[readFromFile] Warning: {type(IP_obj).__name__} has no '{to_attr}'")
    return IP_obj
    
def writeToFile(data_obj, out_dir, skill_id):
    """Fast non-blocking writer; large data goes through background pool."""
    global _last_write_hash

    current_hash = _hash_data(vars(data_obj))
    if current_hash == _last_write_hash:
        return
    _last_write_hash = current_hash

    os.makedirs(out_dir, exist_ok=True)
    tmp_json = os.path.join(out_dir, "output.tmp")
    final_json = os.path.join(out_dir, "output.json")

    envelope = {"skill_id": skill_id, "timestamp": time.time(), "attributes": {}}

    for name, value in vars(data_obj).items():
        if value is None:
            continue

        entry = {"type": _safe_type(value)}
        externalize = needs_external_storage(value)

        if externalize:
            safe_name = name.replace(" ", "_")
            blob_ext = "bin"

            if Image is not None and isinstance(value, Image.Image):
                data_bytes, fmt = encode_pil_image(value)
                entry["format"] = fmt
                blob_ext = EXT_MAP.get(fmt, "bin")

            elif np is not None and isinstance(value, np.ndarray):
                data_bytes, fmt = encode_numpy_array(value)
                entry["format"] = fmt
                blob_ext = EXT_MAP.get(fmt, "bin")
                entry["shape"] = list(value.shape)
                entry["dtype"] = str(value.dtype)

            elif isinstance(value, (dict, list)):
                data_bytes = json.dumps(value).encode("utf-8")
                entry["format"] = "json"
                blob_ext = EXT_MAP["json"]

            elif isinstance(value, str):
                data_bytes = value.encode("utf-8")
                entry["format"] = "utf8"
                blob_ext = EXT_MAP["utf8"]

            else:
                if isinstance(value, (bytes, bytearray)):
                    data_bytes = bytes(value)
                else:
                    try:
                        data_bytes = json.dumps(value).encode("utf-8")
                        entry["format"] = "json"
                        blob_ext = EXT_MAP["json"]
                    except Exception:
                        data_bytes = repr(value).encode("utf-8")
                        entry["format"] = "utf8"
                        blob_ext = EXT_MAP["utf8"]

            blob_name = f"{safe_name}.{blob_ext}"
            entry["path"] = blob_name
            entry["storage"] = "file"

            blob_path = os.path.join(out_dir, blob_name)
            _write_queue.put((blob_path, data_bytes))  # enqueue write

        else:
            entry["storage"] = "inline"
            entry["value"] = value

        envelope["attributes"][name] = entry

    # Atomic JSON write
    with open(tmp_json, "w", encoding="utf-8", buffering=8192) as f:
        json.dump(envelope, f, separators=(",", ":"))
    safe_replace(tmp_json, final_json)

    # print(f"[writeToFile] wrote {json_path}")