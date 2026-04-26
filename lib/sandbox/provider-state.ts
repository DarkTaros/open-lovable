import { sandboxManager } from './sandbox-manager';
import type { SandboxProvider } from './types';

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
}

export function getActiveSandboxProvider(): SandboxProvider | null {
  return (
    sandboxManager.getActiveProvider() ||
    global.activeSandboxProvider ||
    (global.activeSandbox?.getSandboxInfo ? global.activeSandbox : null)
  );
}

export function setActiveSandboxProvider(provider: SandboxProvider | null): void {
  global.activeSandboxProvider = provider;
  global.activeSandbox = provider;
}
