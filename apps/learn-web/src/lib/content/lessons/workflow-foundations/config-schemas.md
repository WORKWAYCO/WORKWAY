# Configuration Schemas

## Learning Objectives

By the end of this lesson, you will be able to:

- Define workflow inputs using the modern `inputs` pattern
- Use appropriate input types: `text`, `number`, `boolean`, `select`, `picker`
- Create dynamic pickers for Notion databases, Slack channels, and other resources
- Provide sensible defaults that make workflows work out of the box
- Group related inputs for better user experience

---

Config schemas define what users customize. Good schemas make workflows flexible without overwhelming users.

## Step-by-Step: Design Your Config Schema

### Step 1: Identify Required vs Optional

List everything your workflow needs. Mark each as required or optional:

```
Required:
- Notion database to save to
- Zoom account connected

Optional (has sensible default):
- Include transcript (default: true)
- Summary format (default: bullets)
- Slack notifications (default: off)
```

### Step 2: Start with Required Fields Only

Add only the essential fields to your schema:

```typescript
inputs: {
  notionDatabase: {
    type: 'picker',
    pickerType: 'notion:database',
    label: 'Meeting Notes Database',
    description: 'Where your meeting notes will be saved',
    required: true,
  },
},
```

### Step 3: Add Optional Fields with Defaults

Add optional fields with sensible defaults so the workflow works immediately:

```typescript
inputs: {
  notionDatabase: {
    type: 'picker',
    pickerType: 'notion:database',
    label: 'Meeting Notes Database',
    required: true,
  },
  includeTranscript: {
    type: 'boolean',
    label: 'Include Full Transcript',
    default: true,
  },
  summaryFormat: {
    type: 'select',
    label: 'Summary Style',
    options: [
      { value: 'bullets', label: 'Bullet Points' },
      { value: 'brief', label: 'Brief Summary' },
      { value: 'detailed', label: 'Detailed Summary' },
    ],
    default: 'bullets',
  },
},
```

### Step 4: Add Conditional Fields

Use `showIf` to reveal advanced options only when needed:

```typescript
inputs: {
  // ... existing fields
  enableNotifications: {
    type: 'boolean',
    label: 'Send Slack Notifications',
    default: false,
  },
  slackChannel: {
    type: 'picker',
    pickerType: 'slack:channel',
    label: 'Notification Channel',
    showIf: { enableNotifications: true },
  },
},
```

### Step 5: Test the User Experience

Review your schema from the user's perspective:

1. How many clicks to get started? (aim for 1-2)
2. Are labels clear without technical jargon?
3. Do defaults make sense for most users?
4. Is optional configuration hidden until needed?

---

## The Config Schema

```typescript
configSchema: {
  fieldName: {
    type: 'text',           // Input type
    label: 'Field Label',   // Shown to user
    description: 'Help text', // Explains the field
    required: true,         // Is it mandatory?
    default: 'value',       // Pre-filled value
  },
}
```

## Input Types

### Text Input

For strings, API keys, custom values:

```typescript
apiKey: {
  type: 'text',
  label: 'API Key',
  description: 'Your service API key',
  required: true,
  secret: true,  // Masks input, encrypts storage
}

customMessage: {
  type: 'text',
  label: 'Welcome Message',
  description: 'Message sent to new subscribers',
  default: 'Welcome to the team!',
  multiline: true,  // Textarea instead of input
}
```

### Number Input

For numeric values with optional bounds:

```typescript
maxResults: {
  type: 'number',
  label: 'Maximum Results',
  description: 'How many items to process',
  default: 10,
  min: 1,
  max: 100,
}

delayMinutes: {
  type: 'number',
  label: 'Delay (minutes)',
  description: 'Wait time before sending',
  default: 5,
}
```

### Boolean Toggle

For on/off settings:

```typescript
includeTranscript: {
  type: 'boolean',
  label: 'Include Transcript',
  description: 'Add full meeting transcript to notes',
  default: true,
}

sendNotification: {
  type: 'boolean',
  label: 'Send Slack Notification',
  default: false,
}
```

### Select Dropdown

For predefined options:

```typescript
priority: {
  type: 'select',
  label: 'Default Priority',
  options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ],
  default: 'medium',
}

format: {
  type: 'select',
  label: 'Output Format',
  options: [
    { value: 'detailed', label: 'Detailed Summary' },
    { value: 'brief', label: 'Brief Overview' },
    { value: 'bullets', label: 'Bullet Points' },
  ],
}
```

### Picker (Dynamic)

For selecting from user's connected services:

```typescript
notionDatabase: {
  type: 'picker',
  label: 'Destination Database',
  pickerType: 'notion:database',
  required: true,
}

slackChannel: {
  type: 'picker',
  label: 'Notification Channel',
  pickerType: 'slack:channel',
  required: true,
}

googleCalendar: {
  type: 'picker',
  label: 'Calendar',
  pickerType: 'google-calendar:calendar',
}
```

**Available picker types**:
- `notion:database` - User's Notion databases
- `notion:page` - User's Notion pages
- `slack:channel` - Slack channels user can access
- `slack:user` - Slack workspace members
- `google-calendar:calendar` - User's calendars
- `gmail:label` - Gmail labels

## Multi-Step Workflows

For workflows with multiple actions, use step-based config:

```typescript
configSchema: {
  steps: {
    type: 'steps',
    items: [
      {
        id: 'capture',
        name: 'Capture Meeting',
        config: {
          source: {
            type: 'select',
            label: 'Meeting Source',
            options: [
              { value: 'zoom', label: 'Zoom' },
              { value: 'google-meet', label: 'Google Meet' },
            ],
          },
        },
      },
      {
        id: 'save',
        name: 'Save to Notion',
        config: {
          database: {
            type: 'picker',
            pickerType: 'notion:database',
            label: 'Database',
          },
        },
      },
      {
        id: 'notify',
        name: 'Send Notification',
        optional: true,
        config: {
          channel: {
            type: 'picker',
            pickerType: 'slack:channel',
            label: 'Slack Channel',
          },
        },
      },
    ],
  },
}
```

## Conditional Fields

Show fields based on other selections:

```typescript
configSchema: {
  notificationType: {
    type: 'select',
    label: 'Notification Type',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'slack', label: 'Slack' },
      { value: 'none', label: 'None' },
    ],
  },

  emailAddress: {
    type: 'text',
    label: 'Email Address',
    showIf: { notificationType: 'email' },
  },

  slackChannel: {
    type: 'picker',
    pickerType: 'slack:channel',
    label: 'Slack Channel',
    showIf: { notificationType: 'slack' },
  },
}
```

## Validation

Built-in validation for common patterns:

```typescript
email: {
  type: 'text',
  label: 'Notification Email',
  validation: {
    pattern: 'email',
  },
}

url: {
  type: 'text',
  label: 'Webhook URL',
  validation: {
    pattern: 'url',
  },
}

custom: {
  type: 'text',
  label: 'Project Code',
  validation: {
    regex: '^PRJ-[0-9]{4}$',
    message: 'Must be PRJ- followed by 4 digits',
  },
}
```

## Accessing Config in Execute

```typescript
async execute({ config }) {
  // Config values are typed and validated
  const database = config.notionDatabase;    // string (picker value)
  const maxResults = config.maxResults;       // number
  const includeTranscript = config.includeTranscript; // boolean

  // Step config for multi-step workflows
  const captureSource = config.steps.capture.source;
  const notifyChannel = config.steps.notify?.channel;  // Optional step
}
```

## Design Principles

### 1. Sensible Defaults

```typescript
// Good - works out of box
maxResults: {
  type: 'number',
  default: 10,  // User can adjust, but doesn't have to
}

// Bad - requires decision on install
maxResults: {
  type: 'number',
  required: true,  // Forces user to think about it
}
```

### 2. Clear Labels

```typescript
// Good - clear purpose
{
  label: 'Meeting Notes Database',
  description: 'Where your meeting notes will be saved',
}

// Bad - jargon
{
  label: 'Target DB',
  description: 'Notion database ID for persistence',
}
```

### 3. Progressive Disclosure

Put required fields first, optional fields later. Use `showIf` to hide complexity:

```typescript
// Required - always visible
notionDatabase: { type: 'picker', required: true },

// Optional - only shown when relevant
customTemplate: {
  type: 'text',
  showIf: { useCustomTemplate: true },
}
```

### 4. Minimize Required Fields

Every required field is friction. Can it have a default? Can it be optional?

```typescript
// Question every 'required: true'
slackChannel: {
  type: 'picker',
  // Is this really required, or just nice to have?
  required: false,  // Make it optional with fallback
}
```

## Complete Example

```typescript
configSchema: {
  // Primary settings (required)
  notionDatabase: {
    type: 'picker',
    pickerType: 'notion:database',
    label: 'Meeting Notes Database',
    description: 'Select where to save your meeting notes',
    required: true,
  },

  // Content options (with defaults)
  includeTranscript: {
    type: 'boolean',
    label: 'Include Full Transcript',
    description: 'Add the complete meeting transcript',
    default: true,
  },

  summaryFormat: {
    type: 'select',
    label: 'Summary Format',
    options: [
      { value: 'brief', label: 'Brief (2-3 sentences)' },
      { value: 'detailed', label: 'Detailed (full summary)' },
      { value: 'bullets', label: 'Bullet Points' },
    ],
    default: 'bullets',
  },

  // Notifications (optional)
  enableNotifications: {
    type: 'boolean',
    label: 'Send Notifications',
    default: false,
  },

  slackChannel: {
    type: 'picker',
    pickerType: 'slack:channel',
    label: 'Notification Channel',
    showIf: { enableNotifications: true },
  },
}
```

## Common Pitfalls

### Too Many Required Fields

Every required field is friction. Users abandon complex setups:

```typescript
// Wrong - overwhelming setup
inputs: {
  notionDatabase: { type: 'picker', required: true },
  slackChannel: { type: 'picker', required: true },
  emailRecipient: { type: 'text', required: true },
  scheduleTime: { type: 'text', required: true },
  timezone: { type: 'select', required: true },
  format: { type: 'select', required: true },
}

// Right - essential only, smart defaults for rest
inputs: {
  notionDatabase: { type: 'picker', required: true },  // Essential
  slackChannel: { type: 'picker', required: false, description: 'Optional notifications' },
  format: { type: 'select', default: 'bullets' },  // Has default
}
```

### Missing Default Values

Force users to make decisions they shouldn't need to:

```typescript
// Wrong - requires user to choose
maxResults: {
  type: 'number',
  label: 'Maximum Results',
  required: true,  // User must pick a number
}

// Right - sensible default
maxResults: {
  type: 'number',
  label: 'Maximum Results',
  default: 10,  // Works out of the box
  description: 'Adjust if needed',
}
```

### Jargon in Labels

Use outcome-focused language, not technical terms:

```typescript
// Wrong - developer speak
{
  label: 'Notion DB UUID',
  description: 'The database_id parameter for page creation',
}

// Right - user outcome
{
  label: 'Meeting Notes Database',
  description: 'Where your meeting summaries will appear',
}
```

### Type Mismatch in Execute

Config values have specific types - don't assume:

```typescript
// Wrong - assumes string is number
inputs: {
  maxItems: { type: 'text', label: 'Max Items' },
}
async execute({ inputs }) {
  for (let i = 0; i < inputs.maxItems; i++) {  // "10" !== 10
    // ...
  }
}

// Right - use number type
inputs: {
  maxItems: { type: 'number', label: 'Max Items', default: 10 },
}
async execute({ inputs }) {
  for (let i = 0; i < inputs.maxItems; i++) {  // 10 is number
    // ...
  }
}
```

### Forgetting showIf Dependencies

Conditional fields need their dependency to exist:

```typescript
// Wrong - showIf references non-existent field
inputs: {
  slackChannel: {
    type: 'picker',
    showIf: { enableNotifications: true },  // enableNotifications not defined!
  },
}

// Right - define the controlling field
inputs: {
  enableNotifications: {
    type: 'boolean',
    label: 'Enable Notifications',
    default: false,
  },
  slackChannel: {
    type: 'picker',
    showIf: { enableNotifications: true },  // Now works
  },
}
```

### Not Validating Picker Values

Pickers return IDs that might become invalid:

```typescript
// Wrong - assumes picker value always valid
async execute({ inputs, integrations }) {
  await integrations.notion.pages.create({
    parent: { database_id: inputs.notionDatabase },  // What if deleted?
  });
}

// Right - handle missing/invalid
async execute({ inputs, integrations }) {
  const result = await integrations.notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
  });
  if (!result.success && result.error?.code === 'NOT_FOUND') {
    return {
      success: false,
      error: 'The selected database no longer exists. Please reconfigure.',
    };
  }
}
```

## Praxis

Design a config schema for one of your outcome statements from the earlier lesson:

> **Praxis**: Ask Claude Code: "Help me design a configSchema for a workflow that [your outcome]"

Follow these principles:
1. Start with the minimum required fields
2. Add sensible defaults for everything optional
3. Use pickers where possible instead of text input
4. Add `showIf` for conditional fields

Example for a meeting notes workflow:

```typescript
configSchema: {
  notionDatabase: {
    type: 'picker',
    pickerType: 'notion:database',
    label: 'Meeting Notes Database',
    required: true,
  },
  includeSummary: {
    type: 'boolean',
    label: 'AI Summary',
    default: true,
  },
  slackChannel: {
    type: 'picker',
    pickerType: 'slack:channel',
    label: 'Notification Channel',
    showIf: { enableNotifications: true },
  },
}
```

Count your required fields. Can any become optional with defaults?

## Reflection

- How do good defaults reduce friction for users?
- What's the minimum configuration your workflow actually needs?
- How does progressive disclosure help the interface recede?
