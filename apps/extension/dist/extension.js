"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/ChatViewProvider.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var ChatViewProvider = class {
  constructor(_extensionUri) {
    this._extensionUri = _extensionUri;
  }
  static viewType = "hermes.chatView";
  _view;
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri,
        vscode.Uri.joinPath(this._extensionUri, "..", "webview-ui", "dist")
      ]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "chatMessage":
          this._handleChatMessage(data.value);
          break;
        case "clearChat":
          break;
        case "copyCode":
          vscode.env.clipboard.writeText(data.value);
          vscode.window.showInformationMessage("Code copied to clipboard");
          break;
        case "ready":
          console.log("[Hermes] Webview ready");
          break;
      }
    });
  }
  /** Send a message to the webview */
  postMessage(message) {
    this._view?.webview.postMessage(message);
  }
  /** Handle incoming chat message from user */
  _handleChatMessage(text) {
    this.postMessage({
      type: "addMessage",
      message: {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: text,
        timestamp: Date.now(),
        status: "done"
      }
    });
    const responseId = `msg-${Date.now()}-assistant`;
    this.postMessage({
      type: "addMessage",
      message: {
        id: responseId,
        role: "assistant",
        content: `Echo: "${text}"

_Hermes gateway not connected yet. This is a Phase 4 placeholder response._`,
        timestamp: Date.now(),
        status: "done"
      }
    });
  }
  _getHtmlForWebview(webview) {
    const webviewDistPath = path.join(this._extensionUri.fsPath, "..", "webview-ui", "dist");
    let scriptContent = "";
    let styleContent = "";
    const jsPath = path.join(webviewDistPath, "index.js");
    const cssPath = path.join(webviewDistPath, "index.css");
    if (fs.existsSync(jsPath)) {
      scriptContent = fs.readFileSync(jsPath, "utf-8");
    }
    if (fs.existsSync(cssPath)) {
      styleContent = fs.readFileSync(cssPath, "utf-8");
    }
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src 'unsafe-inline' ${webview.cspSource};
                 script-src 'nonce-${nonce}';
                 font-src ${webview.cspSource};
                 img-src ${webview.cspSource} https: data:;">
  <title>Hermes Chat</title>
  <style nonce="${nonce}">${styleContent}</style>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">${scriptContent}</script>
</body>
</html>`;
  }
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/extension.ts
function activate(context) {
  console.log("Hermes IDE Extension is now active.");
  const provider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode2.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("hermes.focus", () => {
      vscode2.commands.executeCommand("workbench.view.extension.hermes-sidebar");
    })
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
