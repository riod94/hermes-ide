"use strict";var M=Object.create;var w=Object.defineProperty;var _=Object.getOwnPropertyDescriptor;var U=Object.getOwnPropertyNames;var E=Object.getPrototypeOf,C=Object.prototype.hasOwnProperty;var T=(t,e)=>{for(var o in e)w(t,o,{get:e[o],enumerable:!0})},x=(t,e,o,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of U(e))!C.call(t,s)&&s!==o&&w(t,s,{get:()=>e[s],enumerable:!(i=_(e,s))||i.enumerable});return t};var $=(t,e,o)=>(o=t!=null?M(E(t)):{},x(e||!t||!t.__esModule?w(o,"default",{value:t,enumerable:!0}):o,t)),S=t=>x(w({},"__esModule",{value:!0}),t);var k={};T(k,{activate:()=>D,deactivate:()=>P});module.exports=S(k);var u=$(require("vscode"));var n=$(require("vscode"));var y=class{apiUrl;apiKey;conversationId="ide-session";constructor(){this.apiUrl=process.env.HERMES_API_URL||"http://127.0.0.1:3000/v1",this.apiKey=process.env.HERMES_API_KEY||"default-token"}async streamChat(e,o,i){try{let s=o?`${o}

User: ${e}`:e,c=await fetch(`${this.apiUrl}/responses`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.apiKey}`},body:JSON.stringify({model:"hermes-agent",input:s,conversation:this.conversationId,stream:!0})});if(!c.ok)throw new Error(`API error: ${c.statusText}`);if(c.body){let a=c.body;if(a.getReader){let f=a.getReader(),p=new TextDecoder,v="";for(;;){let{done:d,value:h}=await f.read();if(d)break;v+=p.decode(h,{stream:!0});let m=v.split(`
`);v=m.pop()||"";for(let r of m){let b=r.trim();if(b.startsWith("data: ")&&b!=="data: [DONE]")try{let l=JSON.parse(b.slice(6));l.type==="response.output_text.delta"?i(l.delta||l.text||""):l.type==="function_call"?i(`
> \u{1F6E0}\uFE0F **Mengerjakan Tool: ${l.name}**
`):l.choices&&l.choices[0].delta?.content&&i(l.choices[0].delta.content)}catch{}}}}else if(a[Symbol.asyncIterator]){let f=new TextDecoder,p="";for await(let v of a){p+=f.decode(v,{stream:!0});let d=p.split(`
`);p=d.pop()||"";for(let h of d){let m=h.trim();if(m.startsWith("data: ")&&m!=="data: [DONE]")try{let r=JSON.parse(m.slice(6));r.type==="response.output_text.delta"?i(r.delta||r.text||""):r.type==="function_call"?i(`
> \u{1F6E0}\uFE0F **Mengerjakan Tool: ${r.name}**
`):r.choices&&r.choices[0].delta?.content?i(r.choices[0].delta.content):r.event==="hermes.tool.progress"&&i(`
> \u{1F6E0}\uFE0F **${r.tool}**: ${JSON.stringify(r.arguments||{})}
`)}catch{}}}}}}catch(s){i(`

[Error: ${s instanceof Error?s.message:"Unknown"}]`)}}};var g=class{constructor(e){this._extensionUri=e;this._hermesClient=new y}static viewType="hermes.chatView";_view;_hermesClient;resolveWebviewView(e,o,i){this._view=e,e.webview.options={enableScripts:!0,localResourceRoots:[n.Uri.joinPath(this._extensionUri,"webview-dist")]},e.webview.html=this._getHtmlForWebview(e.webview),e.webview.onDidReceiveMessage(s=>{switch(s.type){case"chatMessage":this._handleChatMessage(s.value);break;case"clearChat":break;case"copyCode":n.env.clipboard.writeText(s.value),n.window.showInformationMessage("Code copied to clipboard");break;case"ready":console.log("[Hermes] Webview ready");break}})}postMessage(e){this._view?.webview.postMessage(e)}async _handleChatMessage(e){this.postMessage({type:"addMessage",message:{id:`msg-${Date.now()}-user`,role:"user",content:e,timestamp:Date.now(),status:"done"}});let o=`msg-${Date.now()}-assistant`;this.postMessage({type:"addMessage",message:{id:o,role:"assistant",content:"",timestamp:Date.now(),status:"streaming"}});let i=n.window.activeTextEditor,s="";if(i){let a=i.document,p=i.selections.map(d=>a.getText(d)).join(`
`).trim();s+=`Active File: ${n.workspace.asRelativePath(a.uri)}
`,p&&(s+=`Selected Code:
\`\`\`
${p}
\`\`\`
`);let v=n.languages.getDiagnostics(a.uri);if(v.length>0){let d=v.filter(h=>h.severity===n.DiagnosticSeverity.Error).map(h=>`- Line ${h.range.start.line+1}: ${h.message}`).join(`
`);d&&(s+=`Current Linter Errors:
${d}
`)}}let c="";try{await this._hermesClient.streamChat(e,s,a=>{c+=a,this.postMessage({type:"updateMessage",id:o,content:c})})}catch(a){console.error(a),c+=`\\n\\nError: ${a.message}`}this.postMessage({type:"updateMessage",id:o,content:c,status:"done"})}_getHtmlForWebview(e){let o=e.asWebviewUri(n.Uri.joinPath(this._extensionUri,"webview-dist","index.js")),i=e.asWebviewUri(n.Uri.joinPath(this._extensionUri,"webview-dist","index.css")),s=W();return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${e.cspSource} 'unsafe-inline';
                 script-src 'nonce-${s}';
                 font-src ${e.cspSource};
                 img-src ${e.cspSource} https: data:;
                 trusted-types svelte-trusted-html;">
  <title>Hermes Chat</title>
  <link rel="stylesheet" href="${i}">
</head>
<body>
  <div id="app"></div>
  <script nonce="${s}" src="${o}"></script>
</body>
</html>`}};function W(){let t="",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let o=0;o<32;o++)t+=e.charAt(Math.floor(Math.random()*e.length));return t}function D(t){console.log("Hermes IDE Extension is now active.");let e=new g(t.extensionUri);t.subscriptions.push(u.window.registerWebviewViewProvider(g.viewType,e)),t.subscriptions.push(u.commands.registerCommand("hermes.focus",()=>{u.commands.executeCommand("workbench.view.extension.hermes-sidebar")}))}function P(){}0&&(module.exports={activate,deactivate});
