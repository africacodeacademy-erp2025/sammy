/**
 * Greeting and Self-Awareness Handler for SaMMy
 *
 * Handles all greeting patterns, help requests, and questions about the app's
 * features, capabilities, and functionality.
 */

export interface GreetingState {
  prompt: string;
  platform?: string;
  userId?: string;
}

export interface GreetingResult {
  post: string;
  success: boolean;
  isGreeting: boolean;
}

/**
 * Detects if the user's prompt is a greeting or question about the app
 */
export function detectGreeting(prompt: string): boolean {
  const normalized = prompt.toLowerCase().trim();
  const greetingPatterns = [
    // Basic greetings
    /^(hi|hello|hey|good morning|good afternoon|good evening|sup|what's up|whatsup|greetings)$/,
    /^(hi|hello|hey)\s+(there|sammy|sammie|there sammy|buddy|friend)$/,
    /^(good morning|good afternoon|good evening|morning|afternoon|evening)\s+(sammy|sammie)?$/,

    // Questions about AI
    /^(how are you|how's it going|what's up|wassup|how do you do)\??$/,
    /^(who are you|what are you|what do you do|what can you do)\??$/,
    /^(are you sammy|are you sammie|are you an ai|are you a bot)\??$/,

    // Questions about app features and capabilities
    /what (is|are) (your )?(features|capabilities|functions)/i,
    /how (do|does) (this|the app|sammy|you) work/i,
    /what platforms (do you support|can you post to)/i,
    /can you (help|assist) (me )?(with|post|schedule|create)/i,
    /(tell me|explain) (about|how) (sammy|this app|the app|your features)/i,
    /what (social media|platforms) (do you|can i) (support|use|post to)/i,
    /(how to|can i) (schedule|create|post) (a )?(post|content)/i,
    /what (kind of|type of) (posts|content) can you (create|make|generate)/i,
    /(do you|can you) (learn|remember|know) (my|about me)/i,
    /how (smart|intelligent|advanced) are you/i,

    // Casual greetings
    /^(yo|sup|what's good|what's new|what's happening)$/,
    /^(nice to meet you|pleasure to meet you|glad to meet you)$/,

    // Thanks and appreciation
    /^(thanks|thank you|thx|appreciate it|cheers)\s*(sammy|sammie)?$/,
    /^(great|awesome|cool|nice|perfect|excellent)\s*(thanks|thank you|thx)?\s*(sammy|sammie)?$/,

    // Help requests without specifics
    /^(help|can you help|can you help me|i need help)$/,
    /^(what can you do for me|how can you help|how can you help me)\??$/,
  ];

  return greetingPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Generates an appropriate greeting response based on the user's prompt
 */
export function handleGreeting(state: GreetingState): GreetingResult {
  const { prompt } = state;
  const normalized = prompt.toLowerCase().trim();

  let responses: string[] = [];

  // Thanks and appreciation
  if (
    normalized.includes("thank") ||
    normalized.includes("thx") ||
    normalized.includes("appreciate")
  ) {
    responses = [
      "You're very welcome! 😊 I'm always happy to help with your social media needs. Anything else I can create for you?",
      "My pleasure! 🌟 That's what I'm here for. Ready to craft another amazing post?",
      "Glad I could help! ✨ Feel free to ask me to create more content anytime!",
      "You're welcome! 🚀 I love helping you create engaging social media content. What's next?",
    ];
  }
  // About SaMMy - comprehensive introduction
  else if (
    normalized.includes("who are you") ||
    normalized.includes("what are you") ||
    normalized.includes("what do you do") ||
    normalized.includes("tell me about") ||
    normalized.includes("explain")
  ) {
    responses = [
      `I'm SaMMy! 🤖 Your AI-powered social media management assistant. Here's what makes me special:

📱 **Supported Platforms:**
• Twitter/X - Engaging tweets with optimal character limits
• Facebook - Community-focused posts with storytelling
• LinkedIn - Professional content for business networking

🎯 **Smart Features:**
• **Personalized Content** - I learn your unique writing style from your Slack messages and past posts
• **RAG Technology** - I use vector search to find relevant context from your communication history
• **Multi-Model AI** - Powered by GPT-3.5-turbo, GPT-4o-mini, and GPT-4o based on your plan
• **Intelligent Scheduling** - Schedule posts for specific times or create recurring posts (daily, weekly, monthly)
• **Media Support** - Upload images to your Twitter, Facebook, and LinkedIn posts

⚙️ **How I Work:**
1. Analyze your Slack messages to understand your tone and style
2. Learn from your past social media posts
3. Generate content that sounds authentically like YOU
4. Optimize for each platform's best practices and character limits

Just ask me to create a post for any platform! 🚀`,

      `Hey! I'm SaMMy - your intelligent social media companion! 🌟

**What I Do:**
I create personalized social media content for Twitter, Facebook, and LinkedIn by learning from YOUR unique communication style.

**My Superpowers:**
✨ **Context-Aware** - I read your Slack messages to understand how you communicate
📊 **Style Matching** - I analyze your past posts to replicate your voice
🎨 **Platform Optimization** - Each post follows platform-specific best practices
⏰ **Smart Scheduling** - Schedule one-time or recurring posts
🖼️ **Media Integration** - Add images to make your posts more engaging

**Subscription Tiers:**
• **Basic Plan** - GPT-3.5-turbo for quick, efficient content
• **Pro Plan** - GPT-4o-mini for better quality and creativity
• **Business Plan** - GPT-4o for premium, high-quality content

I'm here to make your social media presence authentic and effortless! What would you like to create? 💪`,
    ];
  }
  // Features and capabilities
  else if (
    normalized.includes("features") ||
    normalized.includes("capabilities") ||
    normalized.includes("functions")
  ) {
    responses = [
      `Here's everything I can do for you! 🚀

**📱 Platform Support:**
• Twitter/X (280 characters, 1-2 hashtags)
• Facebook (engaging storytelling, 3-5 hashtags)
• LinkedIn (professional networking content)

**✨ Content Creation:**
• AI-generated posts matching YOUR writing style
• Context pulled from your Slack conversations
• Style learned from your posting history
• Platform-specific optimization and formatting

**⏰ Scheduling Options:**
• One-time scheduled posts (specific date/time)
• Recurring posts (daily, weekly, monthly)
• Specific day selection (e.g., every Monday and Wednesday)
• Flexible time formats (9am, morning, lunch time, etc.)

**🖼️ Media Features:**
• Image attachments for all platforms
• Multiple image support
• Automatic media optimization

**🧠 Smart Technology:**
• RAG (Retrieval-Augmented Generation) for context
• Vector search through your message history
• Conversation memory across chat sessions
• Multi-model AI (GPT-3.5-turbo to GPT-4o)

**🔐 Security:**
• OAuth 2.0 authentication for all platforms
• Encrypted credential storage
• Secure token management

Try me out! Just say "Create a Twitter post about [topic]" 📝`,
    ];
  }
  // How to use SaMMy
  else if (
    normalized.includes("how") &&
    (normalized.includes("work") ||
      normalized.includes("schedule") ||
      normalized.includes("post") ||
      normalized.includes("create"))
  ) {
    responses = [
      `Great question! Here's how to use me effectively: 📚

**Creating Posts:**
Simply tell me what you want to post and which platform:
• "Create a Twitter post about productivity tips"
• "Write a LinkedIn post about team success"
• "Make a Facebook post celebrating our milestone"

**Scheduling Posts:**
Add timing information to schedule:
• "Post this to Twitter tomorrow at 3pm"
• "Schedule a Facebook post for next Monday morning"
• "Create a LinkedIn post for Friday at 5pm"

**Recurring Posts:**
Use frequency keywords for repeating posts:
• "Create a daily Twitter post about motivation at 9am"
• "Post to LinkedIn every Monday at noon about our progress"
• "Share to Facebook weekly on Fridays"

**With Images:**
Attach images when posting (in the review modal):
• Supported on Twitter, Facebook, and LinkedIn
• Multiple images supported
• Automatically optimized

**Conversation Features:**
• I remember our chat context
• Say "continue" to expand the last draft
• Say "change to be more casual" to modify tone

**Platform Connection:**
Connect your accounts via the Credentials sidebar (🔑 icon) using secure OAuth 2.0

Ready to start creating? 🎨`,
    ];
  }
  // Platform information
  else if (
    normalized.includes("platforms") ||
    normalized.includes("social media")
  ) {
    responses = [
      `I currently support these platforms! 📱

**🐦 Twitter/X**
• Character limit: 280 (I keep it to 240-260 for retweets)
• Best for: Quick updates, news, conversations
• Style: Concise, punchy, engaging
• Hashtags: 1-2 maximum
• Media: Images supported

**👥 Facebook**
• Optimal length: 40-80 characters (but can be longer)
• Best for: Storytelling, community engagement
• Style: Warm, personal, relationship-focused
• Hashtags: 3-5 maximum
• Media: Images supported

**💼 LinkedIn**
• Best for: Professional content, business updates
• Style: Professional, informative, networking-focused
• Hashtags: Professional tags encouraged
• Media: Images supported

**Coming Soon:**
I'm built to expand! More platforms may be added in the future.

To connect a platform, click the Credentials icon (🔑) in the sidebar and use OAuth 2.0 authentication. It's secure and takes just a few clicks! 🔐`,
    ];
  }
  // Learning and intelligence
  else if (
    normalized.includes("learn") ||
    normalized.includes("remember") ||
    normalized.includes("know") ||
    normalized.includes("smart") ||
    normalized.includes("intelligent")
  ) {
    responses = [
      `I'm powered by advanced AI technology! Here's how I learn about you: 🧠

**Learning Your Style:**
📝 **Slack Integration** - I analyze your Slack messages to understand:
   • Your vocabulary and word choices
   • Your tone (formal, casual, humorous, etc.)
   • Topics you frequently discuss
   • Your communication patterns

📊 **Past Posts Analysis** - I study your previous social media posts to:
   • Match your existing posting style
   • Understand your audience preferences
   • Replicate successful patterns
   • Maintain brand consistency

**Smart Technology:**
🔍 **Vector Search** - I use semantic search to find relevant content from your history
🎯 **RAG (Retrieval-Augmented Generation)** - I retrieve context before generating
💭 **Conversation Memory** - I remember our chat within the same thread
🤖 **Multi-Model AI** - GPT-3.5-turbo, GPT-4o-mini, or GPT-4o based on your plan

**Privacy & Security:**
🔒 All your data is encrypted and secure
🛡️ OAuth 2.0 for platform connections
✨ I only access what you explicitly connect

The more you use me, the better I understand your unique voice! 🌟`,
    ];
  }
  // How are you doing
  else if (
    normalized.includes("how are you") ||
    normalized.includes("how's it going")
  ) {
    responses = [
      "I'm doing great, thanks for asking! 😊 Ready to help you create some amazing social media content. How can I assist you today?",
      "Fantastic! 🌟 I'm energized and ready to craft some engaging posts for you. What would you like to share with your audience?",
      "I'm excellent! ✨ Always excited to help with social media creativity. What kind of post are you thinking about?",
    ];
  }
  // Help and capabilities
  else if (
    normalized.includes("help") ||
    normalized.includes("what can you do")
  ) {
    responses = [
      `I can help you create personalized social media posts! 🚀 Here's what I do:

• **Analyze** your Slack messages to understand your communication style
• **Create** Twitter, Facebook, and LinkedIn posts that sound like you
• **Schedule** posts for specific times or recurring patterns
• **Learn** from your past posts to match your voice
• **Optimize** content for each platform's best practices
• **Support** image attachments for visual engagement

Just tell me what you want to post about! For example:
"Create a Twitter post about our product launch"
"Schedule a LinkedIn post for Monday at 9am about team culture"
"Make a daily Facebook post about motivation"`,

      `Great question! ✨ I'm your social media AI assistant. I can:

📝 Write engaging posts for Twitter, Facebook, and LinkedIn
⏰ Schedule posts for later (one-time or recurring)
🎯 Match your unique writing style using your Slack data if you are the business
📊 Learn from your posting history
🖼️ Add images to make posts more engaging
🔄 Create recurring posts (daily, weekly, monthly)
💬 Remember our conversation for context

**Quick Start:**
1. Connect your platforms (Credentials icon 🔑)
2. Tell me what to post: "Create a Twitter post about [topic]"
3. Review and publish or schedule!

What would you like to create today?`,
    ];
  }
  // Default general greetings
  else {
    responses = [
      "Hello! 👋 I'm SaMMy, your social media AI assistant. I can help you create and schedule posts for Twitter, Facebook, and LinkedIn. What would you like to post about?",
      "Hey there! 🌟 Great to see you! I'm here to help you craft amazing social media posts. Just tell me what you'd like to share and on which platform!",
      "Hi! 😊 I'm SaMMy, ready to help you create engaging content for your social media. Whether it's Twitter, Facebook, or LinkedIn, I've got you covered!",
      "Hello! ✨ I'm your friendly social media AI. I can help you write posts, schedule content, and make your social media presence shine. What can I create for you today?",
      "Hey! 🚀 Nice to meet you! I specialize in creating personalized social media posts. Just let me know what you want to share and I'll craft something perfect for your audience!",
    ];
  }

  const randomResponse =
    responses[Math.floor(Math.random() * responses.length)];

  return {
    post: randomResponse,
    success: true,
    isGreeting: true,
  };
}
