import { NextResponse } from 'next/server';
import { getActiveSandboxProvider, setActiveSandboxProvider } from '@/lib/sandbox/provider-state';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

declare global {
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function POST() {
  try {
    console.log('[kill-sandbox] Stopping active sandbox...');

    let sandboxKilled = false;

    const provider = getActiveSandboxProvider();

    if (provider) {
      try {
        await sandboxManager.terminateAll();
        if (provider.isAlive()) {
          await provider.terminate();
        }
        sandboxKilled = true;
        console.log('[kill-sandbox] Sandbox stopped successfully');
      } catch (e) {
        console.error('[kill-sandbox] Failed to stop sandbox:', e);
      }
      setActiveSandboxProvider(null);
      global.sandboxData = null;
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    }
    
    return NextResponse.json({
      success: true,
      sandboxKilled,
      message: 'Sandbox cleaned up successfully'
    });
    
  } catch (error) {
    console.error('[kill-sandbox] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
}
