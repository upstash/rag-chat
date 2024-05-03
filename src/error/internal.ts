export class InternalUpstashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InternalError";
  }
}
