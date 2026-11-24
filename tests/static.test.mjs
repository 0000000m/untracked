// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const extension = new URL('../extension/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', extension), 'utf8'));
const rules = JSON.parse(await readFile(new URL('rules.json', extension), 'utf8'));

test('the distributed extension contains only declarative configuration', async () => {
  assert.deepEqual((await readdir(extension)).sort(), ['manifest.json', 'rules.json']);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.name, 'Untracked');
  assert.deepEqual(Object.keys(manifest).sort(), [
    'manifest_version', 'name', 'version', 'description', 'minimum_chrome_version',
    'permissions', 'host_permissions', 'declarative_net_request',
  ].sort());
});

test('permissions are limited to DNR redirects on HTTP and HTTPS', () => {
  assert.deepEqual(manifest.permissions, ['declarativeNetRequestWithHostAccess']);
  assert.deepEqual(manifest.host_permissions, ['http://*/*', 'https://*/*']);
  assert.deepEqual(manifest.declarative_net_request.rule_resources, [
    { id: 'tracking_parameters', enabled: true, path: 'rules.json' },
  ]);
});

test('rules can only remove selected query keys on GET and HEAD', () => {
  assert.equal(rules.length, 2);
  assert.equal(new Set(rules.map(rule => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.deepEqual(rule.condition.requestMethods, ['get', 'head']);
    assert.equal(rule.action.type, 'redirect');
    assert.deepEqual(Object.keys(rule.action), ['type', 'redirect']);
    assert.deepEqual(Object.keys(rule.action.redirect), ['transform']);
    assert.deepEqual(Object.keys(rule.action.redirect.transform), ['queryTransform']);
    assert.deepEqual(Object.keys(rule.action.redirect.transform.queryTransform), ['removeParams']);
    const names = rule.action.redirect.transform.queryTransform.removeParams;
    assert.ok(names.length > 0);
    assert.equal(new Set(names).size, names.length);
    for (const name of names) assert.match(name, /^[A-Za-z_][A-Za-z_0-9]*$/);
    assert.equal(rule.condition.responseHeaders, undefined);
  }
});

test('ambiguous functional keys are protected and sharing ID is domain-scoped', () => {
  const global = rules.find(rule => rule.id === 1);
  const scoped = rules.find(rule => rule.id === 2);
  for (const name of ['q', 'ref', 'tag', 'code', 'state', 'token', 'sig', 'v', 't', 'list', 'si']) {
    assert.ok(!global.action.redirect.transform.queryTransform.removeParams.includes(name));
  }
  assert.deepEqual(scoped.condition.requestDomains, ['youtube.com', 'youtu.be', 'youtube-nocookie.com']);
  assert.deepEqual(scoped.condition.resourceTypes, ['main_frame', 'sub_frame']);
  assert.deepEqual(scoped.action.redirect.transform.queryTransform.removeParams, ['si']);
  assert.ok(scoped.priority > global.priority);
});
