export function waitProcessSignal(signal: Deno.Signal): Promise<void> {
  return new Promise((resolve) => {
    const sigintHandler = () => {
      Deno.removeSignalListener(signal, sigintHandler);
      resolve();
    };
    Deno.addSignalListener(signal, sigintHandler);
  });
}
