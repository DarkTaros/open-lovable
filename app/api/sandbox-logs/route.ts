import { NextResponse } from 'next/server';
import { getActiveSandboxProvider } from '@/lib/sandbox/provider-state';

export async function GET() {
  try {
    const provider = getActiveSandboxProvider();

    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }
    
    console.log('[sandbox-logs] Fetching Vite dev server logs...');
    
    const psResult = await provider.runCommand('ps aux');
    let viteRunning = false;
    const logContent: string[] = [];
    
    if (psResult.success) {
      const viteProcesses = psResult.stdout.split('\n').filter((line: string) => 
        line.toLowerCase().includes('vite') || 
        line.toLowerCase().includes('npm run dev')
      );
      
      viteRunning = viteProcesses.length > 0;
      
      if (viteRunning) {
        logContent.push('Vite is running');
        logContent.push(...viteProcesses.slice(0, 3));
      } else {
        logContent.push('Vite process not found');
      }
    }
    
    try {
      const findResult = await provider.runCommand(`find /tmp -name '*vite*' -name '*.log' -type f`);
      
      if (findResult.success) {
        const logFiles = findResult.stdout.split('\n').filter((f: string) => f.trim());
        
        for (const logFile of logFiles.slice(0, 2)) {
          const catResult = await provider.runCommand(`tail -n 10 "${logFile.replace(/"/g, '\\"')}"`);
          
          if (catResult.success) {
            logContent.push(`--- ${logFile} ---`);
            logContent.push(catResult.stdout);
          }
        }
      }
    } catch {
      // No log files found, that's OK.
    }
    
    return NextResponse.json({
      success: true,
      hasErrors: false,
      logs: logContent,
      status: viteRunning ? 'running' : 'stopped'
    });
    
  } catch (error) {
    console.error('[sandbox-logs] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
