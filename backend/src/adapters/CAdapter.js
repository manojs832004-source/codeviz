const BaseLanguageAdapter = require('./AdapterInterface');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { getSecurityFlags } = require('../docker/security');

class CAdapter extends BaseLanguageAdapter {
  constructor() {
    super();
    this.tempDir = null;
    this.code = '';
    this.gdbProcess = null;
  }

  getLanguage() {
    return 'c';
  }

  async prepare(code) {
    this.code = code;
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'c-run-'));
    const filePath = path.join(this.tempDir, 'main.c');
    await fs.writeFile(filePath, code);

    // Compile the code
    const securityFlags = getSecurityFlags().join(' ');
    const mountFlag = `-v "${this.tempDir}:/app"`;
    const compileCmd = `docker run --rm ${securityFlags} ${mountFlag} c-sandbox gcc -g -O0 -o /app/prog /app/main.c`;
    
    await new Promise((resolve, reject) => {
      exec(compileCmd, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Compilation failed:\n${stderr || stdout || error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async *execute(options) {
    const securityFlags = getSecurityFlags().join(' ');
    const mountFlag = `-v "${this.tempDir}:/app"`;
    
    this.containerName = `c-sandbox-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Spawn GDB in MI mode
    this.gdbProcess = spawn('docker', [
      'run', '-i', '--rm', '--name', this.containerName, ...getSecurityFlags(), 
      '-v', `${this.tempDir}:/app`, 
      'c-sandbox', 
      'gdb', '--interpreter=mi2', '/app/prog'
    ]);

    let buffer = '';
    let responseQueue = [];
    let waitingForPrompt = null;
    let isRunning = true;

    this.gdbProcess.stderr.on('data', (data) => {
      console.log("[GDB STDERR]", data.toString());
    });

    this.gdbProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log("[GDB STDOUT]", JSON.stringify(dataStr));
      
      buffer += dataStr;
      let lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      
      for (const line of lines) {
        responseQueue.push(line);
        if (line.startsWith('(gdb)')) {
          if (waitingForPrompt) {
            const linesToReturn = [...responseQueue];
            responseQueue = [];
            waitingForPrompt(linesToReturn);
          }
        }
      }
      
      if (buffer.startsWith('(gdb)')) {
        responseQueue.push(buffer);
        buffer = '';
        if (waitingForPrompt) {
          const linesToReturn = [...responseQueue];
          responseQueue = [];
          waitingForPrompt(linesToReturn);
        }
      }
    });

    // Helper to send MI command and wait for (gdb) prompt
    const sendCmd = (cmd, waitForStopped = false) => {
      return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject(new Error("GDB command timeout: " + cmd));
        }, 15000);
        waitingForPrompt = (lines) => {
          if (waitForStopped) {
            const hasStopped = lines.find(l => safeStr(l) && l.startsWith('*stopped'));
            if (!hasStopped) {
               // We saw (gdb) but no *stopped yet. Keep waiting, put lines back so we don't lose them
               responseQueue.push(...lines);
               return; 
            }
          }
          clearTimeout(timeout);
          waitingForPrompt = null;
          resolve(lines);
        };
        try {
          this.gdbProcess.stdin.write(cmd + '\n');
        } catch (err) {
          clearTimeout(timeout);
          waitingForPrompt = null;
          reject(err);
        }
      });
    };
    
    this.gdbProcess.on('error', (err) => {
      console.error("gdbProcess error:", err);
      if (waitingForPrompt) {
         waitingForPrompt([{error: err.message}]); // Resolve with error line to prevent hanging
         waitingForPrompt = null;
      }
    });
    
    this.gdbProcess.on('exit', (code) => {
      if (waitingForPrompt) {
         waitingForPrompt([{error: "Process exited with code " + code}]);
         waitingForPrompt = null;
      }
    });

    // Helper to safely check if a line is a string before calling startsWith/includes
    const safeStr = (l) => typeof l === 'string';

    // Helper to extract values using regex from a ^done MI string
    const extractVariables = (lines) => {
      try {
        const doneLine = lines.find(l => safeStr(l) && l.startsWith('^done,variables='));
        if (!doneLine) return [];
        
        const vars = [];
        const regex = /name="([^"]+)",value="((?:[^"\\]|\\.)*?)"/g;
        let match;
        while ((match = regex.exec(doneLine)) !== null) {
          vars.push({ name: match[1], value: match[2].replace(/\\"/g, '"') });
        }
        return vars;
      } catch (e) {
        console.error('extractVariables error:', e);
        return [];
      }
    };
    
    const extractFrameLine = (lines) => {
      try {
        const frameLine = lines.find(l => safeStr(l) && (l.startsWith('^done,frame=') || (l.startsWith('*stopped') && l.includes('frame='))));
        if (!frameLine) return -1;
        const match = /line="(\d+)"/.exec(frameLine);
        return match ? parseInt(match[1], 10) : -1;
      } catch (e) {
        return -1;
      }
    };
    
    const extractFrameName = (lines) => {
      try {
        const frameLine = lines.find(l => safeStr(l) && (l.startsWith('^done,frame=') || (l.startsWith('*stopped') && l.includes('frame='))));
        if (!frameLine) return "unknown()";
        const match = /func="([^"]+)"/.exec(frameLine);
        return match ? match[1] + "()" : "unknown()";
      } catch (e) {
        return "unknown()";
      }
    };

    const extractFullname = (lines) => {
      try {
        const frameLine = lines.find(l => safeStr(l) && (l.startsWith('^done,frame=') || (l.startsWith('*stopped') && l.includes('frame='))));
        if (!frameLine) return "unknown";
        const match = /fullname="([^"]+)"/.exec(frameLine);
        return match ? match[1] : "unknown";
      } catch (e) {
        return "unknown";
      }
    };

    try {
      // Setup: insert breakpoint at main and run
      await sendCmd('-break-insert main');
      let runRes = await sendCmd('-exec-run', true);
      
      const runError = runRes.find(l => safeStr(l) && l.startsWith('^error'));
      if (runError) {
        throw new Error('GDB run failed: ' + runError);
      }
      
      let stepCount = 0;
      let startTime = Date.now();

      // ---- Snapshot helper ----
      // Captures the current frame + variables from GDB at this exact moment.
      // This is called AFTER GDB has stopped (either from -exec-run or -exec-step),
      // so the state is guaranteed to be a frozen snapshot of that exact line entry.
      const captureCurrentSnapshot = async () => {
        // Get frame info (line number, function name, file path)
        let frameRes = await sendCmd('-stack-info-frame');
        const line = extractFrameLine(frameRes);
        const funcName = extractFrameName(frameRes);
        const fullname = extractFullname(frameRes);

        // Get ALL local variable values right now (deep read, not a reference)
        let varsRes = await sendCmd('-stack-list-variables --all-values');
        const variables = extractVariables(varsRes);

        return { line, funcName, fullname, variables };
      };

      // Capture the first snapshot (at main breakpoint hit)
      let snapshot = await captureCurrentSnapshot();

      while (isRunning && stepCount < (options.maxSteps || 500)) {
        if (Date.now() - startTime > (options.timeoutMs || 5000)) {
          yield { truncated: true, reason: "Timeout exceeded" };
          break;
        }

        const { line, funcName, fullname, variables } = snapshot;

        // If we couldn't get frame info, the program likely exited
        if (line === -1 && funcName === 'unknown()') {
          break;
        }

        // Skip system libraries (e.g. stdio internals from printf stepping)
        if (fullname !== '/app/main.c' && fullname !== 'unknown') {
          let finishRes = await sendCmd('-exec-finish', true);
          const stoppedLine = finishRes.find(l => safeStr(l) && l.startsWith('*stopped'));
          if (stoppedLine && (stoppedLine.includes('reason="exited-normally"') || stoppedLine.includes('reason="exited"'))) {
            break;
          }
          // Re-capture snapshot after finishing system call
          snapshot = await captureCurrentSnapshot();
          continue;
        }

        stepCount++;

        // Build UMS heap and locals from the FROZEN variable snapshot
        const umsHeap = {};
        const stackLocals = {};

        for (const v of variables) {
          const varName = v.name;
          const valStr = v.value;

          if (!valStr || typeof valStr !== 'string') {
            stackLocals[varName] = { type: 'primitive', value: String(valStr) };
            continue;
          }

          // Static array (e.g. "{1, 2, 3}")
          if (valStr.startsWith('{') && valStr.endsWith('}')) {
            const inner = valStr.substring(1, valStr.length - 1);
            const parts = inner.split(',').map(s => s.trim());
            const arrVal = parts.map(p => ({ type: 'primitive', value: p }));
            umsHeap[varName] = { type: 'array', value: arrVal };
            stackLocals[varName] = { type: 'reference', pointsTo: varName };
            continue;
          }

          // Pointer
          if (valStr.startsWith('0x')) {
            const ptrMatch = /^(0x[0-9a-fA-F]+)/.exec(valStr);
            if (ptrMatch) {
              let address = ptrMatch[1];

              if (address === '0x0' || address === '0x00000000' || address === '0x0000000000000000') {
                stackLocals[varName] = { type: 'primitive', value: 'NULL' };
                continue;
              }

              umsHeap[address] = { type: 'primitive', value: valStr };

              try {
                let evalRes = await sendCmd(`-data-evaluate-expression *${varName}`);
                const doneLine = evalRes.find(l => safeStr(l) && l.startsWith('^done,value='));
                if (doneLine) {
                  const evalMatch = /value="((?:[^"\\]|\\.)*?)"/.exec(doneLine);
                  if (evalMatch) {
                    umsHeap[address].value = evalMatch[1].replace(/\\"/g, '"');
                  }
                }
              } catch (evalErr) {
                console.error('GDB deref error for', varName, evalErr.message);
              }
              stackLocals[varName] = { type: 'reference', pointsTo: address };
            } else {
              stackLocals[varName] = { type: 'primitive', value: valStr };
            }
          } else {
            stackLocals[varName] = { type: 'primitive', value: valStr };
          }
        }

        // Yield the frame — this represents the state AT this exact line
        const stateFrame = {
          step: stepCount,
          line: line > 0 ? line : 1,
          stack: [{ name: funcName, locals: stackLocals }],
          heap: umsHeap,
          stdout: ""
        };

        yield stateFrame;

        // ---- Step to next line ----
        let stepRes;
        try {
          stepRes = await sendCmd('-exec-step', true);
        } catch (stepErr) {
          console.error('GDB step error:', stepErr.message);
          break;
        }

        // Check if program exited after this step
        const stoppedLine = stepRes.find(l => safeStr(l) && l.startsWith('*stopped'));
        if (stoppedLine && (stoppedLine.includes('reason="exited-normally"') || stoppedLine.includes('reason="exited"'))) {
          break;
        }

        // Capture the NEXT snapshot immediately after stepping,
        // while GDB is still frozen at the new line.
        // This is the key fix: we read variables NOW (not at the start of next iteration)
        // so there is no window for another step to corrupt the state.
        snapshot = await captureCurrentSnapshot();
      }
    } catch (e) {
      console.error("GDB Tracer error:", e);
      throw new Error('C execution failed: ' + e.message);
    } finally {
      try { this.gdbProcess.kill(); } catch (_) {}
    }
  }

  async cleanup() {
    if (this.gdbProcess) {
      this.gdbProcess.kill();
    }
    if (this.containerName) {
      await new Promise((resolve) => {
        exec(`docker rm -f ${this.containerName}`, () => resolve());
      });
    }
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true }).catch(console.error);
    }
  }
}

module.exports = CAdapter;