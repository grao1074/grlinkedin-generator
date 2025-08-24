import type { Pipe } from './types/screenpipe';

export default async function pipe(pipe: Pipe) {
  try {
    // Get current screen context
    const context = await pipe.queryScreenpipe();
    
    // Check if we're on LinkedIn
    const isLinkedIn = context.url?.includes('linkedin.com');
    
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
          
          Current page context: ${context.text || 'No text detected'}
          Current URL: ${context.url}
          
          Based on this information, suggest what automation action to take:
          1. Connect with people
          2. Send messages
          3. Like/comment on posts
          4. Follow companies
          5. Apply to jobs
          6. Update profile
          
          Return only the action number and a brief reason.`
        }
      ]
    });
    
    console.log('LinkedIn page analysis:', pageAnalysis);
    
    // Example: Automatically connect with people on search results
    if (context.url?.includes('/search/results/people')) {
      const connectSuggestions = await pipe.ai.chat({
        messages: [
          {
            role: 'system',
            content: `Analyze the LinkedIn search results page and identify people to connect with.
            
            Page content: ${context.text}
            
            Return a JSON array of people to connect with, including:
            - name: their name
            - title: their job title
            - reason: why we should connect with them
            
            Only suggest connections that make business sense.`
          }
        ]
      });
      
      console.log('Connection suggestions:', connectSuggestions);
    }
    
    // Example: Automatically like relevant posts
    if (context.url?.includes('/feed/')) {
      const likeAnalysis = await pipe.ai.chat({
        messages: [
          {
            role: 'system',
            content: `Analyze the current LinkedIn post and determine if it's worth liking.
            
            Post content: ${context.text}
            
            Return "LIKE" if the post is relevant to business development, networking, or your industry.
            Return "SKIP" if the post is irrelevant, spam, or inappropriate.
            
            Only return the word LIKE or SKIP.`
          }
        ]
      });
      
      if (likeAnalysis.trim() === 'LIKE') {
        console.log('Automatically liking relevant post');
        // Note: Actual clicking would require pipe.input API when available
      }
    }
    
  } catch (error) {
    console.error('LinkedIn automation error:', error);
  }
}
