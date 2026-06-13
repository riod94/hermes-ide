"use strict";var U=Object.create;var y=Object.defineProperty;var C=Object.getOwnPropertyDescriptor;var T=Object.getOwnPropertyNames;var P=Object.getPrototypeOf,S=Object.prototype.hasOwnProperty;var R=(n,e)=>{for(var t in e)y(n,t,{get:e[t],enumerable:!0})},M=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of T(e))!S.call(n,o)&&o!==t&&y(n,o,{get:()=>e[o],enumerable:!(i=C(e,o))||i.enumerable});return n};var D=(n,e,t)=>(t=n!=null?U(P(n)):{},M(e||!n||!n.__esModule?y(t,"default",{value:n,enumerable:!0}):t,n)),O=n=>M(y({},"__esModule",{value:!0}),n);var H={};R(H,{activate:()=>I,deactivate:()=>W});module.exports=O(H);var h=D(require("vscode"));var s=D(require("vscode"));var _=class{apiUrl;apiKey;conversationId="ide-session";constructor(){this.apiUrl=process.env.HERMES_API_URL||"http://127.0.0.1:3000/v1",this.apiKey=process.env.HERMES_API_KEY||"default-token"}async streamChat(e,t,i){try{let o=t?`${t}

User: ${e}`:e,d=await fetch(`${this.apiUrl}/responses`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.apiKey}`},body:JSON.stringify({model:"hermes-agent",input:o,conversation:this.conversationId,stream:!0})});if(!d.ok)throw new Error(`API error: ${d.statusText}`);if(d.body){let r=d.body;if(r.getReader){let u=r.getReader(),p=new TextDecoder,f="";for(;;){let{done:l,value:v}=await u.read();if(l)break;f+=p.decode(v,{stream:!0});let m=f.split(`
`);f=m.pop()||"";for(let a of m){let b=a.trim();if(b.startsWith("data: ")&&b!=="data: [DONE]")try{let E=b.slice(6);if(b.startsWith("event: "))continue;let c=JSON.parse(E);if(c.type==="response.output_item.added"&&c.item?.type==="function_call"){let g=c.item.name;i(g==="write_file"||g==="patch"?"__HERMES_PROPOSE_DIFF__":g==="search_files"||g==="read_file"?`
> \u23F3 **Exploring codebase...**
`:`
> \u23F3 **Using tool: ${g}...**
`);continue}c.type==="response.output_text.delta"?i(c.delta||c.text||""):c.type==="function_call"?i(`
> \u{1F6E0}\uFE0F **Mengerjakan Tool: ${c.name}**
`):c.choices&&c.choices[0].delta?.content?i(c.choices[0].delta.content):c.event==="hermes.tool.progress"&&i(`
> \u{1F6E0}\uFE0F **${c.tool}**: ${JSON.stringify(c.arguments||{})}
`)}catch{}}}}else if(r[Symbol.asyncIterator]){let u=new TextDecoder,p="";for await(let f of r){p+=u.decode(f,{stream:!0});let l=p.split(`
`);p=l.pop()||"";for(let v of l){let m=v.trim();if(m.startsWith("data: ")&&m!=="data: [DONE]")try{let a=JSON.parse(m.slice(6));a.type==="response.output_text.delta"?i(a.delta||a.text||""):a.type==="function_call"?i(`
> \u{1F6E0}\uFE0F **Mengerjakan Tool: ${a.name}**
`):a.choices&&a.choices[0].delta?.content?i(a.choices[0].delta.content):a.event==="hermes.tool.progress"&&i(`
> \u{1F6E0}\uFE0F **${a.tool}**: ${JSON.stringify(a.arguments||{})}
`)}catch{}}}}}}catch(o){i(`

[Error: ${o instanceof Error?o.message:"Unknown"}]`)}}};var x=class{_drafts=new Map;setDraft(e,t){this._drafts.set(e,t)}provideTextDocumentContent(e){let t=e.path;return this._drafts.get(t)||""}},$=new x,w=class{constructor(e){this._extensionUri=e;this._hermesClient=new _}static viewType="hermes.chatView";_view;_hermesClient;resolveWebviewView(e,t,i){this._view=e,e.webview.options={enableScripts:!0,localResourceRoots:[s.Uri.joinPath(this._extensionUri,"webview-dist")]},e.webview.html=this._getHtmlForWebview(e.webview),e.webview.onDidReceiveMessage(o=>{switch(o.type){case"chatMessage":this._handleChatMessage(o.value);break;case"resolveDiff":if(o.action==="approve"){let d=new s.WorkspaceEdit;d.replace(s.Uri.file(o.filepath),new s.Range(0,0,99999,99999),o.newContent),s.workspace.applyEdit(d).then(r=>{r&&s.window.showInformationMessage("Diff Applied!")})}break;case"clearChat":break;case"copyCode":s.env.clipboard.writeText(o.value),s.window.showInformationMessage("Code copied to clipboard");break;case"ready":console.log("[Hermes] Webview ready");break;case"openDiff":this._handleOpenDiff(o.value);break;case"resolveDiff":this._handleResolveDiff(o.value);break}})}postMessage(e){this._view?.webview.postMessage(e)}async _handleOpenDiff(e){try{let t=s.Uri.file(e.filepath);$.setDraft(e.filepath,e.newContent);let i=s.Uri.parse(`hermes-draft:${e.filepath}`);await s.commands.executeCommand("vscode.diff",t,i,`Review Draft: ${e.filepath.split("/").pop()}`,{preview:!0})}catch(t){console.error("[Hermes] Failed to open diff",t),s.window.showErrorMessage("Hermes: Failed to open Diff view.")}}async _handleResolveDiff(e){try{if(e.action==="approve"&&e.filepath&&e.newContent!==void 0){let i=s.Uri.file(e.filepath),o=new TextEncoder;await s.workspace.fs.writeFile(i,o.encode(e.newContent)),s.window.showInformationMessage(`Hermes: Applied changes to ${e.filepath.split("/").pop()}`),await s.commands.executeCommand("workbench.action.closeActiveEditor")}let t=await globalThis.fetch(`http://host.docker.internal:51500/api/diffs/${e.diffId}/resolve`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:e.action})});if(!t.ok)throw new Error(`Failed to resolve on Interceptor API. Status: ${t.status}`)}catch(t){console.error("[Hermes] Failed to resolve diff",t),s.window.showErrorMessage("Hermes: Failed to notify agent about diff resolution.")}}async _handleChatMessage(e){this.postMessage({type:"addMessage",message:{id:`msg-${Date.now()}-user`,role:"user",content:e,timestamp:Date.now(),status:"done"}});let t=`msg-${Date.now()}-assistant`;this.postMessage({type:"addMessage",message:{id:t,role:"assistant",content:"",timestamp:Date.now(),status:"streaming"}});let i=s.window.activeTextEditor,o="";if(i){let r=i.document,p=i.selections.map(l=>r.getText(l)).join(`
`).trim();o+=`Active File: ${s.workspace.asRelativePath(r.uri)}
`,p&&(o+=`Selected Code:
\`\`\`
${p}
\`\`\`
`);let f=s.languages.getDiagnostics(r.uri);if(f.length>0){let l=f.filter(v=>v.severity===s.DiagnosticSeverity.Error).map(v=>`- Line ${v.range.start.line+1}: ${v.message}`).join(`
`);l&&(o+=`Current Linter Errors:
${l}
`)}}let d="";try{await this._hermesClient.streamChat(e,o,r=>{if(r==="__HERMES_PROPOSE_DIFF__"){this.postMessage({type:"triggerDiff",filepath:i?.document.uri.fsPath||"workspace-file",originalContent:i?.document.getText()||"",newContent:(i?.document.getText()||"")+`
// Proposed by Hermes`});return}d+=r,this.postMessage({type:"updateMessage",id:t,content:d,status:"streaming"})})}catch(r){console.error(r),d+=`

Error: ${r.message}`}this.postMessage({type:"updateMessage",id:t,content:d,status:"done"})}_getHtmlForWebview(e){let t=e.asWebviewUri(s.Uri.joinPath(this._extensionUri,"webview-dist","index.js")),i=e.asWebviewUri(s.Uri.joinPath(this._extensionUri,"webview-dist","index.css")),o=k();return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${e.cspSource} 'unsafe-inline';
                 script-src 'nonce-${o}';
                 font-src ${e.cspSource};
                 img-src ${e.cspSource} https: data:;
                 trusted-types svelte-trusted-html;">
  <title>Hermes Chat</title>
  <link rel="stylesheet" href="${i}">
</head>
<body>
  <div id="app"></div>
  <script nonce="${o}" src="${t}"></script>
</body>
</html>`}};function k(){let n="",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let t=0;t<32;t++)n+=e.charAt(Math.floor(Math.random()*e.length));return n}function I(n){console.log("Hermes Extension activated"),n.subscriptions.push(h.workspace.registerTextDocumentContentProvider("hermes-draft",$));let e=new w(n.extensionUri);n.subscriptions.push(h.window.registerWebviewViewProvider(w.viewType,e)),n.subscriptions.push(h.commands.registerCommand("hermes.focus",()=>{h.commands.executeCommand("workbench.view.extension.hermes-sidebar")}))}function W(){}0&&(module.exports={activate,deactivate});
