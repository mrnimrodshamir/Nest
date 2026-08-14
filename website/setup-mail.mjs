/* One-shot setup for beta-signup email notification.
 *
 *     node setup-mail.mjs
 *
 * Asks for the nestup.best mailbox password, proves it works against
 * Spacemail BEFORE storing it anywhere, writes it to the Vercel project
 * environment, redeploys, and then puts a real signup through the live
 * endpoint so delivery is confirmed rather than assumed.
 *
 * The password is read straight from the terminal with echo off. It goes to
 * exactly two places: Spacemail, to authenticate, and the Vercel environment,
 * which is where the function reads it from. It is never written to disk here,
 * never echoed, and never passed as a command-line argument (argv is readable
 * by other processes on the machine).
 *
 * Deliberately dependency-free — it runs before `npm install` needs to have
 * happened, and a setup script should not itself need setting up.
 */
import { spawn } from 'node:child_process';
import { connect } from 'node:tls';
import { createInterface } from 'node:readline';
import process from 'node:process';

const HOST = process.env.SMTP_HOST || 'mail.spacemail.com';
const PORT = Number(process.env.SMTP_PORT || 465);
const DEFAULT_USER = 'nimrodshamir@nestup.best';
const SITE = 'https://nestup.best';

const ETX = String.fromCharCode(3);   // Ctrl-C
const DEL = String.fromCharCode(127); // backspace on most terminals
const BS  = String.fromCharCode(8);   // backspace on the rest

const say = (s = '') => process.stdout.write(s + '\n');
const ok = (s) => say(`  \x1b[32m✓\x1b[0m ${s}`);
const bad = (s) => say(`  \x1b[31m✗\x1b[0m ${s}`);

function ask(question, fallback) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) =>
    rl.question(question, (a) => {
      rl.close();
      res(a.trim() || fallback);
    }),
  );
}

/* Reads a line with the terminal's echo suppressed, so the password is never
   drawn on screen and never lands in scrollback. */
function askSecret(question) {
  return new Promise((res, rej) => {
    if (!process.stdin.isTTY) {
      rej(new Error('needs an interactive terminal so the password is not echoed'));
      return;
    }
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let value = '';
    const onData = (buf) => {
      for (const c of buf.toString('utf8')) {
        if (c === '\r' || c === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          return res(value);
        }
        // Raw mode swallows the default handlers, so Ctrl-C and backspace
        // have to be handled here or the prompt becomes a trap.
        if (c === ETX) {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === DEL || c === BS) value = value.slice(0, -1);
        else if (c >= ' ') value += c;
      }
    };
    process.stdin.on('data', onData);
  });
}

/* A minimal SMTP conversation: enough to prove the credential is accepted,
   and nothing more. If this fails, nothing has been stored yet. */
export function verifySmtp(user, pass) {
  return new Promise((res, rej) => {
    const socket = connect({ host: HOST, port: PORT, servername: HOST });
    let buffer = '';
    let stage = 0;

    const timer = setTimeout(() => {
      socket.destroy();
      rej(new Error(`no response from ${HOST}:${PORT} within 20s`));
    }, 20_000);

    const send = (line) => socket.write(line + '\r\n');
    const script = [
      () => send('EHLO nestup.best'),
      () => send('AUTH LOGIN'),
      () => send(Buffer.from(user).toString('base64')),
      () => send(Buffer.from(pass).toString('base64')),
    ];

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (!buffer.endsWith('\r\n')) return;

      const lines = buffer.trim().split('\r\n');
      const last = lines[lines.length - 1];
      // Multi-line replies mark continuation with "250-"; the final line of
      // the reply uses "250 ". Waiting for that avoids acting on a fragment.
      if (/^\d{3}-/.test(last)) return;

      buffer = '';
      const code = Number(last.slice(0, 3));

      if (code >= 400) {
        clearTimeout(timer);
        socket.end();
        return rej(
          new Error(
            code === 535
              ? 'Spacemail rejected that username or password (535)'
              : `SMTP error ${code}: ${last}`,
          ),
        );
      }

      if (stage === script.length) {
        clearTimeout(timer);
        send('QUIT');
        socket.end();
        return res(true);
      }
      script[stage++]();
    });

    socket.on('error', (e) => {
      clearTimeout(timer);
      rej(e);
    });
  });
}

/* Feeds values over stdin rather than argv — command-line arguments are
   readable by any other process on the machine. */
function run(cmd, args, { stdin } = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, {
      cwd: import.meta.dirname,
      shell: process.platform === 'win32',
      stdio: [stdin === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    if (stdin !== undefined) child.stdin.end(stdin);
    child.on('close', (code) => (code === 0 ? res(out) : rej(new Error(out.trim()))));
    child.on('error', rej);
  });
}

const vercel = (args, opts) => run('npx', ['--yes', 'vercel@latest', ...args], opts);

async function setEnv(name, value) {
  // Remove first so re-running this script updates rather than colliding.
  await vercel(['env', 'rm', name, 'production', '--yes']).catch(() => {});
  await vercel(['env', 'add', name, 'production'], { stdin: value + '\n' });
}

async function main() {
  say('\nNestUp — beta signup email setup');
  say('─'.repeat(52));
  say(`Mail host: ${HOST}:${PORT}`);
  say('The password is not echoed, not saved to disk, and not passed as a');
  say('command argument. It reaches Spacemail and the Vercel environment only.');
  say('');

  const user = await ask(`Mailbox [${DEFAULT_USER}]: `, DEFAULT_USER);
  const pass = await askSecret('Password (hidden): ');
  if (!pass) {
    bad('No password entered. Nothing changed.');
    process.exit(1);
  }

  say('\nVerifying the credential before storing it...');
  try {
    await verifySmtp(user, pass);
    ok('Spacemail accepted the login');
  } catch (err) {
    bad(err.message);
    say('\nNothing was stored and nothing was deployed. Fix and re-run.');
    process.exit(1);
  }

  say('\nWriting to the Vercel production environment...');
  await setEnv('SMTP_USER', user);
  await setEnv('SMTP_PASS', pass);
  if (HOST !== 'mail.spacemail.com') await setEnv('SMTP_HOST', HOST);
  if (PORT !== 465) await setEnv('SMTP_PORT', String(PORT));
  ok('SMTP_USER and SMTP_PASS set');

  say('\nRedeploying so the function picks them up...');
  await vercel(['deploy', '--prod', '--yes']);
  ok('Deployed to production');

  say('\nSending a real signup through the live endpoint...');
  const probe = `setup-check+${Date.now()}@nestup.best`;
  const res = await fetch(`${SITE}/api/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: probe, elapsed: 5000 }),
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok || !body.ok) {
    bad(`Endpoint returned ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }

  ok(`Endpoint accepted it (${probe})`);
  say('\n' + '─'.repeat(52));
  say(`Done. Check ${user} for a "NestUp beta signup" email.`);
  say('If it has not arrived, run:  npx vercel logs --prod');
  say('and look for lines tagged [subscribe].');
}

// Only run when executed directly, so verifySmtp can be exercised on its own.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().catch((err) => {
    bad(err.message);
    process.exit(1);
  });
}
