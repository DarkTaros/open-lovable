export function getPrompts(config) {
  const prompts = [];

  if (!config.name) {
    prompts.push({
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'my-Novable',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    });
  }

  if (!config.sandbox) {
    prompts.push({
      type: 'list',
      name: 'sandbox',
      message: 'Choose your sandbox provider:',
      choices: [
        {
          name: 'OpenSandbox - Open source development sandboxes',
          value: 'opensandbox',
          short: 'OpenSandbox'
        }
      ],
      default: 'opensandbox'
    });
  }

  prompts.push({
    type: 'confirm',
    name: 'configureEnv',
    message: 'Would you like to configure API keys now?',
    default: true
  });

  return prompts;
}

export function getEnvPrompts(provider) {
  const prompts = [];

  // Always include Firecrawl API key
  prompts.push({
    type: 'input',
    name: 'firecrawlApiKey',
    message: 'Firecrawl API key (for web scraping):',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'Firecrawl API key is required for web scraping functionality';
      }
      return true;
    }
  });

  prompts.push({
    type: 'input',
    name: 'openSandboxApiKey',
    message: 'OpenSandbox API key:',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'OpenSandbox API key is required';
      }
      return true;
    }
  });

  prompts.push({
    type: 'input',
    name: 'openSandboxDomain',
    message: 'OpenSandbox domain:',
    default: 'api.opensandbox.io',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'OpenSandbox domain is required';
      }
      return true;
    }
  });

  prompts.push({
    type: 'input',
    name: 'openaiApiKey',
    message: 'OpenAI-compatible API key:',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'OpenAI-compatible API key is required';
      }
      return true;
    }
  });

  prompts.push({
    type: 'input',
    name: 'openaiBaseUrl',
    message: 'OpenAI-compatible base URL:',
    default: 'https://a.ah-api.com/v1',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'OpenAI-compatible base URL is required';
      }
      return true;
    }
  });

  return prompts;
}
