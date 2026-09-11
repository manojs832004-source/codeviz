import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.*;

public class Tracer {
    private static final int MAX_STEPS = 500;
    private int stepCount = 0;
    private boolean truncated = false;
    private VirtualMachine vm;
    private List<String> states = new ArrayList<>();
    
    // To capture stdout, we will read from the Process input stream
    private InputStream processOut;
    private StringBuilder currentStdout = new StringBuilder();

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.err.println("Usage: java Tracer <MainClass>");
            System.exit(1);
        }
        String mainClass = args[0];
        new Tracer().run(mainClass);
    }

    private void run(String mainClass) throws Exception {
        LaunchingConnector launchingConnector = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> env = launchingConnector.defaultArguments();
        env.get("main").setValue(mainClass);
        // Important: set classpath so it finds the user's compiled Main.class
        env.get("options").setValue("-cp /out"); 
        
        vm = launchingConnector.launch(env);
        processOut = vm.process().getInputStream();
        OutputStream processIn = vm.process().getOutputStream();

        // Start a thread to pipe Tracer's System.in to the target VM's stdin
        Thread stdinWriter = new Thread(() -> {
            try {
                byte[] buffer = new byte[1024];
                int len;
                while ((len = System.in.read(buffer)) != -1) {
                    processIn.write(buffer, 0, len);
                    processIn.flush();
                }
            } catch (Exception e) {
                // Ignore
            } finally {
                try {
                    processIn.close();
                } catch (Exception e) {}
            }
        });
        stdinWriter.start();

        // Start a thread to continuously read the target VM's stdout
        Thread stdoutReader = new Thread(() -> {
            try {
                byte[] buffer = new byte[1024];
                int len;
                while ((len = processOut.read(buffer)) != -1) {
                    synchronized (currentStdout) {
                        currentStdout.append(new String(buffer, 0, len));
                    }
                }
            } catch (Exception e) {
                // Ignore
            }
        });
        stdoutReader.start();

        EventRequestManager erm = vm.eventRequestManager();

        ClassPrepareRequest classPrepareRequest = erm.createClassPrepareRequest();
        classPrepareRequest.addClassFilter(mainClass);
        classPrepareRequest.enable();

        EventQueue eventQueue = vm.eventQueue();
        boolean connected = true;

        while (connected) {
            EventSet eventSet = eventQueue.remove();
            for (Event event : eventSet) {
                if (event instanceof ClassPrepareEvent) {
                    ClassPrepareEvent classPrepareEvent = (ClassPrepareEvent) event;
                    ReferenceType refType = classPrepareEvent.referenceType();
                    // Set breakpoint at main method
                    List<Method> methods = refType.methodsByName("main");
                    if (!methods.isEmpty()) {
                        Location location = methods.get(0).location();
                        BreakpointRequest bpReq = erm.createBreakpointRequest(location);
                        bpReq.enable();
                    }
                } else if (event instanceof BreakpointEvent) {
                    BreakpointEvent bpEvent = (BreakpointEvent) event;
                    ThreadReference thread = bpEvent.thread();
                    // Enable stepping after hitting main
                    StepRequest stepRequest = erm.createStepRequest(thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
                    // Filter to only step through our mainClass, avoiding deep JVM/library methods
                    stepRequest.addClassFilter(mainClass + "*");
                    stepRequest.enable();
                } else if (event instanceof StepEvent) {
                    StepEvent stepEvent = (StepEvent) event;
                    handleStepEvent(stepEvent);
                    if (stepCount >= MAX_STEPS) {
                        truncated = true;
                        connected = false;
                        vm.exit(0); // Forcibly kill the target VM
                        break;
                    }
                } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                    connected = false;
                }
            }
            if (connected) {
                eventSet.resume();
            }
        }

        // Wait a tiny bit to flush final stdout
        Thread.sleep(50);
        
        // Output the JSON array of states
        System.out.println(buildJsonArray());
    }

    private void handleStepEvent(StepEvent event) {
        try {
            stepCount++;
            ThreadReference thread = event.thread();
            StackFrame frame = thread.frame(0);
            Location location = frame.location();
            
            int line = location.lineNumber();
            
            List<String> stack = new ArrayList<>();
            for (StackFrame f : thread.frames()) {
                stack.add(f.location().method().name());
            }
            
            Map<String, String> vars = new LinkedHashMap<>();
            Map<Long, String> heap = new LinkedHashMap<>();
            Set<Long> visited = new HashSet<>();
            
            try {
                List<LocalVariable> visibleVariables = frame.visibleVariables();
                Map<LocalVariable, Value> values = frame.getValues(visibleVariables);
                
                for (Map.Entry<LocalVariable, Value> entry : values.entrySet()) {
                    String name = entry.getKey().name();
                    Value value = entry.getValue();
                    vars.put(name, serializeValue(value, heap, visited));
                }
            } catch (AbsentInformationException e) {}
            
            String stdoutStr = "";
            synchronized (currentStdout) {
                if (currentStdout.length() > 0) {
                    stdoutStr = currentStdout.toString();
                    currentStdout.setLength(0);
                }
            }

            states.add(buildStateFrame(stepCount, line, stack, vars, heap, stdoutStr));
        } catch (IncompatibleThreadStateException ignored) {}
    }

    private String serializeValue(Value value, Map<Long, String> heap, Set<Long> visited) {
        if (value == null) return "{\"type\":\"primitive\", \"value\":null}";
        
        if (value instanceof PrimitiveValue) {
            String valStr = value.toString();
            if (value instanceof CharValue) valStr = "\"" + escapeJson(((CharValue) value).value() + "") + "\"";
            return "{\"type\":\"primitive\", \"value\":" + valStr + "}";
        }
        
        if (value instanceof StringReference) {
            return "{\"type\":\"primitive\", \"value\":\"" + escapeJson(((StringReference) value).value()) + "\"}";
        }
        
        if (value instanceof ObjectReference) {
            ObjectReference obj = (ObjectReference) value;
            String typeName = obj.referenceType().name();
            // Skip standard lib objects except LinkedList and Map implementations
            if ((typeName.startsWith("java.") || typeName.startsWith("sun.") || typeName.startsWith("jdk.")) 
                && !typeName.startsWith("java.util.LinkedList")
                && !typeName.startsWith("java.util.HashMap")
                && !typeName.startsWith("java.util.LinkedHashMap")
                && !typeName.startsWith("java.util.TreeMap")) {
                return "{\"type\":\"primitive\", \"value\":\"" + escapeJson(typeName + "@" + obj.uniqueID()) + "\"}";
            }
            
            long id = obj.uniqueID();
            String refStr = "ref:" + id;
            if (visited.contains(id)) {
                return "{\"type\":\"reference\", \"pointsTo\":\"" + refStr + "\"}";
            }
            visited.add(id);
            
            if (obj instanceof ArrayReference) {
                ArrayReference arr = (ArrayReference) obj;
                StringBuilder arrSb = new StringBuilder();
                arrSb.append("{\"type\":\"array\", \"value\":[");
                List<Value> elements = arr.getValues();
                int max = Math.min(elements.size(), 50);
                for (int i = 0; i < max; i++) {
                    arrSb.append(serializeValue(elements.get(i), heap, visited));
                    if (i < max - 1) arrSb.append(", ");
                }
                arrSb.append("]}");
                heap.put(id, arrSb.toString());
            } else {
                StringBuilder objSb = new StringBuilder();
                objSb.append("{\"type\":\"object\", \"className\":\"").append(escapeJson(typeName)).append("\", \"fields\":{");
                List<Field> fields = obj.referenceType().allFields();
                boolean firstField = true;
                for (Field f : fields) {
                    if (f.isStatic()) continue;
                    if (!firstField) objSb.append(", ");
                    objSb.append("\"").append(escapeJson(f.name())).append("\": ");
                    objSb.append(serializeValue(obj.getValue(f), heap, visited));
                    firstField = false;
                }
                objSb.append("}}");
                heap.put(id, objSb.toString());
            }
            
            return "{\"type\":\"reference\", \"pointsTo\":\"" + refStr + "\"}";
        }
        
        return "{\"type\":\"primitive\", \"value\":\"" + escapeJson(value.toString()) + "\"}";
    }

    private String buildStateFrame(int step, int line, List<String> stack, Map<String, String> vars, Map<Long, String> heap, String stdout) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"step\": ").append(step).append(", ");
        sb.append("\"line\": ").append(line).append(", ");
        
        sb.append("\"stack\": [");
        for (int i = 0; i < stack.size(); i++) {
            sb.append("\"").append(escapeJson(stack.get(i))).append("\"");
            if (i < stack.size() - 1) sb.append(", ");
        }
        sb.append("], ");
        
        sb.append("\"variables\": {");
        int count = 0;
        for (Map.Entry<String, String> var : vars.entrySet()) {
            sb.append("\"").append(escapeJson(var.getKey())).append("\": ").append(var.getValue());
            count++;
            if (count < vars.size()) sb.append(", ");
        }
        sb.append("}, ");
        
        sb.append("\"heap\": {");
        count = 0;
        for (Map.Entry<Long, String> entry : heap.entrySet()) {
            sb.append("\"ref:").append(entry.getKey()).append("\": ").append(entry.getValue());
            count++;
            if (count < heap.size()) sb.append(", ");
        }
        sb.append("}, ");
        
        sb.append("\"stdout\": \"").append(escapeJson(stdout)).append("\"");
        sb.append("}");
        return sb.toString();
    }

    private String buildJsonArray() {
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");
        for (int i = 0; i < states.size(); i++) {
            sb.append("  ").append(states.get(i));
            if (i < states.size() - 1 || truncated) {
                sb.append(",");
            }
            sb.append("\n");
        }
        if (truncated) {
            sb.append("  {\"truncated\": true}\n");
        }
        sb.append("]");
        return sb.toString();
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\b", "\\b")
                  .replace("\f", "\\f")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
}