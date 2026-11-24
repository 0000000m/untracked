// SPDX-License-Identifier: MIT
// Real browser + local HTTP/HTTPS servers; assertions use received request paths.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { createHash, createPublicKey } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, platform, arch, release } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startBrowser, attachPage } from './cdp.mjs';

const executable = process.env.BROWSER_PATH;
if (!executable) throw new Error('Set BROWSER_PATH to a Vivaldi, Chromium or Chrome executable; see docs/TESTING.md.');
const run = promisify(execFile);
const browserName = (await run(executable, ['--version'], { timeout: 10000 })).stdout.trim();
const workspace = await mkdtemp(join(tmpdir(), 'untracked-test-'));
let browser, http, https;
const received = [], passed = [];
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, label);
  passed.push(label);
  console.log(`PASS ${label}`);
};
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
});
const stopServer = server => new Promise(resolve => {
  if (!server?.listening) return resolve();
  server.close(resolve);
  server.closeAllConnections();
});
async function until(predicate, label) {
  const end = Date.now() + 5000;
  do {
    if (await predicate()) return;
    await delay(20);
  } while (Date.now() < end);
  throw new Error(`Timed out waiting for ${label}`);
}
try {
  const extension = join(workspace, 'extension');
  await mkdir(extension);
  for (const name of ['manifest.json', 'rules.json']) {
    await copyFile(new URL(`../extension/${name}`, import.meta.url), join(extension, name));
  }
  const handler = async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received.push({ method: req.method, url: req.url, body });
    res.setHeader('Cache-Control', 'no-store');
    const path = req.url.split('?')[0];
    if (path === '/server-redirect') {
      res.writeHead(302, { Location: '/redirect-destination?keep=yes&fbclid=second&utm_medium=email' });
      return res.end();
    }
    if (path === '/image') {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
    }
    if (path === '/script') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('window.testScriptLoaded = true;');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><title>Untracked network test</title><body>Local fixture</body>');
  };
  http = createServer(handler);
  await listen(http);
  await run(process.env.OPENSSL_PATH || 'openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=untracked.test',
    '-keyout', join(workspace, 'key.pem'), '-out', join(workspace, 'cert.pem'),
  ], { timeout: 20000 });
  const key = await readFile(join(workspace, 'key.pem'));
  const cert = await readFile(join(workspace, 'cert.pem'));
  const spki = createHash('sha256').update(createPublicKey(key).export({ type: 'spki', format: 'der' })).digest('base64');
  https = createSecureServer({ key, cert }, handler);
  await listen(https);
  const httpOrigin = `http://127.0.0.1:${http.address().port}`;
  const httpsOrigin = `https://127.0.0.1:${https.address().port}`;
  const mappings = ['youtube.com', 'youtu.be', 'www.youtube.com', 'youtube-nocookie.com', 'youtube.com.untracked.test'];
  browser = startBrowser(executable, join(workspace, 'profile'), [
    // Vivaldi's UI is not available in Chromium headless mode; use its request engine.
    ...(/vivaldi/i.test(browserName) ? ['--disable-vivaldi'] : []),
    '--no-proxy-server', `--host-resolver-rules=${mappings.map(host => `MAP ${host} 127.0.0.1`).join(',')}`,
    // Scoped to this throwaway browser and this throwaway TLS key. Never a system trust change.
    `--ignore-certificate-errors-spki-list=${spki}`,
  ]);
  const version = await browser.send('Browser.getVersion');
  const page = await attachPage(browser);
  async function navigate(label, input, expected, origin = httpOrigin) {
    const offset = received.length;
    const result = await page.send('Page.navigate', { url: origin + input });
    assert.equal(result.errorText, undefined, `${label}: ${result.errorText}`);
    await until(() => page.evaluate('document.readyState === "complete"'), `${label} page load`);
    check(label, received.slice(offset).filter(item => item.url !== '/favicon.ico').map(item => item.url), expected);
  }
  await navigate('control: server sees tracking before installation', '/control?utm_source=chatgpt.com&fbclid=control&keep=yes', ['/control?utm_source=chatgpt.com&fbclid=control&keep=yes']);
  const installed = await browser.send('Extensions.loadUnpacked', { path: extension });
  const { extensions } = await browser.send('Extensions.getExtensions');
  check('browser registers the enabled extension', extensions.some(item => item.id === installed.id && item.enabled && item.name === 'Untracked'), true);

  await navigate('ChatGPT source removed before HTTP transmission', '/chatgpt?utm_source=chatgpt.com', ['/chatgpt']);
  await navigate('HTTPS cleanup preserves functional query and fragment', '/secure?utm_source=campaign&keep=yes&fbclid=click#chapter', ['/secure?keep=yes'], httpsOrigin);
  check('fragment stays in the browser', await page.evaluate('location.hash'), '#chapter');
  await navigate('duplicate and valueless tracking keys', '/duplicates?fbclid=a&keep=one&fbclid=b&utm_source&keep=two&utm_source=last', ['/duplicates?keep=one&keep=two']);
  await navigate('click-ID families', '/clicks?gclid=a&dclid=b&msclkid=c&gbraid=d&wbraid=e&gad_source=f&gad_campaign=g&srsltid=h&twclid=i&ttclid=j&igshid=k&li_fat_id=l&keep=yes', ['/clicks?keep=yes']);
  await navigate('campaign and email families', '/campaign?utm_medium=email&utm_campaign=launch&utm_term=word&utm_content=card&utm_id=id&mc_eid=a&mc_cid=b&mkt_tok=c&_hsenc=d&_hsmi=e&__hsfp=f&__hssc=g&__hstc=h&keep=yes', ['/campaign?keep=yes']);
  await navigate('functional parameters retain exact encoding and order', '/functional?q=a%2Bb%20c&lang=en&ref=item&tag=affiliate&code=auth&state=csrf&token=value&sig=signature&v=video&t=30&list=playlist', ['/functional?q=a%2Bb%20c&lang=en&ref=item&tag=affiliate&code=auth&state=csrf&token=value&sig=signature&v=video&t=30&list=playlist']);
  await navigate('encoded values and nested URLs are preserved', '/nested?next=https%3A%2F%2Fexample.test%2F%3Ffbclid%3Dinner&fbclid=outer', ['/nested?next=https%3A%2F%2Fexample.test%2F%3Ffbclid%3Dinner']);
  await navigate('similarly named keys and case remain distinct', '/case?UTM_SOURCE=keep&x_fbclid=keep&utm_source_extra=keep&utm_source=remove', ['/case?UTM_SOURCE=keep&x_fbclid=keep&utm_source_extra=keep']);
  await navigate('encoded key limitation is explicit', '/encoded?%75tm_source=keep&keep=yes', ['/encoded?%75tm_source=keep&keep=yes']);
  await navigate('unlisted query does not loop or issue another request', '/unlisted?custom=keep&si=keep&utm_future=keep', ['/unlisted?custom=keep&si=keep&utm_future=keep']);
  await navigate('URL without query stays unchanged', '/plain', ['/plain']);
  await navigate('query-looking fragment does not change the request', '/fragment#?utm_source=keep', ['/fragment']);
  check('query-looking fragment preserved', await page.evaluate('location.hash'), '#?utm_source=keep');
  await navigate('each hop of a server redirect is cleaned', '/server-redirect?utm_source=first&keep=yes', ['/server-redirect?keep=yes', '/redirect-destination?keep=yes']);

  async function exercise(label, expression, path, expected) {
    const offset = received.length;
    await page.evaluate(expression);
    check(label, received.slice(offset).filter(item => item.url.split('?')[0] === path), expected);
  }
  await exercise('fetch GET is clean at the server', "fetch('/fetch?fbclid=click&keep=yes').then(r => r.text())", '/fetch', [{ method: 'GET', url: '/fetch?keep=yes', body: '' }]);
  await exercise('HEAD is clean at the server', "fetch('/head?msclkid=click&keep=yes',{method:'HEAD'}).then(r => r.ok)", '/head', [{ method: 'HEAD', url: '/head?keep=yes', body: '' }]);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const path = '/method-' + method.toLowerCase();
    await exercise(`${method} query and body remain intact`, `fetch('${path}?utm_source=keep',{method:'${method}',body:'code=123&state=456'}).then(r => r.text())`, path,
      [{ method, url: path + '?utm_source=keep', body: 'code=123&state=456' }]);
  }
  for (const [label, tag, path, query] of [
    ['image', 'img', '/image', 'gclid=click&keep=yes'],
    ['script', 'script', '/script', 'utm_content=card&keep=yes'],
    ['subframe', 'iframe', '/frame', 'fbclid=click&keep=yes'],
  ]) {
    await exercise(`${label} request is clean at the server`, `new Promise((resolve,reject)=>{const element=document.createElement('${tag}');element.onload=()=>resolve(true);element.onerror=()=>reject(new Error('Fixture failed'));element.src='${path}?${query}';document.body.append(element);})`, path,
      [{ method: 'GET', url: path + '?keep=yes', body: '' }]);
  }
  for (const host of ['youtube.com', 'www.youtube.com', 'youtu.be', 'youtube-nocookie.com']) {
    await navigate(`sharing ID and campaign removed on ${host}`, '/watch?v=video&t=30&list=playlist&si=share&utm_source=campaign', ['/watch?v=video&t=30&list=playlist'], `https://${host}:${https.address().port}`);
  }
  await navigate('lookalike domain retains functional si', '/lookalike?si=keep&utm_source=remove', ['/lookalike?si=keep'], `https://youtube.com.untracked.test:${https.address().port}`);
  await navigate('si remains on unrelated sites', '/other?si=keep&utm_source=remove', ['/other?si=keep']);

  const report = {
    timestamp: new Date().toISOString(), browser: browserName, chromium: version.product,
    platform: platform(), architecture: arch(), osRelease: release(), node: process.version,
    mode: /vivaldi/i.test(browserName) ? 'Vivaldi headless Chromium engine' : 'headless',
    passed: passed.length, checks: passed,
  };
  const output = new URL('../test-results/', import.meta.url);
  await mkdir(output, { recursive: true });
  const family = /vivaldi/i.test(browserName) ? 'vivaldi' : /chromium/i.test(browserName) ? 'chromium' : 'chrome';
  await writeFile(new URL(`${family}-${platform()}-${arch()}.json`, output), JSON.stringify(report, null, 2) + '\n');
  console.log('RESULT ' + JSON.stringify(report));
} finally {
  try { if (browser) await browser.close(); }
  finally {
    await Promise.all([stopServer(http), stopServer(https)]);
    await rm(workspace, { recursive: true, force: true });
  }
}
