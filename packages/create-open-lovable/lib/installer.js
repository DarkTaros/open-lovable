import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getEnvPrompts } from './prompts.js';

export async function installer(config) {
  const { name, sandbox, path: installPath, skipInstall, dryRun, templatesDir } = config;
  const projectPath = path.join(installPath, name);

  if (dryRun) {
    console.log(chalk.blue('\n📋 Dry run - would perform these actions:'));
    console.log(chalk.gray(`  - Create directory: ${projectPath}`));
    console.log(chalk.gray(`  - Copy base template files`));
    console.log(chalk.gray(`  - Copy ${sandbox}-specific files`));
    console.log(chalk.gray(`  - Create .env file`));
    if (!skipInstall) {
      console.log(chalk.gray(`  - Run npm install`));
    }
    return;
  }

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${name} already exists. Overwrite?`,
      default: false
    }]);

    if (!overwrite) {
      throw new Error('Installation cancelled');
    }
    await fs.remove(projectPath);
  }

  // Create project directory
  await fs.ensureDir(projectPath);

  // Copy base template (shared files)
  const baseTemplatePath = path.join(templatesDir, 'base');
  if (await fs.pathExists(baseTemplatePath)) {
    await copyTemplate(baseTemplatePath, projectPath);
  } else {
    // If no base template exists yet, copy from the main project
    await copyMainProject(path.dirname(templatesDir), projectPath, sandbox);
  }

  // Copy provider-specific template
  const providerTemplatePath = path.join(templatesDir, sandbox);
  if (await fs.pathExists(providerTemplatePath)) {
    await copyTemplate(providerTemplatePath, projectPath);
  }

  // Configure environment variables
  if (config.configureEnv) {
    const envAnswers = await inquirer.prompt(getEnvPrompts(sandbox));
    await createEnvFile(projectPath, sandbox, envAnswers);
  } else {
    // Create .env.example copy
    await createEnvExample(projectPath, sandbox);
  }

  // Update package.json with project name
  await updatePackageJson(projectPath, name);

  // Update configuration to use the selected sandbox provider
  await updateAppConfig(projectPath, sandbox);

  // Install dependencies
  if (!skipInstall) {
    console.log(chalk.cyan('\n📦 Installing dependencies...'));
    execSync('npm install', {
      cwd: projectPath,
      stdio: 'inherit'
    });
  }
}

async function copyTemplate(src, dest) {
  const files = await fs.readdir(src);

  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    const stat = await fs.stat(srcPath);

    if (stat.isDirectory()) {
      await fs.ensureDir(destPath);
      await copyTemplate(srcPath, destPath);
    } else {
      await fs.copy(srcPath, destPath, { overwrite: true });
    }
  }
}

async function copyMainProject(mainProjectPath, projectPath, sandbox) {
  // Copy essential directories and files from the main project
  const itemsToCopy = [
    'app',
    'components',
    'config',
    'lib',
    'types',
    'public',
    'styles',
    '.eslintrc.json',
    '.gitignore',
    'next.config.js',
    'package.json',
    'tailwind.config.ts',
    'tsconfig.json',
    'postcss.config.mjs'
  ];

  for (const item of itemsToCopy) {
    const srcPath = path.join(mainProjectPath, '..', item);
    const destPath = path.join(projectPath, item);

    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath, {
        overwrite: true,
        filter: (src) => {
          // Skip node_modules and .next
          if (src.includes('node_modules') || src.includes('.next')) {
            return false;
          }
          return true;
        }
      });
    }
  }
}

async function createEnvFile(projectPath, sandbox, answers) {
  let envContent = '# Novable Configuration\n\n';

  // Sandbox provider
  envContent += `# Sandbox Provider\n`;
  envContent += `SANDBOX_PROVIDER=opensandbox\n`;
  envContent += `OPENSANDBOX_API_KEY=${answers.openSandboxApiKey || 'your_opensandbox_api_key_here'}\n`;
  envContent += `OPENSANDBOX_DOMAIN=${answers.openSandboxDomain || 'api.opensandbox.io'}\n\n`;

  // Required keys
  envContent += `# REQUIRED - Web scraping for cloning websites\n`;
  envContent += `FIRECRAWL_API_KEY=${answers.firecrawlApiKey || 'your_firecrawl_api_key_here'}\n\n`;

  // Required OpenAI-compatible runtime keys
  envContent += `# REQUIRED - OpenAI-compatible AI runtime\n`;
  envContent += `OPENAI_API_KEY=${answers.openaiApiKey || 'your_openai_compatible_api_key_here'}\n`;
  envContent += `OPENAI_BASE_URL=${answers.openaiBaseUrl || 'https://a.ah-api.com/v1'}\n`;
  envContent += `\n# Deprecated and no longer used at runtime:\n`;
  envContent += `# AI_GATEWAY_API_KEY=\n`;
  envContent += `# ANTHROPIC_API_KEY=\n`;
  envContent += `# GEMINI_API_KEY=\n`;
  envContent += `# GROQ_API_KEY=\n`;

  await fs.writeFile(path.join(projectPath, '.env'), envContent);
  const envExampleContent = envContent
    .replace(/FIRECRAWL_API_KEY=.*/g, 'FIRECRAWL_API_KEY=your_firecrawl_api_key_here')
    .replace(/OPENSANDBOX_API_KEY=.*/g, 'OPENSANDBOX_API_KEY=your_opensandbox_api_key_here')
    .replace(/OPENSANDBOX_DOMAIN=.*/g, 'OPENSANDBOX_DOMAIN=api.opensandbox.io')
    .replace(/OPENAI_API_KEY=.*/g, 'OPENAI_API_KEY=your_openai_compatible_api_key_here')
    .replace(/OPENAI_BASE_URL=.*/g, 'OPENAI_BASE_URL=https://a.ah-api.com/v1');
  await fs.writeFile(path.join(projectPath, '.env.example'), envExampleContent);
}

async function createEnvExample(projectPath, sandbox) {
  let envContent = '# Novable Configuration\n\n';

  envContent += `# Sandbox Provider\n`;
  envContent += `SANDBOX_PROVIDER=opensandbox\n`;
  envContent += `OPENSANDBOX_API_KEY=your_opensandbox_api_key_here\n`;
  envContent += `OPENSANDBOX_DOMAIN=api.opensandbox.io\n\n`;

  envContent += `# REQUIRED - Web scraping for cloning websites\n`;
  envContent += `# Get yours at https://firecrawl.dev\n`;
  envContent += `FIRECRAWL_API_KEY=your_firecrawl_api_key_here\n\n`;

  envContent += `# REQUIRED - OpenAI-compatible AI runtime\n`;
  envContent += `OPENAI_API_KEY=your_openai_compatible_api_key_here\n`;
  envContent += `OPENAI_BASE_URL=https://a.ah-api.com/v1\n\n`;
  envContent += `# Deprecated and no longer used at runtime:\n`;
  envContent += `# AI_GATEWAY_API_KEY=\n`;
  envContent += `# ANTHROPIC_API_KEY=\n`;
  envContent += `# GEMINI_API_KEY=\n`;
  envContent += `# GROQ_API_KEY=\n`;

  await fs.writeFile(path.join(projectPath, '.env.example'), envContent);
}

async function updatePackageJson(projectPath, name) {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.name = name;
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }
}

async function updateAppConfig(projectPath, sandbox) {
  const configPath = path.join(projectPath, 'config', 'app.config.ts');

  if (await fs.pathExists(configPath)) {
    let content = await fs.readFile(configPath, 'utf-8');

    // Add sandbox provider configuration
    const sandboxConfig = `
  // Sandbox Provider Configuration
  sandboxProvider: process.env.SANDBOX_PROVIDER || 'opensandbox',
`;

    // Insert after the opening of appConfig
    content = content.replace(
      'export const appConfig = {',
      `export const appConfig = {${sandboxConfig}`
    );

    await fs.writeFile(configPath, content);
  }
}
