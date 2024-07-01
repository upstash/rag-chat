export class UpstashVectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VectorError";
  }
}
