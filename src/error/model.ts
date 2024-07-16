export class upstashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}
