export class UpstashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}
