import { NextResponse } from 'next/server';
import type { SandboxState } from '@/types/sandbox';
import { SandboxFactory } from '@/lib/sandbox/factory';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { setActiveSandboxProvider } from '@/lib/sandbox/provider-state';

declare global {
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
  var sandboxCreationInProgress: boolean;
  var sandboxCreationPromise: Promise<any> | null;
}

export async function POST() {
  if (global.sandboxCreationInProgress && global.sandboxCreationPromise) {
    try {
      return NextResponse.json(await global.sandboxCreationPromise);
    } catch {
      // If the in-flight creation failed, start a fresh one below.
    }
  }

  global.sandboxCreationInProgress = true;
  global.sandboxCreationPromise = createSandboxInternal();

  try {
    return NextResponse.json(await global.sandboxCreationPromise);
  } catch (error) {
    console.error('[create-ai-sandbox] Sandbox creation failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    global.sandboxCreationInProgress = false;
    global.sandboxCreationPromise = null;
  }
}

async function createSandboxInternal() {
  await sandboxManager.terminateAll();

  if (!global.existingFiles) {
    global.existingFiles = new Set<string>();
  } else {
    global.existingFiles.clear();
  }

  const provider = SandboxFactory.create('opensandbox');
  const sandboxInfo = await provider.createSandbox();
  await provider.setupViteApp();

  sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);
  setActiveSandboxProvider(provider);

  global.sandboxData = {
    sandboxId: sandboxInfo.sandboxId,
    url: sandboxInfo.url
  };

  global.sandboxState = {
    fileCache: {
      files: {},
      lastSync: Date.now(),
      sandboxId: sandboxInfo.sandboxId
    },
    sandbox: provider,
    sandboxData: global.sandboxData
  };

  return {
    success: true,
    sandboxId: sandboxInfo.sandboxId,
    url: sandboxInfo.url,
    provider: sandboxInfo.provider,
    message: 'OpenSandbox created and Vite React app initialized'
  };
}
