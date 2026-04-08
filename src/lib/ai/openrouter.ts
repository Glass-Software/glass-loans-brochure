/**
 * OpenRouter AI Client
 * Supports multiple models including Grok
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: "json_object" | "text" };
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string = "https://openrouter.ai/api/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";

    // Don't throw during build time - only validate at runtime
    if (!this.apiKey && typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn("OpenRouter API key not found - client will fail at runtime");
    }
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    // Validate API key at runtime
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    const startTime = Date.now();
    console.log(`📡 [OpenRouter] Request starting - Model: ${request.model}, Temp: ${request.temperature}, MaxTokens: ${request.max_tokens}`);

    // Add 60-second timeout for AI API calls
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
          "X-Title": "Glass Loans Underwriting Tool",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      console.log(`📡 [OpenRouter] Response received - Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s), Tokens: ${result.usage?.total_tokens || 'N/A'} (prompt: ${result.usage?.prompt_tokens || 'N/A'}, completion: ${result.usage?.completion_tokens || 'N/A'})`);

      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error.name === 'AbortError') {
        console.error(`📡 [OpenRouter] Request TIMED OUT after ${duration}ms - Model: ${request.model}`);
        throw new Error('OpenRouter API request timed out after 60 seconds');
      }

      console.error(`📡 [OpenRouter] Request FAILED after ${duration}ms - Model: ${request.model}, Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate text using Grok or specified model
   */
  async generateText(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      responseFormat?: { type: "json_object" | "text" };
    } = {},
  ): Promise<string> {
    const {
      model = "x-ai/grok-4.1-fast", // Default to latest Grok
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt,
      responseFormat,
    } = options;

    console.log(`🎯 [OpenRouter] generateText() called with model: ${model}`);

    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const response = await this.chatCompletion({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(responseFormat && { response_format: responseFormat }),
    });

    return response.choices[0]?.message?.content || "";
  }

  /**
   * Generate JSON response from AI
   */
  async generateJSON<T = any>(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {},
  ): Promise<T> {
    console.log(`🎯 [OpenRouter] generateJSON() called with model: ${options.model || "x-ai/grok-4.1-fast"}`);
    const text = await this.generateText(prompt, {
      ...options,
      responseFormat: { type: "json_object" },
    });

    try {
      return JSON.parse(text.trim());
    } catch (error) {
      console.error("Failed to parse JSON response:", text);
      throw new Error("AI did not return valid JSON");
    }
  }
}

// Export singleton instance
export const openRouterClient = new OpenRouterClient();
