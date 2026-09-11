const BaseLanguageAdapter = require('./AdapterInterface');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { getSecurityFlags } = require('../docker/security');

class PythonAdapter extends BaseLanguageAdapter {
  constructor() {
    super();
    this.tempDir = null;
    this.code = '';
  }

  getLanguage() {
    return 'python';
  }

  async prepare(code, stdin = '') {
    this.code = code;
    this.stdin = stdin;
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'python-run-'));
    const filePath = path.join(this.tempDir, 'main.py');
    await fs.writeFile(filePath, code);
    // Write stdin to a file so it can be piped into the sandbox
    const stdinPath = path.join(this.tempDir, 'stdin.txt');
    await fs.writeFile(stdinPath, stdin);
  }

  async *execute(options) {
    const securityFlags = getSecurityFlags().join(' ');
    const mountFlag = `-v "${this.tempDir}:/app"`;
    this.containerName = `python-sandbox-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Pipe stdin.txt into the tracer so input() calls resolve from it
    const dockerCmd = `docker run --rm --name ${this.containerName} ${securityFlags} ${mountFlag} python-sandbox sh -c "python /tracer/python_tracer.py /app/main.py /app/stdin.txt"`;
    
    const result = await new Promise((resolve) => {
      exec(dockerCmd, { timeout: options.timeoutMs || 25000 }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
             resolve({ success: false, output: 'Execution timed out' });
          } else {
             // Sometimes python syntax errors go to stderr
             resolve({ success: false, output: stderr || stdout || error.message });
          }
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });

    if (!result.success) {
      throw new Error(result.output);
    }

    try {
      // The python_tracer directly outputs UMS-compliant frames.
      // We just need to parse and yield them.
      const frames = JSON.parse(result.output);
      for (const frame of frames) {
        if (frame.truncated) {
          continue; 
        }
        
        // frame is already in UMS format: { step, line, stack, heap, stdout }
        yield frame;
      }
    } catch (e) {
      throw new Error("Failed to parse Python Tracer output: " + e.message + "\nOutput was: " + result.output);
    }
  }

  async cleanup() {
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

module.exports = PythonAdapter;