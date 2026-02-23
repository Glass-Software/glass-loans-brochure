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

    if (!this.apiKey) {
      throw new Error("OpenRouter API key is required");
    }
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
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

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('OpenRouter API request timed out after 60 seconds');
      }
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
    } = {},
  ): Promise<string> {
    const {
      model = "x-ai/grok-4.1-fast", // Default to latest Grok
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt,
    } = options;

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
    const text = await this.generateText(prompt, options);

    // Try to extract JSON from the response
    // Some models wrap JSON in markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
      null,
      text,
    ];
    const jsonText = jsonMatch[1] || text;

    try {
      return JSON.parse(jsonText.trim());
    } catch (error) {
      console.error("Failed to parse JSON response:", jsonText);
      throw new Error("AI did not return valid JSON");
    }
  }
}

// Export singleton instance
export const openRouterClient = new OpenRouterClient();
