# GR LinkedIn Automator

An AI-powered Screenpipe plugin that automates LinkedIn business development activities with intelligent suggestions and comprehensive safety features.

## ✨ Features

### 🤝 Smart Connection Suggestions
- AI analyzes LinkedIn search results and profiles
- Identifies relevant professionals to connect with
- Provides reasoning for each suggestion
- Generates personalized connection messages

### 👍 Intelligent Post Engagement
- Analyzes feed posts for relevance
- Suggests likes for valuable content
- Conservative AI ensures quality over quantity

### ✉️ Message Automation
- Generates personalized outreach messages
- Suggests messages based on profile analysis
- Maintains professional tone and context

### 📊 Profile Analysis
- Evaluates profiles for connection opportunities
- Provides detailed reasoning for recommendations
- Assesses business relevance

### 📈 Real-time Statistics
- Tracks connections suggested
- Monitors post engagement
- Records message activity
- Displays recent activity log
- Shows error logs for debugging

## 🚀 Quick Start

### Prerequisites

1. Install [Screenpipe](https://github.com/mediar-ai/screenpipe)
2. Ensure Node.js 18+ or Bun is installed

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd grlinkedin-generator

# Install dependencies
bun install

# Build the project
bun run build
```

### Running

1. Configure this as a Screenpipe pipe
2. Navigate to LinkedIn in your browser
3. Use the UI to enable/disable automation
4. Monitor the dashboard for suggestions and stats

## 🛠️ Development

```bash
# Start development server
bun dev

# Type checking
bun run type-check

# Lint code
bun run lint

# Build for production
bun run build
```

## ⚙️ Configuration

### Basic Settings

The automator uses Screenpipe's settings API to persist configuration. Key settings:

- **Enabled/Disabled**: Toggle automation on/off
- **Rate Limiting**: 30-second cooldown between actions (configurable)
- **Statistics**: Persistent tracking of all activities
- **Error Logging**: Automatic error tracking and display

For advanced configuration options, see [CONFIG.md](./CONFIG.md).

### Supported LinkedIn Pages

The automator intelligently handles:
- **People Search** (`/search/results/people`) - Connection suggestions
- **Feed** (`/feed/`) - Post engagement analysis
- **Profile Pages** (`/in/[username]`) - Profile analysis and connection recommendations
- **General Pages** - Page analysis and action suggestions

## 🔒 Safety & Compliance

### Built-in Safety Features

✅ **Suggestion-Only Mode**: All actions require manual approval
✅ **Rate Limiting**: 30-second cooldown between automation actions
✅ **Conservative AI**: Only suggests high-value, relevant actions
✅ **Activity Logging**: Full transparency with detailed logs
✅ **Error Tracking**: Automatic error capture and display
✅ **LinkedIn ToS Compliance**: Designed to respect platform guidelines

### Rate Limiting

The default rate limit is **30 seconds** between actions. This prevents:
- Triggering LinkedIn's anti-bot measures
- Excessive automation that could violate ToS
- Spam-like behavior

### Manual Approval

The automator **ONLY provides suggestions**. All actions require manual execution:
- Connection requests must be manually sent
- Post likes must be manually clicked
- Messages must be manually sent

## 📊 Statistics Dashboard

The UI provides real-time visibility into:

- **Connections Suggested**: Total connection recommendations
- **Posts Liked**: Engagement activity count
- **Messages Sent**: Outreach message count
- **Recent Activity**: Latest automation actions
- **Error Log**: Recent errors for debugging
- **Connection Suggestions**: Detailed list of recent recommendations

## 🏗️ Architecture

### Project Structure

```
grlinkedin-generator/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main UI component
│   └── globals.css        # Global styles
├── types/                 # TypeScript definitions
│   ├── screenpipe.d.ts   # Screenpipe API types
│   └── shared.ts         # Shared types and constants
├── pipe.ts               # Main automation logic
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── tailwind.config.js    # Tailwind CSS config
├── CONFIG.md            # Configuration guide
└── README.md            # This file
```

### Key Components

**pipe.ts** - Main automation engine
- Monitors LinkedIn activity via Screenpipe
- Uses AI to analyze content
- Generates intelligent suggestions
- Persists statistics and settings

**app/page.tsx** - User interface
- Real-time statistics dashboard
- Enable/disable automation
- View suggestions and errors
- Reset stats functionality

**types/** - TypeScript definitions
- Screenpipe API interfaces
- Shared data structures
- Type safety across the app

## 🤖 AI Prompts

The automator uses carefully crafted AI prompts for:

1. **People Search Analysis**: Identifies relevant connections from search results
2. **Feed Post Analysis**: Evaluates posts for engagement value
3. **Profile Analysis**: Assesses individual profiles for connection opportunities
4. **Page Analysis**: Provides general LinkedIn page insights

Prompts are designed to be:
- Conservative (quality over quantity)
- Business-focused
- Respectful of LinkedIn's community guidelines

See [CONFIG.md](./CONFIG.md) for customization options.

## 🐛 Troubleshooting

### Automation Not Running

1. ✓ Check if automation is enabled in the UI
2. ✓ Verify you're on a LinkedIn page
3. ✓ Ensure 30 seconds have passed since last action
4. ✓ Review error logs in the dashboard

### Stats Not Updating

1. ✓ Confirm pipe.ts is running in Screenpipe
2. ✓ Check browser localStorage for settings
3. ✓ Verify UI is polling (every 5 seconds)
4. ✓ Check browser console for errors

### AI Not Responding

1. ✓ Verify Screenpipe AI configuration
2. ✓ Check Screenpipe logs for errors
3. ✓ Ensure AI API is properly configured
4. ✓ Review prompt formatting in pipe.ts

## 📝 Best Practices

1. **Start Small**: Test with short automation sessions
2. **Monitor Regularly**: Check the dashboard frequently
3. **Review Suggestions**: Always manually review before acting
4. **Respect Limits**: Don't reduce rate limits below 30 seconds
5. **Stay Compliant**: Follow LinkedIn's terms of service
6. **Update Dependencies**: Keep packages current for security

## 🔄 Recent Improvements

- ✅ Enhanced error handling and validation
- ✅ Proper JSON parsing for AI responses
- ✅ Rate limiting to prevent abuse
- ✅ Settings persistence via Screenpipe API
- ✅ Improved TypeScript types with comprehensive interfaces
- ✅ Real-time UI updates with polling
- ✅ Error logging and display
- ✅ Connection suggestion tracking
- ✅ Profile analysis functionality
- ✅ Updated to latest Next.js and React versions

## 🤝 Contributing

Contributions are welcome! This is a template that you can customize for your specific business development needs.

### Customization Ideas

- Modify AI prompts for your industry
- Add custom statistics tracking
- Implement additional LinkedIn page handlers
- Create industry-specific filters
- Add custom UI themes

## 📄 License

MIT License - feel free to use and modify as needed.

---

**Note**: This tool is designed to assist with LinkedIn business development through AI-powered suggestions. All actions require manual approval. Use responsibly and in accordance with LinkedIn's terms of service.
