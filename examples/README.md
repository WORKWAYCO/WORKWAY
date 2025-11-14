# WORKWAY Workflow Examples

Production-ready workflow templates you can fork, customize, and deploy to the WORKWAY marketplace.

## 📚 Available Examples

### Email & Communication
- **[Gmail to Notion](./gmail-to-notion)** - Automatically sync Gmail emails to a Notion database
  - Filter by labels, sender, or keywords
  - Extract structured data from emails
  - Create rich Notion pages with email content
  - Suggested pricing: $29-49/month

- **[AI Email Assistant](./ai-email-assistant)** - Intelligent email responses powered by AI
  - Auto-categorize incoming emails
  - Generate contextual responses
  - Schedule and send replies
  - Suggested pricing: $49-99/month

- **[Voice to Notion](./voice-to-notion)** - Transcribe voice recordings to Notion
  - Process audio files automatically
  - Create structured notes from transcriptions
  - Support multiple languages
  - Suggested pricing: $39-79/month

### Business Automation
- **[Invoice Processor](./invoice-processor)** - Extract and process invoice data
  - OCR for PDF invoices
  - Extract line items and totals
  - Export to accounting systems
  - Suggested pricing: $99-199/month

- **[AI Support Agent](./ai-support-agent)** - Automated customer support
  - Intelligent ticket routing
  - Auto-generate responses
  - Escalation workflows
  - Suggested pricing: $199-399/month

### Content & Media
- **[Smart Content Pipeline](./smart-content-pipeline)** - AI-powered content processing
  - Generate SEO metadata
  - Create content variations
  - Optimize for different platforms
  - Suggested pricing: $79-149/month

- **[Image Analysis Workflow](./image-analysis-workflow)** - AI image processing
  - Object detection and classification
  - Generate alt text and descriptions
  - Content moderation
  - Suggested pricing: $49-99/month

## 🚀 Using These Examples

### 1. Clone an Example
```bash
# Clone the entire examples repository
git clone https://github.com/workway/workway
cd workway/examples

# Or copy a specific example
cp -r gmail-to-notion my-workflow
cd my-workflow
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Integrations
```bash
# Copy environment template
cp .env.example .env

# Add your API keys and configuration
# Each example includes detailed setup instructions
```

### 4. Test Locally
```bash
# Run the development server
workway dev

# Test your workflow
workway test
```

### 5. Deploy to Marketplace
```bash
# Login to WORKWAY
workway login

# Deploy your workflow
workway deploy

# Set your pricing
workway pricing set --upfront 49 --monthly
```

## 💰 Monetization Strategy

Each example includes recommended pricing based on:
- **Complexity**: Simple ($29-49), Medium ($49-99), Complex ($99+)
- **Value Provided**: Time saved, automation ROI
- **Target Audience**: Individuals, SMBs, Enterprise
- **Execution Costs**: Light (5¢) vs Heavy (25¢) workflows

### Pricing Guidelines
- **Personal Use**: $29-49/month
- **Small Business**: $49-149/month
- **Enterprise**: $199+/month

Remember: You keep 100% of upfront fees!

## 🛠️ Example Structure

Each example follows this structure:
```
example-workflow/
├── src/
│   ├── index.ts         # Main workflow logic
│   ├── actions/         # Individual workflow actions
│   └── lib/            # Helper functions
├── tests/              # Test files
├── workway.json        # Workflow configuration
├── package.json        # Dependencies
├── .env.example        # Environment template
├── README.md          # Setup instructions
└── tsconfig.json      # TypeScript config
```

## 📖 Documentation

Each example includes:
- **README.md**: Detailed setup and usage instructions
- **workway.json**: Workflow metadata and configuration
- **.env.example**: Required environment variables
- **tests/**: Example test cases

## 🤝 Contributing

We welcome new example workflows! To contribute:

1. Fork the repository
2. Create your example following the structure above
3. Include comprehensive documentation
4. Add tests for your workflow
5. Submit a pull request

## 📄 License

All examples are licensed under Apache 2.0. You're free to:
- Use commercially
- Modify and distribute
- Use privately
- Use for patent claims

## 🆘 Support

- **Documentation**: [docs.workway.co](https://docs.workway.co)
- **Discord**: [discord.gg/workway](https://discord.gg/workway)
- **GitHub Issues**: [github.com/workway/workway/issues](https://github.com/workway/workway/issues)

## ⚡ Quick Tips

1. **Start Simple**: Begin with a basic example and expand
2. **Test Thoroughly**: Use `workway test` before deploying
3. **Price Competitively**: Research similar automation tools
4. **Document Well**: Clear docs increase adoption
5. **Provide Support**: Responsive support drives retention

---

Ready to build your first workflow? Pick an example above and get started! 🚀