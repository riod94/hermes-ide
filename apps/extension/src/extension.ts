import * as vscode from 'vscode';
import { ChatViewProvider, draftProvider } from './ChatViewProvider';

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
}

export function deactivate() {}
