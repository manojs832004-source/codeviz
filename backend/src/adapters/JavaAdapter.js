const BaseLanguageAdapter = require('./AdapterInterface');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { getSecurityFlags } = require('../docker/security');

class JavaAdapter extends BaseLanguageAdapter {
  constructor() {
    super();
    this.tempDir = null;
    this.code = '';
  }

  getLanguage() {
    return 'java';
  }

  async prepare(code, stdin = '') {
    this.code = code;
    this.stdin = stdin;
    this.className = 'Main';
    let classMatch = code.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
    if (!classMatch) {
       classMatch = code.match(/class\s+([A-Za-z0-9_$]+)/);
    }
    if (classMatch) {
       this.className = classMatch[1];
    }
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'java-run-'));
    const filePath = path.join(this.tempDir, `${this.className}.java`);
    await fs.writeFile(filePath, code);
    // Write stdin to a file so it can be piped into the JVM
    const stdinPath = path.join(this.tempDir, 'stdin.txt');
    await fs.writeFile(stdinPath, stdin);
  }

  async *execute(options) {
    const securityFlags = getSecurityFlags().join(' ');
    const mountFlag = `-v "${this.tempDir}:/app"`;
    const tmpfsFlag = `--tmpfs /out`;
    
    // Pipe stdin.txt into the java process so Scanner/BufferedReader input() calls resolve
    const dockerCmd = `docker run --rm ${securityFlags} ${mountFlag} ${tmpfsFlag} java-sandbox sh -c "javac -g -d /out /app/${this.className}.java && cat /app/stdin.txt | java -cp /tracer:/out Tracer ${this.className}"`;
    
    const result = await new Promise((resolve) => {
      exec(dockerCmd, { timeout: options.timeoutMs || 60000 }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
             resolve({ success: false, output: 'Execution timed out' });
          } else {
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

    // The current Tracer.java outputs a JSON array of state frames at the end.
    // For a true stream, we'd read stdout as it arrives. For now, we parse the array and yield frames.
    try {
      const frames = JSON.parse(result.output);
      if (frames.length === 0) {
        throw new Error("No frames were captured! Raw output: " + result.output);
      }
      for (const frame of frames) {
        if (frame.truncated) {
          // Special marker from Tracer.java
          continue; 
        }
        
        const stateFrame = {
          step: frame.step,
          line: frame.line,
          stack: [
            {
              name: frame.stack[0] || 'main()',
              locals: frame.variables || {}
            }
          ],
          heap: frame.heap || {},
          stdout: frame.stdout
        };

        yield stateFrame;
      }
    } catch (e) {
      throw new Error("Failed to parse Tracer output: " + e.message);
    }
  }

  async cleanup() {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true }).catch(console.error);
    }
  }
}

module.exports = JavaAdapter;