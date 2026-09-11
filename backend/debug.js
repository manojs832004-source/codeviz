const { exec } = require('child_process');
const cmd = 'docker run --rm -v "e:/visualization code project/backend:/app" java-sandbox sh -c "javac -g -d /tmp /app/Main.java ; java -cp /tracer:/tmp Tracer Main"';
exec(cmd, {timeout: 10000, maxBuffer: 1024*1024*10}, (err, stdout, stderr) => {
  console.log('STDOUT LEN:', stdout.length);
  console.log('STDERR LEN:', stderr.length);
  if(stdout.length > 0) {
     console.log('STDOUT TAIL:', stdout.substring(stdout.length - 1000));
  }
  if(stderr.length > 0) {
     console.log('STDERR:', stderr);
  }
  if(err) console.log('ERR:', err.message);
});
