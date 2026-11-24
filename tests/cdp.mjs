// SPDX-License-Identifier: MIT
// Minimal test-only transport. The extension itself contains no JavaScript.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export function startBrowser(executable, profile, args = []) {
  const child = spawn(executable, [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    ...args, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let sequence = 0, buffer = '', diagnostic = '', ended = false;
  const pending = new Map();
  const fail = error => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-8000); });
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', data => {
    buffer += data;
    let index;
    while ((index = buffer.indexOf('\0')) >= 0) {
      const packet = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      let message;
      try { message = JSON.parse(packet); }
      catch (error) { fail(error); continue; }
      const entry = pending.get(message.id);
      if (!entry) continue;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    }
  });
  child.stdio[3].on('error', fail);
  child.stdio[4].on('error', fail);
  child.on('error', error => { ended = true; fail(error); });
  const exited = new Promise(resolve => child.once('close', (code, signal) => {
    ended = true;
    fail(new Error(`Test browser exited (${code ?? signal}). ${diagnostic}`));
    resolve();
  }));
  function send(method, params = {}, sessionId, timeout = 15000) {
    if (ended) return Promise.reject(new Error(`Test browser is not running. ${diagnostic}`));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`DevTools timeout: ${method}. ${diagnostic}`));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  function stop(signal) {
    if (ended || !child.pid) return;
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal); // Only this disposable browser's process group.
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  return {
    send,
    async close() {
      if (ended) return;
      await send('Browser.close', {}, undefined, 2000).catch(() => {});
      await Promise.race([exited, delay(2000)]);
      if (!ended) { stop('SIGTERM'); await Promise.race([exited, delay(2000)]); }
      if (!ended) { stop('SIGKILL'); await Promise.race([exited, delay(2000)]); }
      if (!ended) throw new Error('Could not stop the disposable test browser.');
    },
  };
}

export async function attachPage(browser) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const target = targetInfos.find(item => item.type === 'page');
  if (!target) throw new Error('The disposable browser did not create a test page.');
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  await browser.send('Page.enable', {}, sessionId);
  return {
    send: (method, params = {}) => browser.send(method, params, sessionId),
    async evaluate(expression) {
      const result = await browser.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    },
  };
}
