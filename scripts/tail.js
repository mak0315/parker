import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logFile = join(__dirname, '..', 'logs', 'app.log');

if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '');
  console.log('Created empty log file.');
}

let lastPosition = fs.statSync(logFile).size;

function readNewLines() {
  const size = fs.statSync(logFile).size;
  if (size < lastPosition) {
    lastPosition = 0;
  }
  if (size > lastPosition) {
    const fd = fs.openSync(logFile, 'r');
    const buffer = Buffer.alloc(size - lastPosition);
    fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
    fs.closeSync(fd);
    lastPosition = size;
    process.stdout.write(buffer.toString());
  }
}

setInterval(readNewLines, 1000);
console.log(`📋 Tailing ${logFile} (Ctrl+C to stop)`);