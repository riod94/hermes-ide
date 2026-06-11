"use strict";var u=Object.create;var d=Object.defineProperty;var b=Object.getOwnPropertyDescriptor;var g=Object.getOwnPropertyNames;var f=Object.getPrototypeOf,y=Object.prototype.hasOwnProperty;var x=(s,e)=>{for(var t in e)d(s,t,{get:e[t],enumerable:!0})},w=(s,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of g(e))!y.call(s,o)&&o!==t&&d(s,o,{get:()=>e[o],enumerable:!(i=b(e,o))||i.enumerable});return s};var p=(s,e,t)=>(t=s!=null?u(f(s)):{},w(e||!s||!s.__esModule?d(t,"default",{value:s,enumerable:!0}):t,s)),C=s=>w(d({},"__esModule",{value:!0}),s);var W={};x(W,{activate:()=>_,deactivate:()=>P});module.exports=C(W);var r=p(require("vscode"));var a=p(require("vscode")),l=p(require("path")),n=p(require("fs")),c=class{constructor(e){this._extensionUri=e}static viewType="hermes.chatView";_view;resolveWebviewView(e,t,i){this._view=e,e.webview.options={enableScripts:!0,localResourceRoots:[this._extensionUri,a.Uri.joinPath(this._extensionUri,"webview-dist")]},e.webview.html=this._getHtmlForWebview(e.webview),e.webview.onDidReceiveMessage(o=>{switch(o.type){case"chatMessage":this._handleChatMessage(o.value);break;case"clearChat":break;case"copyCode":a.env.clipboard.writeText(o.value),a.window.showInformationMessage("Code copied to clipboard");break;case"ready":console.log("[Hermes] Webview ready");break}})}postMessage(e){this._view?.webview.postMessage(e)}_handleChatMessage(e){this.postMessage({type:"addMessage",message:{id:`msg-${Date.now()}-user`,role:"user",content:e,timestamp:Date.now(),status:"done"}});let t=`msg-${Date.now()}-assistant`;this.postMessage({type:"addMessage",message:{id:t,role:"assistant",content:`Echo: "${e}"

_Hermes gateway not connected yet. This is a Phase 4 placeholder response._`,timestamp:Date.now(),status:"done"}})}_getHtmlForWebview(e){let t=l.join(this._extensionUri.fsPath,"webview-dist"),i="",o="",h=l.join(t,"index.js"),m=l.join(t,"index.css");n.existsSync(h)&&(i=n.readFileSync(h,"utf-8")),n.existsSync(m)&&(o=n.readFileSync(m,"utf-8"));let v=M();return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src 'unsafe-inline' ${e.cspSource};
                 script-src 'nonce-${v}';
                 font-src ${e.cspSource};
                 img-src ${e.cspSource} https: data:;">
  <title>Hermes Chat</title>
  <style nonce="${v}">${o}</style>
</head>
<body>
  <div id="app"></div>
  <script nonce="${v}">${i}</script>
</body>
</html>`}};function M(){let s="",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let t=0;t<32;t++)s+=e.charAt(Math.floor(Math.random()*e.length));return s}function _(s){console.log("Hermes IDE Extension is now active.");let e=new c(s.extensionUri);s.subscriptions.push(r.window.registerWebviewViewProvider(c.viewType,e)),s.subscriptions.push(r.commands.registerCommand("hermes.focus",()=>{r.commands.executeCommand("workbench.view.extension.hermes-sidebar")}))}function P(){}0&&(module.exports={activate,deactivate});
