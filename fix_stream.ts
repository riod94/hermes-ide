import { readFileSync, writeFileSync } from "fs";

let content = readFileSync("apps/extension/src/HermesClient.ts", "utf-8");

content = content.replace("if (body[Symbol.asyncIterator]) {", `if (body.getReader) {
          const reader = body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === "response.output_text.delta") {
                    onChunk(data.delta || data.text || "");
                  } else if (data.type === "function_call") {
                    onChunk(\`\\n> 🛠️ **Mengerjakan Tool: \${data.name}**\\n\`);
                  } else if (data.choices && data.choices[0].delta?.content) {
                    onChunk(data.choices[0].delta.content);
                  }
                } catch (e) { }
              }
            }
          }
        } else if (body[Symbol.asyncIterator]) {`);

writeFileSync("apps/extension/src/HermesClient.ts", content);
