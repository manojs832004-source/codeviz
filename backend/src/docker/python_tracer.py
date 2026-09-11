import sys
import json
import time
import contextlib
import io
import linecache
import ast

MAX_STEPS = 500
MAX_TIME_SEC = 5.0

def ast_to_str(node):
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Subscript):
        return f"{ast_to_str(node.value)}[{ast_to_str(node.slice)}]"
    elif isinstance(node, ast.Index):
        return ast_to_str(node.value)
    elif isinstance(node, ast.Constant):
        return str(node.value)
    elif isinstance(node, ast.BinOp):
        return f"{ast_to_str(node.left)} op {ast_to_str(node.right)}"
    return "expression"

def generate_explanation(line_code, locals_dict):
    line_code = line_code.strip()
    if not line_code:
        return ""
        
    try:
        tree = ast.parse(line_code)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                    target = node.targets[0].id
                    try:
                        val = eval(compile(ast.Expression(node.value), '<string>', 'eval'), {}, locals_dict)
                        return f"Assigning the value {val} to the variable '{target}'."
                    except:
                        return f"Assigning a value to '{target}'."
                elif isinstance(node.targets[0], ast.Tuple):
                    return f"Swapping multiple values simultaneously."
            elif isinstance(node, ast.Compare):
                try:
                    left_val = eval(compile(ast.Expression(node.left), '<string>', 'eval'), {}, locals_dict)
                    right_val = eval(compile(ast.Expression(node.comparators[0]), '<string>', 'eval'), {}, locals_dict)
                    op = type(node.ops[0]).__name__
                    
                    op_str = "compared to"
                    if op == "Gt": op_str = "greater than"
                    elif op == "Lt": op_str = "less than"
                    elif op == "Eq": op_str = "equal to"
                    elif op == "GtE": op_str = "greater than or equal to"
                    elif op == "LtE": op_str = "less than or equal to"
                    
                    left_name = ast_to_str(node.left)
                    right_name = ast_to_str(node.comparators[0])
                    
                    return f"{left_name} is {left_val} and {right_name} is {right_val}. Checking if {left_val} is {op_str} {right_val}."
                except:
                    pass
    except Exception:
        pass
        
    return f"Executing: {line_code}"

class Tracer:
    def __init__(self, target_module_name):
        self.step_count = 0
        self.start_time = time.time()
        self.target_module_name = target_module_name
        self.truncated = False
        self.states = []
        self.stdout_capture = io.StringIO()
        self.accumulated_stdout = ""
        self.call_stack = []
        
    def trace_calls(self, frame, event, arg):
        if frame.f_globals.get("__name__") == self.target_module_name:
            if event == "call":
                self.call_stack.append({
                    "name": frame.f_code.co_name + "()",
                    "frame": frame
                })
                return self.trace_lines
        return None

    def trace_lines(self, frame, event, arg):
        if event == "return":
            if self.call_stack and self.call_stack[-1]["frame"] == frame:
                self.call_stack.pop()
            return self.trace_lines
            
        if event != "line":
            return self.trace_lines
            
        line_code = linecache.getline(frame.f_code.co_filename, frame.f_lineno).strip()
        if line_code.startswith("def ") or line_code.startswith("class "):
            return self.trace_lines
            
        self.step_count += 1
        
        if self.step_count > MAX_STEPS or (time.time() - self.start_time) > MAX_TIME_SEC:
            self.truncated = True
            sys.settrace(None)
            return None
            
        self.capture_state(frame, event, line_code)
        return self.trace_lines

    def capture_state(self, frame, event, line_code):
        heap = {}
        locals_refs = {}
        
        vars_dict = {}
        # Globals
        for k, v in frame.f_globals.items():
            if not k.startswith("__") and k != self.target_module_name:
                vars_dict[k] = v
        # Locals (override globals if same name)
        for k, v in frame.f_locals.items():
            if not k.startswith("__"):
                vars_dict[k] = v
                
        # Serialize locals
        for k, v in vars_dict.items():
            if v is None or isinstance(v, (int, float, str, bool)):
                locals_refs[k] = {"type": "primitive", "value": v}
            else:
                ref = self.serialize_to_heap(v, heap)
                locals_refs[k] = {"type": "reference", "pointsTo": ref}
            
        # Build serializable stack
        stack = []
        if not self.call_stack:
            stack.append({
                "name": "<module>",
                "locals": locals_refs
            })
        else:
            for i, sf in enumerate(self.call_stack):
                stack.append({
                    "name": sf["name"],
                    "locals": locals_refs if i == len(self.call_stack) - 1 else {}
                })
            
        explanation = generate_explanation(line_code, vars_dict)
        
        # Accumulate stdout — read new output and append to running total
        new_output = self.stdout_capture.getvalue()
        if new_output:
            self.accumulated_stdout += new_output
            self.stdout_capture.truncate(0)
            self.stdout_capture.seek(0)
            
        state = {
            "step": self.step_count,
            "line": frame.f_lineno,
            "stack": stack[::-1],  # frontend expects [activeFrame, caller, caller]
            "heap": heap,
            "stdout": self.accumulated_stdout,
            "actionExplanation": explanation
        }
        self.states.append(state)

    def serialize_to_heap(self, obj, heap, visited=None):
        if visited is None:
            visited = set()
            
        obj_id = hex(id(obj))
        
        if obj_id in heap or obj_id in visited:
            return obj_id
            
        visited.add(obj_id)
        
        if obj is None or isinstance(obj, (int, float, str, bool)):
            heap[obj_id] = {"type": "primitive", "value": obj}
            return obj_id
            
        if isinstance(obj, (list, tuple, set)):
            val_refs = []
            heap[obj_id] = {"type": "array", "value": val_refs} 
            for item in obj:
                if item is None or isinstance(item, (int, float, str, bool)):
                    val_refs.append(item)
                else:
                    item_ref = self.serialize_to_heap(item, heap, visited)
                    val_refs.append(item_ref)
            return obj_id
            
        heap[obj_id] = {"type": "object", "className": type(obj).__name__, "fields": {}}
        
        fields = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                fields[str(k)] = v
        elif hasattr(obj, "__dict__"):
            for k, v in obj.__dict__.items():
                if not k.startswith("__"):
                    fields[str(k)] = v
                    
        for k, v in fields.items():
            if v is None or isinstance(v, (int, float, str, bool)):
                heap[obj_id]["fields"][k] = {"type": "primitive", "value": v}
            else:
                item_ref = self.serialize_to_heap(v, heap, visited)
                heap[obj_id]["fields"][k] = {"type": "reference", "pointsTo": item_ref}
                
        return obj_id

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
        
    script_path = sys.argv[1]
    
    with open(script_path, "r") as f:
        code = f.read()
        
    tracer = Tracer("__main__")
    
    with contextlib.redirect_stdout(tracer.stdout_capture):
        sys.settrace(tracer.trace_calls)
        try:
            exec(code, {"__name__": "__main__"})
        except Exception as e:
            print(f"Exception: {e}")
        finally:
            sys.settrace(None)
    
    # Flush any remaining stdout into the last state frame
    # (print() on the last line fires AFTER the trace step captured state)
    remaining = tracer.stdout_capture.getvalue()
    if remaining and tracer.states:
        tracer.accumulated_stdout += remaining
        tracer.states[-1]["stdout"] = tracer.accumulated_stdout
            
    if tracer.truncated:
        tracer.states.append({"truncated": True})
            
    sys.__stdout__.write(json.dumps(tracer.states))
    sys.__stdout__.flush()