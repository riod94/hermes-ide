import * as vscode from 'vscode';
import { ChatViewProvider, draftProvider } from './ChatViewProvider';
import { mcpServerManager } from './mcpServer';

export function activate(context: vscode.ExtensionContext) {
  console.log('Hermes Extension activated');

  // Register TextDocumentContentProvider for Draft Diffs
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('hermes-draft', draftProvider)
  );
  const provider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );

  // Register Focus Command
  context.subscriptions.push(
    vscode.commands.registerCommand('hermes.focus', () => {
      vscode.commands.executeCommand('workbench.view.extension.hermes-sidebar');
    })
  );

  // Start MCP Server as standalone Bun subprocess
  mcpServerManager.start(context.extensionPath).catch((err) => {
    console.error('Failed to start MCP Server:', err);
    vscode.window.showErrorMessage(`Hermes MCP Server failed to start: ${err.message}`);
  });
  context.subscriptions.push({ dispose: () => mcpServerManager.stop() });

  // Register internal command untuk webview mengkonfirmasi diff
  context.subscriptions.push(
    vscode.commands.registerCommand('hermes.resolveDiff', (diffId: string, decision: 'accept' | 'reject') => {
      mcpServerManager.resolveDiff(diffId, decision);
    })
  );
}

export function deactivate() {}
