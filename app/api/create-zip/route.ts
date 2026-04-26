import { NextResponse } from 'next/server';
import { getActiveSandboxProvider } from '@/lib/sandbox/provider-state';

export async function POST() {
  try {
    const provider = getActiveSandboxProvider();

    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }
    
    console.log('[create-zip] Creating project zip...');
    
    const zipResult = await provider.runCommand(
      `zip -r /tmp/project.zip . -x "node_modules/*" ".git/*" ".next/*" "dist/*" "build/*" "*.log"`
    );
    
    if (!zipResult.success) {
      throw new Error(`Failed to create zip: ${zipResult.stderr}`);
    }
    
    const sizeResult = await provider.runCommand(`ls -la /tmp/project.zip | awk '{print $5}'`);
    const fileSize = sizeResult.stdout.trim();
    console.log(`[create-zip] Created project.zip (${fileSize} bytes)`);
    
    const readResult = await provider.runCommand('base64 /tmp/project.zip');
    
    if (!readResult.success) {
      throw new Error(`Failed to read zip file: ${readResult.stderr}`);
    }
    
    const base64Content = readResult.stdout.trim();
    const dataUrl = `data:application/zip;base64,${base64Content}`;
    
    return NextResponse.json({
      success: true,
      dataUrl,
      fileName: 'opensandbox-project.zip',
      message: 'Zip file created successfully'
    });
    
  } catch (error) {
    console.error('[create-zip] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
}
