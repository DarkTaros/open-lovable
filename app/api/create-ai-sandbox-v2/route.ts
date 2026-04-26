import { NextRequest, NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
// SandboxProvider type is used through SandboxFactory
import type { SandboxState } from '@/types/sandbox';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { setActiveSandboxProvider } from '@/lib/sandbox/provider-state';

// Store active sandbox globally
declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sandboxIdToRestore = typeof body?.sandboxId === 'string' ? body.sandboxId.trim() : '';

    if (body?.restore && sandboxIdToRestore) {
      console.log('[create-ai-sandbox-v2] Restoring sandbox:', sandboxIdToRestore);

      const provider = await sandboxManager.getOrCreateProvider(sandboxIdToRestore);
      const providerInfo = provider.getSandboxInfo();

      if (!providerInfo) {
        throw new Error(`Could not restore sandbox ${sandboxIdToRestore}`);
      }

      setActiveSandboxProvider(provider);
      global.sandboxData = {
        sandboxId: providerInfo.sandboxId,
        url: providerInfo.url
      };

      if (!global.existingFiles) {
        global.existingFiles = new Set<string>();
      }

      global.sandboxState = {
        fileCache: {
          files: {},
          lastSync: Date.now(),
          sandboxId: providerInfo.sandboxId
        },
        sandbox: provider,
        sandboxData: {
          sandboxId: providerInfo.sandboxId,
          url: providerInfo.url
        }
      };

      console.log('[create-ai-sandbox-v2] Sandbox restored at:', providerInfo.url);

      return NextResponse.json({
        success: true,
        restored: true,
        sandboxId: providerInfo.sandboxId,
        url: providerInfo.url,
        provider: providerInfo.provider,
        message: 'Sandbox restored'
      });
    }

    console.log('[create-ai-sandbox-v2] Creating sandbox...');
    
    // Clean up all existing sandboxes
    console.log('[create-ai-sandbox-v2] Cleaning up existing sandboxes...');
    await sandboxManager.terminateAll();
    
    // Also clean up legacy global state
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to terminate legacy global sandbox:', e);
      }
      setActiveSandboxProvider(null);
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    } else {
      global.existingFiles = new Set<string>();
    }

    // Create new sandbox using factory
    const provider = SandboxFactory.create();
    const sandboxInfo = await provider.createSandbox();
    
    console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
    await provider.setupViteApp();
    
    // Register with sandbox manager
    sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);
    
    // Also store in legacy global state for backward compatibility
    setActiveSandboxProvider(provider);
    global.sandboxData = {
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url
    };
    
    // Initialize sandbox state
    global.sandboxState = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId: sandboxInfo.sandboxId
      },
      sandbox: provider, // Store the provider instead of raw sandbox
      sandboxData: {
        sandboxId: sandboxInfo.sandboxId,
        url: sandboxInfo.url
      }
    };
    
    console.log('[create-ai-sandbox-v2] Sandbox ready at:', sandboxInfo.url);
    
    return NextResponse.json({
      success: true,
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
      message: 'Sandbox created and Vite React app initialized'
    });

  } catch (error) {
    console.error('[create-ai-sandbox-v2] Error:', error);
    
    // Clean up on error
    await sandboxManager.terminateAll();
    if (global.activeSandboxProvider) {
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to terminate sandbox on error:', e);
      }
      setActiveSandboxProvider(null);
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
