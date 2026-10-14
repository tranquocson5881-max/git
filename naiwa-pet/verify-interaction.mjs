import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = fs.readFileSync('src/main.ts', 'utf8');
const start = source.indexOf('const enablePetInteraction =');
const end = source.indexOf('const boot =', start);
const code = ts.transpileModule(source.slice(start, end) + '\nenablePetInteraction(play);', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let plays = 0, drags = 0;
const handlers = new Map();
const captured = new Set();
const pet = {
 addEventListener: (name, fn) => handlers.set(name, fn),
 setPointerCapture: id => captured.add(id),
 hasPointerCapture: id => captured.has(id),
 releasePointerCapture: id => captured.delete(id),
};
vm.runInNewContext(code, { setFreeMovement: async () => {}, pet, play: async () => { plays++; }, appWindow: { startDragging: async () => { drags++; } }, console });
const send = (name, x=100, y=100, button=0) => handlers.get(name)({ pointerId: 1, screenX: x, screenY: y, button });
send('pointerdown'); assert.equal(drags, 0); send('pointerup'); assert.equal(plays, 1);
send('pointerdown'); send('pointermove', 103, 102); send('pointerup'); assert.equal(plays, 2); assert.equal(drags, 0);
send('pointerdown'); send('pointermove', 110); send('pointermove', 120); send('pointerup', 120); assert.equal(drags, 1); assert.equal(plays, 2);
send('pointerdown', 100, 100, 2); send('pointerup', 100, 100, 2); assert.equal(plays, 2);
send('pointerdown'); send('pointercancel'); send('pointerup'); assert.equal(plays, 2);
send('pointerdown'); send('pointerup'); assert.equal(plays, 3);
console.log('PASS: click, small movement, drag, right click, cancellation, repeated click');

