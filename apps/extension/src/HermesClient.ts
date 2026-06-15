export class HermesClient {
  private apiUrl: string;
  private apiKey: string;
  private conversationId: string = "ide-session";

  constructor() {
    this.apiUrl = process.env.HERMES_API_URL || "http://127.0.0.1:3000/v1";
    this.apiKey = process.env.HERMES_API_KEY || "default-token";
  }

  /**
   * Mengirim pesan chat dengan SSE streaming menggunakan API /responses agar history context terjaga.
   */
  public async streamChat(message: string, contextString: string, onChunk: (data: string) => void): Promise<void> {
    try {
      const fullMessage = contextString ? `${contextString}\n\nUser: ${message}` : message;

      const response = await fetch(`${this.apiUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "hermes-agent",
          input: fullMessage,
          conversation: this.conversationId,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      if (response.body) {
        const handleLine = (line: string) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const data = JSON.parse(trimmed.slice(6));
              
              if (data.type === "response.output_item.added" && data.item?.type === "function_call") {
                const toolName = data.item.name;
                if (toolName === "search_files" || toolName === "read_file") {
                   onChunk(`\n> ⏳ **Exploring codebase...**\n\n`);
                } else {
                   onChunk(`\n> ⏳ **Using tool: \`${toolName}\`...**\n\n`);
                }
              } else if (data.type === "response.output_text.delta") {
                onChunk(data.delta || data.text || "");
              } else if (data.type === "function_call") {
                onChunk(`\n> 🛠️ **Using Tool: \`${data.name}\`...**\n\n`);
              } else if (data.choices && data.choices[0].delta?.content) {
                onChunk(data.choices[0].delta.content);
              } else if (data.event === "hermes.tool.progress") {
                onChunk(`\n> 🛠️ **${data.tool}**: ${JSON.stringify(data.arguments || {})}\n\n`);
              }
            } catch (e) {
              // Silently ignore parse errors for incomplete chunks
            }
          }
        };

        // VS Code extension host runs in Node.js, so response.body might be a Node stream
        // Need to handle async iterator
        const body: any = response.body;
        if (body.getReader) {
          const reader = body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              handleLine(line);
            }
          }
        } else if (body[Symbol.asyncIterator]) {
          const decoder = new TextDecoder();
          let buffer = '';
          for await (const chunk of body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              handleLine(line);
            }
          }
        }
      }
    } catch (error) {
      onChunk(`\n\n[Error: ${error instanceof Error ? error.message : "Unknown"}]`);
    }
  }
}
