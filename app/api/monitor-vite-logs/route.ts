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
    
    console.log('[monitor-vite-logs] Checking Vite process logs...');
    
    const errors: any[] = [];
    
    try {
      const errorFileContent = await provider.readFile('/tmp/vite-errors.json');
      const data = JSON.parse(errorFileContent);
      errors.push(...(data.errors || []));
    } catch {
      // No error file exists, that's OK.
    }
    
    try {
      const findResult = await provider.runCommand(`find /tmp -name '*vite*' -type f`);
      
      if (findResult.success) {
        const logFiles = findResult.stdout.split('\n').filter((f: string) => f.trim());
        
        for (const logFile of logFiles.slice(0, 3)) {
          const grepResult = await provider.runCommand(
            `grep -i 'failed to resolve import' "${logFile.replace(/"/g, '\\"')}"`
          );
          
          if (grepResult.success) {
            const errorLines = grepResult.stdout.split('\n').filter((line: string) => line.trim());
            
            for (const line of errorLines) {
              const importMatch = line.match(/"([^"]+)"/);
              if (importMatch) {
                const importPath = importMatch[1];
                
                if (!importPath.startsWith('.')) {
                  const packageName = importPath.startsWith('@')
                    ? importPath.split('/').slice(0, 2).join('/')
                    : importPath.split('/')[0];
                  
                  const errorObj = {
                    type: 'npm-missing',
                    package: packageName,
                    message: `Failed to resolve import "${importPath}"`,
                    file: 'Unknown'
                  };
                  
                  if (!errors.some(e => e.package === errorObj.package)) {
                    errors.push(errorObj);
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // No log files found, that's OK.
    }
    
    const uniqueErrors: any[] = [];
    const seenPackages = new Set<string>();
    
    for (const error of errors) {
      if (error.package && !seenPackages.has(error.package)) {
        seenPackages.add(error.package);
        uniqueErrors.push(error);
      }
    }
    
    return NextResponse.json({
      success: true,
      hasErrors: uniqueErrors.length > 0,
      errors: uniqueErrors
    });
    
  } catch (error) {
    console.error('[monitor-vite-logs] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
