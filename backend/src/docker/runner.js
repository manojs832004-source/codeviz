const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { getSecurityFlags } = require('./security');

async function executeJavaCode(code) {
  // Create a temporary directory for this execution
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'java-run-'));
  const filePath = path.join(tempDir, 'Main.java');
  
  try {
    await fs.writeFile(filePath, code);

    const securityFlags = getSecurityFlags().join(' ');
    // We mount the temp dir to /app, and since container is read-only, we output classes to a tmpfs mount
    const mountFlag = `-v "${tempDir}:/app"`;
    const tmpfsFlag = `--tmpfs /out`;
    
    // Command to compile and run Java code inside the sandbox container using the JDI Tracer
    const dockerCmd = `docker run --rm ${securityFlags} ${mountFlag} ${tmpfsFlag} java-sandbox sh -c "javac -g -d /out /app/Main.java && java -cp /tracer:/out Tracer Main"`;
    
    return await new Promise((resolve) => {
      exec(dockerCmd, { timeout: 25000 }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
             resolve({ success: false, output: 'Execution timed out (25s limit)' });
          } else {
             resolve({ success: false, output: stderr || stdout || error.message });
          }
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  } catch (err) {
    return { success: false, output: `System Error: ${err.message}` };
  } finally {
    // Cleanup temporary files
    await fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);
  }
}

module.exports = {
  executeJavaCode
};