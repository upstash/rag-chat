export class UpstashModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstashModelError";
  }
}
