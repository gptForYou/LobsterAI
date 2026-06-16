import fs from 'fs';
import path from 'path';
import { expect } from 'vitest';

export function getCurrentOpenClawVersion(): string {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  const openclawVersion = packageJson.openclaw?.version;
  expect(openclawVersion).toBeTruthy();
  return openclawVersion;
}

export function getCurrentOpenClawPatchDir(): string {
  const patchDir = path.resolve('scripts', 'patches', getCurrentOpenClawVersion());
  expect(fs.existsSync(patchDir)).toBe(true);
  return patchDir;
}

export function readCurrentOpenClawPatch(patchFile: string): string {
  const patchPath = path.join(getCurrentOpenClawPatchDir(), patchFile);
  expect(fs.existsSync(patchPath)).toBe(true);

  const patchContent = fs.readFileSync(patchPath, 'utf8');
  expect(patchContent.trim().length).toBeGreaterThan(0);
  return patchContent;
}

export function expectPatchContains(patchFile: string, snippets: string[]): void {
  const patchContent = readCurrentOpenClawPatch(patchFile);
  for (const snippet of snippets) {
    expect(patchContent).toContain(snippet);
  }
}

export function expectCurrentOpenClawPatchMissing(patchFile: string): void {
  const patchPath = path.join(getCurrentOpenClawPatchDir(), patchFile);
  expect(fs.existsSync(patchPath)).toBe(false);
}
