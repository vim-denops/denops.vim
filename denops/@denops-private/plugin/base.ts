export type Plugin = {
  readonly name: string;
  readonly script: string;
  call(fn: string, ...args: unknown[]): Promise<unknown>;
  dispose(): void;
};
