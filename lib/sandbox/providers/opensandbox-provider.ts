import {
  ConnectionConfig,
  Sandbox,
  SandboxException,
  type Execution,
  type FileInfo,
} from '@alibaba-group/opensandbox';
import { appConfig } from '@/config/app.config';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';

const DEFAULT_OPEN_SANDBOX_DOMAIN = 'api.opensandbox.io';

export class OpenSandboxProvider extends SandboxProvider {
  private existingFiles: Set<string> = new Set();
  private connectionConfig: ConnectionConfig | null = null;

  private get settings() {
    const overrides = this.config.openSandbox || {};
    return {
      ...appConfig.openSandbox,
      ...overrides,
      domain: overrides.domain ?? appConfig.openSandbox.domain,
      image: overrides.image ?? appConfig.openSandbox.image,
      timeoutSeconds: overrides.timeoutSeconds ?? appConfig.openSandbox.timeoutSeconds,
      requestTimeoutSeconds: overrides.requestTimeoutSeconds ?? appConfig.openSandbox.requestTimeoutSeconds,
      commandTimeoutSeconds: overrides.commandTimeoutSeconds ?? appConfig.openSandbox.commandTimeoutSeconds,
      workingDirectory: overrides.workingDirectory ?? appConfig.openSandbox.workingDirectory,
      vitePort: overrides.vitePort ?? appConfig.openSandbox.vitePort,
      viteStartupDelay: overrides.viteStartupDelay ?? appConfig.openSandbox.viteStartupDelay,
      resource: overrides.resource ?? appConfig.openSandbox.resource,
      env: overrides.env ?? appConfig.openSandbox.env,
    };
  }

  private get workingDirectory(): string {
    return this.settings.workingDirectory;
  }

  private get vitePort(): number {
    return this.settings.vitePort;
  }

  private getViteBasePath(sandboxUrl: string): string {
    try {
      const pathname = new URL(sandboxUrl).pathname || '/';
      return pathname.endsWith('/') ? pathname : `${pathname}/`;
    } catch {
      return '/';
    }
  }

  private createConnectionConfig(): ConnectionConfig {
    return new ConnectionConfig({
      domain:
        this.settings.domain ||
        process.env.OPENSANDBOX_DOMAIN ||
        process.env.OPEN_SANDBOX_DOMAIN ||
        DEFAULT_OPEN_SANDBOX_DOMAIN,
      apiKey:
        this.settings.apiKey ||
        process.env.OPENSANDBOX_API_KEY ||
        process.env.OPEN_SANDBOX_API_KEY,
      requestTimeoutSeconds: this.settings.requestTimeoutSeconds,
    });
  }

  private toSandboxPath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }

    return `${this.workingDirectory}/${path.replace(/^\/+/, '')}`;
  }

  private toProjectPath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const prefix = `${this.workingDirectory}/`;
    return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized.replace(/^\.\//, '');
  }

  private getParentDirectory(path: string): string | null {
    const index = path.lastIndexOf('/');
    return index > 0 ? path.slice(0, index) : null;
  }

  private commandResultFromExecution(execution: Execution): CommandResult {
    const stdout = execution.logs.stdout.map((message) => message.text).join('');
    const stderrMessages = execution.logs.stderr.map((message) => message.text).join('');
    const errorText = execution.error
      ? [execution.error.name, execution.error.value, ...(execution.error.traceback || [])]
          .filter(Boolean)
          .join('\n')
      : '';
    const stderr = [stderrMessages, errorText].filter(Boolean).join('\n');
    const exitCode = execution.exitCode ?? (execution.error ? 1 : 0);

    return {
      stdout,
      stderr,
      exitCode,
      success: exitCode === 0 && !execution.error,
    };
  }

  private quoteShellArg(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  async reconnect(sandboxId: string): Promise<boolean> {
    try {
      this.connectionConfig = this.createConnectionConfig();
      this.sandbox = await Sandbox.connect({
        connectionConfig: this.connectionConfig,
        sandboxId,
      });

      this.sandboxInfo = {
        sandboxId: this.sandbox.id,
        url: await this.sandbox.getEndpointUrl(this.vitePort),
        provider: 'opensandbox',
        createdAt: new Date(),
      };

      return true;
    } catch (error) {
      console.warn(`[OpenSandboxProvider] Could not reconnect to sandbox ${sandboxId}:`, error);
      await this.closeClient();
      return false;
    }
  }

  async createSandbox(): Promise<SandboxInfo> {
    try {
      if (this.sandbox) {
        await this.terminate();
      }

      this.existingFiles.clear();
      this.connectionConfig = this.createConnectionConfig();
      this.sandbox = await Sandbox.create({
        connectionConfig: this.connectionConfig,
        image: this.settings.image,
        timeoutSeconds: this.settings.timeoutSeconds,
        resource: this.settings.resource,
        env: this.settings.env,
      });

      const sandboxUrl = await this.sandbox.getEndpointUrl(this.vitePort);

      this.sandboxInfo = {
        sandboxId: this.sandbox.id,
        url: sandboxUrl,
        provider: 'opensandbox',
        createdAt: new Date(),
      };

      return this.sandboxInfo;
    } catch (error) {
      if (error instanceof SandboxException) {
        console.error(
          `[OpenSandboxProvider] Error creating sandbox: [${error.error.code}] ${error.error.message ?? ''}`
        );
      } else {
        console.error('[OpenSandboxProvider] Error creating sandbox:', error);
      }
      throw error;
    }
  }

  async runCommand(command: string): Promise<CommandResult> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    try {
      const result = await this.sandbox.commands.run(command, {
        workingDirectory: this.workingDirectory,
        timeoutSeconds: this.settings.commandTimeoutSeconds,
      });

      return this.commandResultFromExecution(result);
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Command failed',
        exitCode: 1,
        success: false,
      };
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    const fullPath = this.toSandboxPath(path);
    const dir = this.getParentDirectory(fullPath);

    if (dir) {
      await this.sandbox.files.createDirectories([{ path: dir, mode: 755 }]);
    }

    await this.sandbox.files.writeFiles([{ path: fullPath, data: content, mode: 644 }]);
    this.existingFiles.add(this.toProjectPath(fullPath));
  }

  async readFile(path: string): Promise<string> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    return this.sandbox.files.readFile(this.toSandboxPath(path));
  }

  async listFiles(directory: string = this.workingDirectory): Promise<string[]> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    const searchPath = directory.startsWith('/') ? directory : this.toSandboxPath(directory);
    const files: FileInfo[] = await this.sandbox.files.search({
      path: searchPath,
      pattern: '**/*',
    });

    return files
      .map((file: FileInfo) => this.toProjectPath(file.path))
      .filter((file: string) => file && !file.endsWith('/'))
      .filter((file: string) => !/(^|\/)(node_modules|\.git|\.next|dist|build)(\/|$)/.test(file));
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    const flags = appConfig.packages.useLegacyPeerDeps ? ['--legacy-peer-deps'] : [];
    const command = ['npm', 'install', ...flags, ...packages].map((part) => this.quoteShellArg(part)).join(' ');
    const result = await this.runCommand(command);

    if (result.success && appConfig.packages.autoRestartVite) {
      await this.restartViteServer();
    }

    return result;
  }

  async setupViteApp(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    const sandboxUrl = this.sandboxInfo?.url || (await this.sandbox.getEndpointUrl(this.vitePort));
    const viteBasePath = this.getViteBasePath(sandboxUrl);
    const sandboxHostname = (() => {
      try {
        return new URL(sandboxUrl).hostname;
      } catch {
        return '';
      }
    })();

    await this.sandbox.files.createDirectories([{ path: `${this.workingDirectory}/src`, mode: 755 }]);
    await this.sandbox.files.writeFiles([
      {
        path: `${this.workingDirectory}/package.json`,
        data: JSON.stringify(
          {
            name: 'sandbox-app',
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: `vite --host 0.0.0.0 --port ${this.vitePort}`,
              build: 'vite build',
              preview: 'vite preview',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@vitejs/plugin-react': '^4.0.0',
              vite: '^4.3.9',
              tailwindcss: '^3.3.0',
              postcss: '^8.4.31',
              autoprefixer: '^10.4.16',
            },
          },
          null,
          2
        ),
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/vite.config.js`,
        data: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '${viteBasePath}',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: ${this.vitePort},
    strictPort: true,
    hmr: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      ${sandboxHostname ? `'${sandboxHostname}',` : ''}
      '.opensandbox.io'
    ]
  }
})`,
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/tailwind.config.js`,
        data: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/postcss.config.js`,
        data: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/index.html`,
        data: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>`,
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/src/main.jsx`,
        data: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/src/App.jsx`,
        data: `function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <p className="text-lg text-gray-400">
          OpenSandbox Ready<br/>
          Start building your React app with Vite and Tailwind CSS!
        </p>
      </div>
    </div>
  )
}

export default App`,
        mode: 644,
      },
      {
        path: `${this.workingDirectory}/src/index.css`,
        data: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}`,
        mode: 644,
      },
    ]);

    const installResult = await this.runCommand('npm install');
    if (!installResult.success) {
      console.warn('[OpenSandboxProvider] npm install had issues:', installResult.stderr);
    }

    await this.restartViteServer();

    [
      'src/App.jsx',
      'src/main.jsx',
      'src/index.css',
      'index.html',
      'package.json',
      'vite.config.js',
      'tailwind.config.js',
      'postcss.config.js',
    ].forEach((file) => this.existingFiles.add(file));
  }

  async restartViteServer(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox');
    }

    await this.runCommand('pkill -f vite || true');
    await this.runCommand(
      `printf %s ${this.quoteShellArg(JSON.stringify({ errors: [], lastChecked: Date.now() }))} > /tmp/vite-errors.json`
    );
    await this.runCommand('bash -lc "nohup npm run dev > /tmp/vite.log 2>&1 &"');
    await new Promise((resolve) => setTimeout(resolve, this.settings.viteStartupDelay));
  }

  getSandboxUrl(): string | null {
    return this.sandboxInfo?.url || null;
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  async terminate(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.kill();
      } catch (error) {
        console.error('[OpenSandboxProvider] Failed to terminate sandbox:', error);
      }
    }

    await this.closeClient();
    this.sandbox = null;
    this.sandboxInfo = null;
  }

  isAlive(): boolean {
    return !!this.sandbox;
  }

  private async closeClient(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.close();
      } catch (error) {
        console.error('[OpenSandboxProvider] Failed to close sandbox client:', error);
      }
    } else if (this.connectionConfig) {
      try {
        await this.connectionConfig.closeTransport();
      } catch (error) {
        console.error('[OpenSandboxProvider] Failed to close connection transport:', error);
      }
    }

    this.connectionConfig = null;
  }
}
