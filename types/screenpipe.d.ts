// Type definitions for Screenpipe APIs
export interface Pipe {
  queryScreenpipe(): Promise<{
    text?: string;
    url?: string;
    title?: string;
    [key: string]: any;
  }>;
  
  ai: {
    chat(options: {
      messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>;
    }): Promise<string>;
  };
  
  settings: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  };
  
  http: {
    get(url: string, options?: any): Promise<any>;
    post(url: string, data?: any, options?: any): Promise<any>;
  };
  
  // Experimental APIs
  streamTranscriptions?: () => AsyncIterable<string>;
  streamVision?: () => AsyncIterable<any>;
  input?: {
    click(x: number, y: number): Promise<void>;
    type(text: string): Promise<void>;
    key(key: string): Promise<void>;
  };
}
