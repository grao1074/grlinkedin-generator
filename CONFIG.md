# Configuration Guide

This document explains how to configure and customize the GR LinkedIn Automator.

## Screenpipe Settings

The automator uses Screenpipe's persistent settings storage. All settings are stored with the key prefix `linkedin-automator`.

### Enable/Disable Automation

The automation checks for the `enabled` flag in settings:

```typescript
{
  enabled: boolean; // true to enable automation, false to disable
}
```

To enable automation, use the UI toggle button or set the `linkedin-automator-enabled` setting to `true` in localStorage.

### Rate Limiting

The default rate limit is **30 seconds** between automation actions. This helps prevent triggering LinkedIn's anti-bot measures.

To customize the rate limit, you can modify the `RATE_LIMIT_MS` constant in `types/shared.ts`:

```typescript
export const RATE_LIMIT_MS = 30000; // 30 seconds
```

### Statistics Tracking

The automator tracks the following statistics:

```typescript
interface Stats {
  connectionsSuggested: number;  // Total connections suggested
  postsLiked: number;            // Total posts liked
  messagesSent: number;          // Total messages sent
  lastActivity: string;          // Description of last action
  lastRun: number;              // Timestamp of last execution
}
```

Statistics are persisted in `linkedin-automator-stats`.

## AI Prompts Configuration

The AI behavior can be customized by modifying the prompts in `pipe.ts`:

### People Search Analysis

Located in `handlePeopleSearch()`, this prompt analyzes LinkedIn search results and identifies people to connect with.

**Customization tips:**
- Adjust criteria for connection suggestions
- Change the output format
- Add industry-specific filters

### Feed Post Analysis

Located in `handleFeedPost()`, this prompt analyzes posts and decides whether to like them.

**Customization tips:**
- Adjust relevance criteria
- Add topic filters
- Change engagement thresholds

### Profile Analysis

Located in `handleProfilePage()`, this prompt analyzes individual profiles.

**Customization tips:**
- Add company size filters
- Include location preferences
- Customize connection message templates

## Safety Features

### Built-in Protections

1. **Rate Limiting**: 30-second cooldown between actions
2. **Manual Approval**: All actions are suggestions only
3. **Conservative AI**: Prompts are designed to be conservative
4. **Activity Logging**: Full transparency of all actions
5. **Error Tracking**: Last 10 errors are logged

### LinkedIn ToS Compliance

This tool is designed to:
- ✅ Only suggest actions (manual approval required)
- ✅ Respect rate limits
- ✅ Follow business-appropriate behavior
- ❌ NOT perform automated clicking (requires manual action)
- ❌ NOT bypass LinkedIn's usage limits

## Advanced Configuration

### Custom Automation Settings

You can extend the `AutomationSettings` interface in `types/shared.ts`:

```typescript
export interface AutomationSettings {
  enabled: boolean;
  rateLimitMs?: number;           // Custom rate limit
  maxConnectionsPerDay?: number;  // Daily connection limit
  maxLikesPerDay?: number;        // Daily like limit
}
```

### Environment Variables

For Next.js configuration, create a `.env.local` file:

```bash
# Next.js Configuration
NEXT_PUBLIC_APP_NAME="GR LinkedIn Automator"
NEXT_PUBLIC_VERSION="0.1.0"

# Optional: Custom API endpoints
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## UI Customization

### Theme Colors

The UI uses Tailwind CSS. Modify colors in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#0066cc',    // Blue for primary actions
        success: '#16a34a',    // Green for success states
        danger: '#dc2626',     // Red for errors/stop
      }
    }
  }
}
```

### Stats Display

The UI polls for updates every 5 seconds. To adjust this interval, modify the `setInterval` in `app/page.tsx`:

```typescript
const interval = setInterval(loadState, 5000); // Change 5000 to desired ms
```

## Debugging

### Error Logs

Errors are logged in `linkedin-automator-errors` with the following structure:

```typescript
interface ErrorLog {
  timestamp: string;  // ISO timestamp
  error: string;      // Error message
}
```

The system keeps the last 10 errors for debugging purposes.

### Console Logging

Enable verbose logging by checking the browser console and Screenpipe logs:

```bash
# In Screenpipe, check pipe logs
screenpipe logs
```

## Integration with Screenpipe

### Installation

1. Install Screenpipe: https://github.com/mediar-ai/screenpipe
2. Clone this repository
3. Install dependencies: `bun install`
4. Build: `bun run build`
5. Configure as a Screenpipe pipe

### Testing Locally

```bash
# Development mode
bun run dev

# Type checking
bun run type-check

# Linting
bun run lint
```

## Troubleshooting

### Automation Not Running

1. Check if automation is enabled in settings
2. Verify you're on a LinkedIn page
3. Check rate limit (must wait 30s between actions)
4. Review error logs in the UI

### Stats Not Updating

1. Ensure pipe.ts is running in Screenpipe
2. Check browser localStorage for settings
3. Verify the UI is polling for updates
4. Check browser console for errors

### AI Not Responding

1. Verify Screenpipe AI is configured
2. Check AI API credentials
3. Review console logs for AI errors
4. Ensure prompts are properly formatted

## Best Practices

1. **Start Small**: Enable automation for short periods to test
2. **Monitor Stats**: Regularly check the statistics dashboard
3. **Review Suggestions**: Manually review AI suggestions before acting
4. **Stay Compliant**: Follow LinkedIn's terms of service
5. **Rate Limit**: Don't reduce the rate limit below 30 seconds
6. **Regular Updates**: Keep dependencies updated for security

## Support

For issues or questions:
- Check the [README.md](./README.md) for basic usage
- Review this configuration guide
- Check Screenpipe documentation
- Open an issue on GitHub
