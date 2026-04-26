import { NextResponse } from 'next/server';
import { getActiveSandboxProvider } from '@/lib/sandbox/provider-state';

declare global {
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function GET() {
  try {
    const provider = getActiveSandboxProvider();
    const sandboxExists = !!provider;

    let sandboxHealthy = false;
    let sandboxInfo = null;

    if (sandboxExists && provider) {
      try {
        // Check if sandbox is healthy by getting its info
        const providerInfo = provider.getSandboxInfo();
        sandboxHealthy = !!providerInfo;
        
        sandboxInfo = {
          sandboxId: providerInfo?.sandboxId || global.sandboxData?.sandboxId,
          url: providerInfo?.url || global.sandboxData?.url,
          filesTracked: global.existingFiles ? Array.from(global.existingFiles) : [],
          lastHealthCheck: new Date().toISOString()
        };
      } catch (error) {
        console.error('[sandbox-status] Health check failed:', error);
        sandboxHealthy = false;
      }
    }
    
    return NextResponse.json({
      success: true,
      active: sandboxExists,
      healthy: sandboxHealthy,
      sandboxData: sandboxInfo,
      message: sandboxHealthy 
        ? 'Sandbox is active and healthy' 
        : sandboxExists 
          ? 'Sandbox exists but is not responding' 
          : 'No active sandbox'
    });
    
  } catch (error) {
    console.error('[sandbox-status] Error:', error);
    return NextResponse.json({ 
      success: false,
      active: false,
      error: (error as Error).message 
    }, { status: 500 });
  }
}
