/**
 * Batch error which is raised when one of function fails during batch process
 */
export class BatchError extends Error {
  // A result list which is successfully completed prior to the error
  readonly results: unknown[];

  constructor(message: string, results: unknown[]) {
    super(message);
    this.name = "BatchError";
    this.results = results;
  }
}
