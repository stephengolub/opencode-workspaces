try {
  const mod = await import("/Users/sgolub/.cache/opencode/packages/opencode-workspaces@latest/node_modules/opencode-workspaces/src/index.tsx");
  console.log("SUCCESS: Module loaded");
  console.log("Keys:", Object.keys(mod || {}));
  if (mod.default) {
    console.log("Default export keys:", Object.keys(mod.default));
  }
} catch (err) {
  console.error("ERROR:", err.message);
  console.error(err.stack?.split('\n').slice(0,5).join('\n'));
}
