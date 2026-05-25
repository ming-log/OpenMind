let counter = 0;

export function createNodeId(prefix = "node"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function createStableTestId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}
