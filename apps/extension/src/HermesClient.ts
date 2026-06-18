export interface ModelInfo {
  id: string;
  owned_by: string;
}

export class HermesClient {
  private apiUrl: string;
  private apiKey: string;
  private conversationId: string = `ide-session-${Date.now()}`;
  private _model: string = "hermes-agent";

  /** Get current conversation ID */
  public getConversationId(): string {
    return this.conversationId;
  }

  /** Set conversation ID (used when restoring a session) */
  public setConversationId(id: string): void {
    this.conversationId = id;
  }

  /** Get current model */
  public getModel(): string {
    return this._model;
  }

  /** Set model for subsequent requests */
  public setModel(model: string): void {
    this._model = model;
  }

  /**
   * Fetch available models from the upstream provider (9router).
   * Uses HERMES_UPSTREAM_URL env var (the actual LLM router) to list models,
   * because Hermes API /v1/models only returns the wrapper model.
   */
  public async fetchModels(): Promise<ModelInfo[]> {
    try {
      // Use upstream provider URL for model listing
      const upstreamUrl = process.env.HERMES_UPSTREAM_URL || this.apiUrl;
      const upstreamKey = process.env.HERMES_UPSTREAM_KEY || this.apiKey;
      
      const response = await fetch(`${upstreamUrl}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${upstreamKey}`,
        },
      });
      if (!response.ok) {
        console.warn(`[Hermes] Failed to fetch models: ${response.statusText}`);
        return [];
      }
      const data = await response.json() as { data?: ModelInfo[] };
      return data.data || [];
    } catch (error) {
      console.error("[Hermes] Error fetching models:", error);
      return [];
    }
  }

  /**
   * System-level instructions injected into every Hermes API call.
   * Forces the agent to use mcp_ide_ide_propose_diff for all file edits
   * instead of write_file/patch/terminal sed.
   */
  private static readonly IDE_INSTRUCTIONS = [
    "You are running inside an IDE session. The developer is watching your changes in real-time.",
    "",
    "MANDATORY FILE EDITING RULE:",
    "- For ALL code file changes (create/edit), you MUST use the `mcp_ide_ide_propose_diff` tool.",
    "- Parameters: filepath (absolute path), new_content (full file content after changes).",
    "- This tool opens a diff view in the IDE and BLOCKS until the developer clicks Accept or Reject.",
    "- If rejected, ask what needs to change. Do NOT retry the same diff.",
    "",
    "FORBIDDEN during this IDE session:",
    "- write_file for code files",
    "- patch for code files",
    "- terminal commands that edit files (sed, echo >, cat >, tee, awk)",
    "",
    "EXCEPTIONS (allowed without mcp_ide_ide_propose_diff):",
    "- .gitignore, README.md, config files, documentation",
    "- git add/commit/push via terminal",
    "- Installing dependencies (bun add, npm install, composer require)",
    "- Reading files (read_file, search_files)",
  ].join("\n");

  constructor() {
    this.apiUrl = process.env.HERMES_API_URL || "http://127.0.0.1:3000/v1";
    this.apiKey = process.env.HERMES_API_KEY || "default-token";
  }

  /** Reset conversation — starts a fresh session with new ID */
  public resetConversation(): void {
    this.conversationId = `ide-session-${Date.now()}`;
  }

  /**
   * Mengirim pesan chat dengan SSE streaming menggunakan API /responses agar history context terjaga.
   * Supports multimodal input (text + images) when images are provided.
   */
  public async streamChat(
    message: string,
    contextString: string,
    onChunk: (data: string) => void,
    images?: Array<{ base64Data: string; mimeType: string }>
  ): Promise<void> {
    try {
      const textMessage = contextString ? `${contextString}\n\nUser: ${message}` : message;

      // Build input: multimodal content array if images present, plain string otherwise
      let input: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
      let usingMultimodal = false;

      if (images && images.length > 0) {
        const contentParts: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];

        // Add text part
        contentParts.push({ type: 'input_text', text: textMessage });

        // Add image parts
        for (const img of images) {
          contentParts.push({
            type: 'input_image',
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64Data}`,
              detail: 'auto',
            },
          });
        }

        input = contentParts;
        usingMultimodal = true;
      } else {
        input = textMessage;
      }

      const requestBody = {
        model: this._model,
        input: input,
        instructions: HermesClient.IDE_INSTRUCTIONS,
        conversation: this.conversationId,
        stream: true
      };

      let response = await fetch(`${this.apiUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      // If multimodal request fails (model may not support vision), retry with text-only
      if (!response.ok && usingMultimodal) {
        console.warn(`[Hermes] Multimodal request failed (${response.status}), retrying as text-only`);
        const imageCount = images?.length || 0;
        const fallbackText = textMessage + `\n\n[${imageCount} image(s) attached but current model does not support vision/multimodal input]`;
        const fallbackBody = {
          ...requestBody,
          input: fallbackText,
        };
        response = await fetch(`${this.apiUrl}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(fallbackBody)
        });
      }

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
