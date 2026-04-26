// Application Configuration
// This file contains all configurable settings for the application

export const appConfig = {
  // OpenSandbox Configuration
  openSandbox: {
    // API server domain. Override with OPENSANDBOX_DOMAIN when self-hosting.
    domain: process.env.OPENSANDBOX_DOMAIN || process.env.OPEN_SANDBOX_DOMAIN || "api.opensandbox.io",

    // Container image used for generated Vite projects.
    image: "node:22",

    // Sandbox timeout in seconds.
    timeoutSeconds: 30 * 60,

    // SDK HTTP request timeout in seconds.
    requestTimeoutSeconds: 60,

    // Command execution timeout in seconds.
    commandTimeoutSeconds: 120,

    // Development server port.
    // OpenSandbox's Docker backend maps container port 8080 directly; other
    // ports go through /proxy/{port}, which conflicts with Vite base redirects.
    vitePort: 8080,

    // Time to wait for Vite dev server to be ready (in milliseconds)
    viteStartupDelay: 10000,

    // Working directory in sandbox
    workingDirectory: "/home/user/app",

    // Optional container resource limits.
    resource: undefined as Record<string, string> | undefined,

    // Optional environment variables injected into the sandbox.
    env: undefined as Record<string, string> | undefined,
  },

  // AI Model Configuration
  ai: {
    // Default AI model
    defaultModel: "openai/gpt-5.4",

    // Available model IDs exposed in the UI.
    availableModels: ["openai/gpt-5.4"],

    // User-facing model labels.
    modelDisplayNames: {
      "openai/gpt-5.4": "GPT-5.4",
    } as Record<string, string>,

    // Temperature settings for non-reasoning models
    defaultTemperature: 0.7,

    // Max tokens for code generation
    maxTokens: 8000,

    // Max tokens for truncation recovery
    truncationRecoveryMaxTokens: 4000,
  },

  // Code Application Configuration
  codeApplication: {
    // Delay after applying code before refreshing iframe (milliseconds)
    defaultRefreshDelay: 2000,

    // Delay when packages are installed (milliseconds)
    packageInstallRefreshDelay: 5000,

    // Enable/disable automatic truncation recovery
    enableTruncationRecovery: false, // Disabled - too many false positives

    // Maximum number of truncation recovery attempts per file
    maxTruncationRecoveryAttempts: 1,
  },

  // UI Configuration
  ui: {
    // Show/hide certain UI elements
    showModelSelector: false,
    showStatusIndicator: true,

    // Animation durations (milliseconds)
    animationDuration: 200,

    // Toast notification duration (milliseconds)
    toastDuration: 3000,

    // Maximum chat messages to keep in memory
    maxChatMessages: 100,

    // Maximum recent messages to send as context
    maxRecentMessagesContext: 20,
  },

  // Development Configuration
  dev: {
    // Enable debug logging
    enableDebugLogging: true,

    // Enable performance monitoring
    enablePerformanceMonitoring: false,

    // Log API responses
    logApiResponses: true,
  },

  // Package Installation Configuration
  packages: {
    // Use --legacy-peer-deps flag for npm install
    useLegacyPeerDeps: true,

    // Package installation timeout (milliseconds)
    installTimeout: 60000,

    // Auto-restart Vite after package installation
    autoRestartVite: true,
  },

  // File Management Configuration
  files: {
    // Excluded file patterns (files to ignore)
    excludePatterns: [
      "node_modules/**",
      ".git/**",
      ".next/**",
      "dist/**",
      "build/**",
      "*.log",
      ".DS_Store",
    ],

    // Maximum file size to read (bytes)
    maxFileSize: 1024 * 1024, // 1MB

    // File extensions to treat as text
    textFileExtensions: [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".css",
      ".scss",
      ".sass",
      ".html",
      ".xml",
      ".svg",
      ".json",
      ".yml",
      ".yaml",
      ".md",
      ".txt",
      ".env",
      ".gitignore",
      ".dockerignore",
    ],
  },

  // API Endpoints Configuration (for external services)
  api: {
    // Retry configuration
    maxRetries: 3,
    retryDelay: 1000, // milliseconds

    // Request timeout (milliseconds)
    requestTimeout: 30000,
  },
};

// Type-safe config getter
export function getConfig<K extends keyof typeof appConfig>(
  key: K,
): (typeof appConfig)[K] {
  return appConfig[key];
}

export function resolveAiModel(model?: string | null): string {
  const normalizedModel = model?.trim();
  return normalizedModel && appConfig.ai.availableModels.includes(normalizedModel)
    ? normalizedModel
    : appConfig.ai.defaultModel;
}

// Helper to get nested config values
export function getConfigValue(path: string): any {
  return path.split(".").reduce((obj, key) => obj?.[key], appConfig as any);
}

export default appConfig;
