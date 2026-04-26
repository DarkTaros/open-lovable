import { SandboxProvider, SandboxProviderConfig } from './types';
import { OpenSandboxProvider } from './providers/opensandbox-provider';

export class SandboxFactory {
  static create(provider?: string, config?: SandboxProviderConfig): SandboxProvider {
    // Use environment variable if provider not specified
    const selectedProvider = provider || process.env.SANDBOX_PROVIDER || 'opensandbox';
    
    
    switch (selectedProvider.toLowerCase()) {
      case 'opensandbox':
      case 'open-sandbox':
        return new OpenSandboxProvider(config || {});
      
      default:
        throw new Error(`Unknown sandbox provider: ${selectedProvider}. Supported providers: opensandbox`);
    }
  }
  
  static getAvailableProviders(): string[] {
    return ['opensandbox'];
  }
  
  static isProviderAvailable(provider: string): boolean {
    switch (provider.toLowerCase()) {
      case 'opensandbox':
      case 'open-sandbox':
        return !!process.env.OPENSANDBOX_API_KEY || !!process.env.OPEN_SANDBOX_API_KEY;
      
      default:
        return false;
    }
  }
}
