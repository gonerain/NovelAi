export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export class LlmRequestError extends Error {
  readonly status?: number;
  readonly provider: string;
  readonly details?: unknown;

  constructor(args: {
    provider: string;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "LlmRequestError";
    this.provider = args.provider;
    this.status = args.status;
    this.details = args.details;
  }
}
