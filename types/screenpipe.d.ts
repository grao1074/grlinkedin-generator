// Type definitions for Screenpipe APIs

/**
 * Screen context returned by queryScreenpipe
 */
export interface ScreenContext {
  text?: string;
  url?: string;
  title?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Message structure for AI chat
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for AI chat
 */
export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * HTTP request options
 */
export interface HttpOptions {
  headers?: Record<string, string>;
  timeout?: number;
  [key: string]: any;
}

/**
 * Main Pipe interface for Screenpipe automation
 */
export interface Pipe {
  /**
   * Query the current screen context (text, URL, title, etc.)
   */
  queryScreenpipe(): Promise<ScreenContext>;

  /**
   * AI capabilities
   */
  ai: {
    /**
     * Chat with AI to analyze content and make decisions
     */
    chat(options: ChatOptions): Promise<string>;
  };

  /**
   * Persistent settings storage
   */
  settings: {
    /**
     * Get a setting value by key
     */
    get<T = any>(key: string): Promise<T | null>;

    /**
     * Set a setting value by key
     */
    set<T = any>(key: string, value: T): Promise<void>;

    /**
     * Delete a setting by key
     */
    delete?(key: string): Promise<void>;
  };

  /**
   * HTTP client for API requests
   */
  http: {
    get<T = any>(url: string, options?: HttpOptions): Promise<T>;
    post<T = any>(url: string, data?: any, options?: HttpOptions): Promise<T>;
    put?<T = any>(url: string, data?: any, options?: HttpOptions): Promise<T>;
    delete?<T = any>(url: string, options?: HttpOptions): Promise<T>;
  };

  /**
   * Experimental APIs - may not be available in all versions
   */

  /**
   * Stream audio transcriptions in real-time
   */
  streamTranscriptions?: () => AsyncIterable<string>;

  /**
   * Stream visual analysis in real-time
   */
  streamVision?: () => AsyncIterable<any>;

  /**
   * Input control API for automation
   */
  input?: {
    /**
     * Simulate a mouse click at coordinates
     */
    click(x: number, y: number): Promise<void>;

    /**
     * Simulate typing text
     */
    type(text: string): Promise<void>;

    /**
     * Simulate a key press
     */
    key(key: string): Promise<void>;

    /**
     * Get mouse position
     */
    getMousePosition?(): Promise<{ x: number; y: number }>;
  };
}

