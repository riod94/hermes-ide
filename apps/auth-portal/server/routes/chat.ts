import type { IncomingMessage } from "http";

export async function handleChat(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  
  // Deteksi port dari token jika bisa, fallback ke 61001
  let targetPort = "61001";
  
  // Hack: karena ekstensi belum mengirim profil secara eksplisit, 
  // kita coba tebak jika auth header menunjuk ke rio (yang kita tahu dari docker-compose)
  // Untuk fix permanen, ekstensi harus membaca port aslinya.
  if (authHeader.includes("ad49de3a6fd90446f9dfecb502f6e8322c0935740c7b30f87dcd25e0002739bc")) {
    targetPort = "61007"; // Port profil rio
  }

  const HERMES_API_URL = `http://127.0.0.1:${targetPort}/v1/responses`;

  const body = await req.json();

  const response = await fetch(HERMES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader || "",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return new Response(response.body, { status: response.status });
  }

  // Proxy the stream and intercept tool calls
  const stream = new ReadableStream({
    async start(controller) {
      if (!response.body) {
        controller.close();
        return;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr);
                
                // --- INTERCEPTION LOGIC ---
                // Jika event adalah tool call execution
                if (parsed.type === "response.output_item.added" && parsed.item?.type === "function_call") {
                  const toolName = parsed.item.name || "unknown tool";
                  
                  if (toolName === "write_file" || toolName === "patch") {
                     // Kirim flag bahwa agent sedang mencoba mengedit file,
                     // IDE akan membajak konten ini di HermesClient.ts
                     controller.enqueue(encoder.encode(`data: {"type": "status", "status": "Proposed Diff", "tool": "${toolName}"}\n\n`));
                  } else if (toolName === "search_files" || toolName === "read_file") {
                     controller.enqueue(encoder.encode(`data: {"type": "status", "status": "Exploring codebase...", "tool": "${toolName}"}\n\n`));
                  } else if (toolName === "terminal") {
                     controller.enqueue(encoder.encode(`data: {"type": "status", "status": "Executing command...", "tool": "${toolName}"}\n\n`));
                  } else {
                     controller.enqueue(encoder.encode(`data: {"type": "status", "status": "Using ${toolName}...", "tool": "${toolName}"}\n\n`));
                  }
                }

                // Teruskan payload asli
                controller.enqueue(encoder.encode(line + "\n\n"));
              } catch (e) {
                // Not valid JSON, forward it as is
                controller.enqueue(encoder.encode(line + "\n\n"));
              }
            } else {
              controller.enqueue(encoder.encode(line + "\n"));
            }
          }
        }
      } catch (error) {
        console.error("Stream Proxy Error:", error);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    }
  });
}
