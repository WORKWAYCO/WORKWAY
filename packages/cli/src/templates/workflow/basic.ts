/**
 * Basic Workflow Template
 *
 * A simple workflow that demonstrates the core concepts
 */

export const basicWorkflowTemplate = (name: string, category: string, price: number) => `import { defineWorkflow } from '@workway/sdk/workflow';
import { z } from 'zod';

export default defineWorkflow({
  metadata: {
    id: '${name.toLowerCase().replace(/\s+/g, '-')}',
    name: '${name}',
    tagline: 'A simple workflow to get you started',
    description: 'This is a basic workflow template. Customize it to build your own automation.',
    category: '${category}',
    icon: '⚡',
    version: '1.0.0',
    author: {
      name: 'Your Name',
      email: 'you@example.com',
    },
    tags: ['automation', 'productivity'],
  },

  pricing: {
    model: 'subscription',
    price: ${price},
    trialDays: 7,
    currency: 'usd',
  },

  integrations: ['gmail', 'slack'], // List integrations you'll use

  trigger: {
    type: 'gmail.new-email', // What starts this workflow?
  },

  configSchema: z.object({
    slackChannel: z.string().describe('Slack channel for notifications'),
    emailFilter: z.string().optional().describe('Filter emails by subject (optional)'),
  }),

  configFields: [
    {
      key: 'slackChannel',
      label: 'Slack Channel',
      description: 'Where to send notifications (e.g., #inbox)',
      type: 'text',
      required: true,
      placeholder: '#inbox',
      schema: z.string(),
    },
    {
      key: 'emailFilter',
      label: 'Email Subject Filter',
      description: 'Only process emails with this text in subject (optional)',
      type: 'text',
      required: false,
      placeholder: 'Invoice',
      schema: z.string().optional(),
    },
  ],

  async execute({ trigger, config, actions }) {
    // 1. Get the trigger data
    const { messageId } = trigger.data;

    // 2. Fetch email details using Gmail integration
    const email = await actions.execute('gmail.fetch-email', {
      messageId,
    });

    // 3. Apply filter if configured
    if (config.emailFilter && !email.subject.includes(config.emailFilter)) {
      console.log('Email does not match filter, skipping');
      return { success: true, skipped: true };
    }

    // 4. Send Slack notification
    await actions.execute('slack.send-message', {
      channel: config.slackChannel,
      text: \`📧 New email from \${email.from}: \${email.subject}\`,
    });

    return {
      success: true,
      emailProcessed: email.subject,
    };
  },
});
`;

export const testDataTemplate = () => `{
  "trigger": {
    "type": "gmail.new-email",
    "data": {
      "messageId": "msg_test_123",
      "from": "test@example.com",
      "subject": "Test Email Subject"
    }
  },
  "config": {
    "slackChannel": "#test",
    "emailFilter": ""
  }
}
`;

export const readmeTemplate = (name: string) => `# ${name}

This is a WORKWAY workflow created with \`workway workflow init\`.

## Getting Started

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure OAuth

Connect the required OAuth accounts for testing:

\`\`\`bash
workway oauth connect gmail
workway oauth connect slack
\`\`\`

### 3. Test Locally

Test with mock data:
\`\`\`bash
workway workflow test --mock
\`\`\`

Test with live OAuth:
\`\`\`bash
workway workflow test --live
\`\`\`

### 4. Customize

Edit \`workflow.ts\` to customize your workflow:
- Change the trigger
- Add more integration actions
- Modify the configuration schema
- Update pricing and metadata

### 5. Publish

When ready, publish to the marketplace:
\`\`\`bash
workway workflow publish
\`\`\`

## Documentation

- [Workflow SDK Docs](https://docs.workway.dev/sdk/workflow)
- [Integration Actions](https://docs.workway.dev/integrations)
- [Testing Guide](https://docs.workway.dev/testing)
- [Publishing Guide](https://docs.workway.dev/publishing)

## Support

Need help? Join our community:
- Discord: https://discord.gg/workway
- Email: support@workway.dev
`;

export const packageJsonTemplate = (name: string) => `{
  "name": "${name.toLowerCase().replace(/\s+/g, '-')}",
  "version": "1.0.0",
  "description": "A WORKWAY workflow",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "workway workflow test --mock",
    "test:live": "workway workflow test --live",
    "dev": "workway workflow dev",
    "build": "workway workflow build",
    "publish": "workway workflow publish"
  },
  "dependencies": {
    "@workway/sdk": "latest",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
`;

export const gitignoreTemplate = () => `node_modules/
dist/
.env
.dev.vars
*.log
.DS_Store
`;

export const workwayConfigTemplate = () => `{
  "dev": {
    "port": 3000,
    "hotReload": true,
    "mockMode": true
  },
  "test": {
    "testDataFile": "./test-data.json",
    "timeout": 30000
  },
  "build": {
    "outDir": "./dist",
    "minify": false
  },
  "publish": {
    "screenshots": [],
    "demoVideo": ""
  }
}
`;
