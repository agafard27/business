import { createInterface } from 'node:readline/promises';

export async function askAdminUser() {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await reader.question('MySQL yönetici kullanıcı adı [root]: ')).trim() || 'root'; }
  finally { reader.close(); }
}

export async function askPassword() {
  if (!process.stdin.isTTY) throw Object.assign(new Error(), { code: 'INTERACTIVE_TERMINAL_REQUIRED' });
  process.stdout.write('MySQL yönetici parolası (gizli giriş): ');
  return new Promise((resolve, reject) => {
    let value = '';
    const input = process.stdin;
    input.setRawMode(true);
    input.resume();
    function done(error) {
      input.setRawMode(false); input.pause(); input.off('data', onData); process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    }
    function onData(chunk) {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') return done(Object.assign(new Error(), { code: 'CANCELLED' }));
        if (char === '\r' || char === '\n') return done();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    input.on('data', onData);
  });
}
