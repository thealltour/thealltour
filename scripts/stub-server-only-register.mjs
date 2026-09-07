export async function resolve(specifier, context, nextResolve) {
  const isServerOnly =
    specifier === "server-only" ||
    specifier.endsWith("/server-only") ||
    specifier.endsWith("\\server-only") ||
    specifier.includes("node_modules/server-only");
  if (isServerOnly) {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export {};",
      format: "module",
    };
  }
  return nextResolve(specifier, context);
}
