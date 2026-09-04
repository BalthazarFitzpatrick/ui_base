// exercises Menu's section building against a DOM stub, because the two things worth testing here
// are pure structure: does a column carry its own heading, and does an item's state reach the row
// as classes. a full jsdom would test the browser as much as the code.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

function element(tag) {
  const el = {
    tag, className: '', textContent: '', innerHTML: '', title: '',
    dataset: {}, children: [], onclick: null,
    appendChild(child) { this.children.push(child); return child; },
    append(...kids) { kids.forEach(k => this.children.push(k)); },
    classList: {
      _of: () => el.className.split(' ').filter(Boolean),
      contains: name => el.className.split(' ').includes(name),
      toggle(name) {
        const has = el.className.split(' ').includes(name);
        el.className = has
          ? el.className.split(' ').filter(c => c && c !== name).join(' ')
          : `${el.className} ${name}`.trim();
        return !has;
      },
      add(name) { if (!this.contains(name)) el.className = `${el.className} ${name}`.trim(); },
      remove(name) { el.className = el.className.split(' ').filter(c => c && c !== name).join(' '); },
    },
  };
  return el;
}

globalThis.document = {createElement: element, addEventListener() {}, removeEventListener() {}};
globalThis.window = {addEventListener() {}, removeEventListener() {}, innerWidth: 1200, innerHeight: 800};
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

// the path is an argument so the suite can prove these tests FAIL against an older menu.js -
// a guard that cannot fail is not a guard
const target = process.argv[2] || new URL('../../ui_base/assets/menu.js', import.meta.url);
const src = readFileSync(target, 'utf8');
const Menu = new Function(`${src}; return Menu;`)();

const walk = (node, out = []) => {
  out.push(node);
  (node.children || []).forEach(c => walk(c, out));
  return out;
};
const menu = new Menu({});

// ---- a column names itself
const withLabels = menu._section({
  kind: 'columns',
  columns: [
    {label: 'available', items: [{id: 'a', label: 'a'}]},
    {label: 'open', items: [{id: 'b', label: 'b'}]},
  ],
});
const headings = walk(withLabels).filter(n => n.className === 'field-label').map(n => n.textContent);
assert.deepEqual(headings, ['available', 'open'], 'each column should carry its own heading');

// ---- an empty column says so rather than being blank
const empty = menu._section({
  kind: 'columns',
  columns: [
    {label: 'available', items: [{id: 'a', label: 'a'}]},
    {label: 'open', items: [], empty: 'no dataset opened'},
  ],
});
const nones = walk(empty).filter(n => n.className === 'none').map(n => n.textContent);
assert.deepEqual(nones, ['no dataset opened'], 'an empty column should show its helper text');

// ---- a column with items shows no helper text
const filled = menu._section({
  kind: 'columns',
  columns: [{label: 'open', items: [{id: 'a', label: 'a'}], empty: 'no dataset opened'}],
});
assert.equal(walk(filled).filter(n => n.className === 'none').length, 0);

// ---- item.state becomes classes, the same convention renderTree uses
const stated = menu._section({
  kind: 'list',
  items: [{id: 'x', label: 'x', state: {done: true, current: false, failed: true}}],
});
const row = walk(stated).find(n => n.className.includes('menu-item'));
assert.ok(row.classList.contains('done'), 'a truthy state flag should become a class');
assert.ok(row.classList.contains('failed'));
assert.ok(!row.classList.contains('current'), 'a falsy state flag should not');

// ---- state coexists with on/disabled rather than replacing them
const both = menu._section({
  kind: 'list',
  items: [{id: 'y', label: 'y', on: true, state: {current: true}}],
});
const onRow = walk(both).find(n => n.className.includes('menu-item'));
assert.ok(onRow.classList.contains('on') && onRow.classList.contains('current'));

// ---- columns still get independent handlers, which is what they were already for
let leftPicked = null, rightPicked = null;
const handlers = menu._section({
  kind: 'columns',
  columns: [
    {label: 'l', items: [{id: 'l1', label: 'l1'}], multi: false, onPick: i => { leftPicked = i.id; }},
    {label: 'r', items: [{id: 'r1', label: 'r1'}], onPick: i => { rightPicked = i.id; }},
  ],
});
const rows = walk(handlers).filter(n => n.className.includes('menu-item'));
rows[0].onclick();
rows[1].onclick();
assert.equal(leftPicked, 'l1');
assert.equal(rightPicked, 'r1');

console.log('ok');
