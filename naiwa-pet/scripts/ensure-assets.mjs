import { readFile, writeFile, mkdir, access, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = path.join(root, 'asset-bundle');
const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8'));
const marker = path.join(root, '.assets-ready');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let ready = false;
try {
  ready = (await readFile(marker, 'utf8')).trim() === manifest.sha256;
  for (const file of ['public/pets/naiwa/manifest.json', 'public/pets/naiwa/audio.m4a', 'public/pets/naiwa/frames/frame_0437.webp', 'src-tauri/icons/icon.ico', 'naiwa.mp4']) await access(path.join(root, file));
} catch { ready = false; }
if (!ready) {
  const chunks = [];
  for (const part of manifest.parts) {
    const bytes = await readFile(path.join(bundle, part.name));
    if (bytes.length !== part.size || sha256(bytes) !== part.sha256) throw new Error('Asset checksum mismatch: ' + part.name);
    chunks.push(bytes);
  }
  const archive = Buffer.concat(chunks);
  if (sha256(archive) !== manifest.sha256) throw new Error('Asset archive checksum mismatch');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'naiwa-assets-'));
  try {
    const archivePath = path.join(temp, 'assets.tar.gz');
    await writeFile(archivePath, archive);
    const result = spawnSync('tar', ['-xzf', archivePath, '-C', root], { stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('Cannot extract assets. Install tar and retry. ' + (result.error?.message ?? ''));
    await writeFile(marker, manifest.sha256 + '\n');
    console.log('Naiwa animation, audio and icons restored.');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
