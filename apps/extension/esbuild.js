const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--minify');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',
	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});

	// Bundle mcpStandalone.ts as standalone Bun executable (single file, no external deps)
	const standaloneCtx = await esbuild.context({
		entryPoints: ['src/mcpStandalone.ts'],
		bundle: true,
		format: 'esm',
		minify: production,
		sourcemap: false,
		platform: 'node', // compatible with Bun (superset of Node)
		outfile: 'dist/mcpStandalone.js',
		external: [], // bundle everything — no node_modules needed at runtime
		target: 'esnext',
		logLevel: 'silent',
		banner: {
			js: '// Standalone MCP Server — run with: bun run mcpStandalone.js',
		},
	});
	await standaloneCtx.rebuild();
	await standaloneCtx.dispose();
	console.log('[build] Bundled mcpStandalone.js (standalone Bun)');

	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
