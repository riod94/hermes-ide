// tested mcp diff
import * as vscode from 'vscode';
import { ChatViewProvider, draftProvider } from './ChatViewProvider';
import { mcpBridge } from './McpBridge';

export function activate(context: vscode.ExtensionContext) {
  console.log('Hermes Extension activated');

  // Register TextDocumentContentProvider for Draft Diffs
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('hermes-draft', draftProvider)
  );

  const provider = new ChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );

  // Register Focus Command
  context.subscriptions.push(
    vscode.commands.registerCommand('hermes.focus', () => {
      vscode.commands.executeCommand('workbench.view.extension.hermes-sidebar');
    })
  );

  // Register hermes.showDiffControls with delegate handler calling provider
  context.subscriptions.push(
    vscode.commands.registerCommand('hermes.showDiffControls', (payload: any) => {
      provider.showDiffInWebview(payload);
    })
  );

  // Register hermes.addToChat with delegate handler calling provider
  context.subscriptions.push(
    vscode.commands.registerCommand('hermes.addToChat', async () => {
      await provider.handleAddToChat();
    })
  );

  // Start MCP Bridge — connects to standalone MCP Service via HTTP+SSE
  mcpBridge.onDiff((payload) => {
    // Forward diff proposals to webview
    vscode.commands.executeCommand('hermes.showDiffControls', payload);
  });

  mcpBridge.start().catch((err) => {
    console.error('Failed to connect MCP Bridge:', err);
  });
  context.subscriptions.push({ dispose: () => mcpBridge.stop() });

  // Register command for webview to resolve diffs
  context.subscriptions.push(
    vscode.commands.registerCommand('hermes.resolveDiff', (diffId: string, decision: 'accept' | 'reject') => {
      mcpBridge.resolveDiff(diffId, decision);
    })
  );
}

export function deactivate() {}
