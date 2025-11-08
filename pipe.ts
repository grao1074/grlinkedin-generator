import type { Pipe, ScreenContext } from './types/screenpipe';
import type {
  Stats,
  ConnectionSuggestion,
  ProfileAnalysis,
  ErrorLog,
  AutomationSettings
} from './types/shared';
import { SETTINGS_KEY, RATE_LIMIT_MS } from './types/shared';

export default async function pipe(pipe: Pipe) {
  try {
    // Check if automation is enabled
    const settings = await pipe.settings.get(SETTINGS_KEY) || {};
    if (!settings.enabled) {
      console.log('Automation is disabled');
      return;
    }

    // Rate limiting check
    const stats: Stats = await pipe.settings.get(`${SETTINGS_KEY}-stats`) || {
      connectionsSuggested: 0,
      postsLiked: 0,
      messagesSent: 0,
      lastActivity: '',
      lastRun: 0
    };

    const now = Date.now();
    if (now - stats.lastRun < RATE_LIMIT_MS) {
      console.log('Rate limit: waiting before next action');
      return;
    }

    // Get current screen context
    const context = await pipe.queryScreenpipe();

    if (!context || !context.url) {
      console.log('No context available');
      return;
    }

    // Check if we're on LinkedIn
    const isLinkedIn = context.url.includes('linkedin.com');

    if (!isLinkedIn) {
      console.log('Not on LinkedIn, skipping automation');
      return;
    }

    // Analyze the current LinkedIn page
    const pageAnalysis = await pipe.ai.chat({
      messages: [
        {
          role: 'system',
          content: `You are a LinkedIn automation assistant. Analyze the current page and suggest actions.

          Current page context: ${context.text?.slice(0, 1000) || 'No text detected'}
          Current URL: ${context.url}

          Based on this information, suggest what automation action to take:
          1. Connect with people
          2. Send messages
          3. Like/comment on posts
          4. Follow companies
          5. Apply to jobs
          6. Update profile

          Return only the action number and a brief reason in format: "NUMBER: reason"`
        }
      ]
    });

    console.log('LinkedIn page analysis:', pageAnalysis);
    stats.lastActivity = `Page analyzed: ${pageAnalysis.slice(0, 100)}`;

    // Handle people search results
    if (context.url.includes('/search/results/people')) {
      await handlePeopleSearch(pipe, context, stats);
    }

    // Handle feed posts
    if (context.url.includes('/feed/')) {
      await handleFeedPost(pipe, context, stats);
    }

    // Handle profile pages
    if (context.url.match(/\/in\/[\w-]+\/?$/)) {
      await handleProfilePage(pipe, context, stats);
    }

    // Update stats with timestamp
    stats.lastRun = now;
    await pipe.settings.set(`${SETTINGS_KEY}-stats`, stats);

  } catch (error) {
    console.error('LinkedIn automation error:', error);

    // Save error to settings for debugging
    try {
      const errorLog = await pipe.settings.get(`${SETTINGS_KEY}-errors`) || [];
      errorLog.push({
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });

      // Keep only last 10 errors
      if (errorLog.length > 10) {
        errorLog.shift();
      }

      await pipe.settings.set(`${SETTINGS_KEY}-errors`, errorLog);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
}

async function handlePeopleSearch(pipe: Pipe, context: ScreenContext, stats: Stats) {
  try {
    const connectResponse = await pipe.ai.chat({
      messages: [
        {
          role: 'system',
          content: `Analyze the LinkedIn search results page and identify people to connect with.

          Page content: ${context.text?.slice(0, 2000) || 'No content'}

          Return a valid JSON array of people to connect with. Each person should have:
          - name: their full name
          - title: their job title
          - reason: why we should connect (business relevance)

          Only suggest connections that make business sense. Return ONLY the JSON array, no other text.
          Example format: [{"name": "John Doe", "title": "CEO", "reason": "Industry leader"}]`
        }
      ]
    });

    // Parse JSON response
    let suggestions: ConnectionSuggestion[] = [];
    try {
      const jsonMatch = connectResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse connection suggestions:', parseError);
      return;
    }

    if (suggestions.length > 0) {
      console.log(`Found ${suggestions.length} connection suggestions:`, suggestions);
      stats.connectionsSuggested += suggestions.length;
      stats.lastActivity = `Suggested ${suggestions.length} connections`;

      // Save suggestions for UI to display
      await pipe.settings.set(`${SETTINGS_KEY}-suggestions`, suggestions.slice(0, 5));
    }
  } catch (error) {
    console.error('Error handling people search:', error);
  }
}

async function handleFeedPost(pipe: Pipe, context: ScreenContext, stats: Stats) {
  try {
    const likeAnalysis = await pipe.ai.chat({
      messages: [
        {
          role: 'system',
          content: `Analyze the current LinkedIn post and determine if it's worth engaging with.

          Post content: ${context.text?.slice(0, 1000) || 'No content'}

          Return ONLY one word:
          - "LIKE" if the post is relevant to business development, networking, or professional growth
          - "SKIP" if the post is irrelevant, spam, promotional, or inappropriate

          Be conservative - only suggest LIKE for genuinely valuable content.`
        }
      ]
    });

    const action = likeAnalysis.trim().toUpperCase();

    if (action === 'LIKE') {
      console.log('Suggested: Like this post');
      stats.postsLiked += 1;
      stats.lastActivity = 'Suggested liking a relevant post';

      // Note: Actual clicking would require pipe.input API
      // if (pipe.input) {
      //   await pipe.input.click(likeButtonX, likeButtonY);
      // }
    } else {
      console.log('Skipping this post');
      stats.lastActivity = 'Skipped irrelevant post';
    }
  } catch (error) {
    console.error('Error handling feed post:', error);
  }
}

async function handleProfilePage(pipe: Pipe, context: ScreenContext, stats: Stats) {
  try {
    const profileAnalysis = await pipe.ai.chat({
      messages: [
        {
          role: 'system',
          content: `Analyze this LinkedIn profile and suggest if we should connect.

          Profile content: ${context.text?.slice(0, 1500) || 'No content'}

          Return a JSON object with:
          - shouldConnect: boolean
          - reason: string explaining why or why not
          - message: suggested personalized connection message (if shouldConnect is true)

          Format: {"shouldConnect": true/false, "reason": "...", "message": "..."}
          Return ONLY the JSON object.`
        }
      ]
    });

    try {
      const jsonMatch = profileAnalysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis: ProfileAnalysis = JSON.parse(jsonMatch[0]);
        console.log('Profile analysis:', analysis);

        if (analysis.shouldConnect) {
          stats.connectionsSuggested += 1;
          stats.lastActivity = `Suggested connecting: ${analysis.reason}`;

          // Save the analysis for UI display
          await pipe.settings.set(`${SETTINGS_KEY}-profile-analysis`, analysis);
        }
      }
    } catch (parseError) {
      console.error('Failed to parse profile analysis:', parseError);
    }
  } catch (error) {
    console.error('Error handling profile page:', error);
  }
}
