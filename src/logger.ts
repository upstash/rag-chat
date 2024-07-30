const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

type ChatLogEntry = {
  timestamp: number;
  logLevel: LogLevel;
  eventType:
    | "SEND_PROMPT"
    | "RETRIEVE_HISTORY"
    | "RETRIEVE_CONTEXT"
    | "FINAL_PROMPT"
    | "FORMAT_HISTORY"
    | "LLM_RESPONSE"
    | "ERROR";
  details: unknown;
  latency?: number;
};
type ChatLoggerOptions = {
  logLevel: LogLevel;
  logOutput: "console";
};

export class ChatLogger {
  private logs: ChatLogEntry[] = [];
  private options: ChatLoggerOptions;
  private eventStartTimes = new Map<string, number>();

  constructor(options: ChatLoggerOptions) {
    this.options = options;
  }

  private async log(
    level: LogLevel,
    eventType: ChatLogEntry["eventType"],
    details: unknown,
    latency?: number
  ): Promise<void> {
    if (this.shouldLog(level)) {
      const timestamp = Date.now();
      const logEntry: ChatLogEntry = {
        timestamp,
        logLevel: level,
        eventType,
        details,
        latency,
      };

      this.logs.push(logEntry);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.options.logOutput === "console") {
        await this.writeToConsole(logEntry);
      }

      // Introduce a small delay to make the sequence more visible
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async writeToConsole(logEntry: ChatLogEntry): Promise<void> {
    const JSON_SPACING = 2;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logEntry, undefined, JSON_SPACING));
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
    return levels.indexOf(level) >= levels.indexOf(this.options.logLevel);
  }

  private startTimer(eventType: ChatLogEntry["eventType"]) {
    this.eventStartTimes.set(eventType, Date.now());
  }

  private endTimer(eventType: ChatLogEntry["eventType"]): number | undefined {
    const startTime = this.eventStartTimes.get(eventType);
    if (startTime) {
      this.eventStartTimes.delete(eventType);
      return Date.now() - startTime;
    }
    return undefined;
  }

  async logSendPrompt(prompt: string): Promise<void> {
    await this.log("INFO", "SEND_PROMPT", { prompt });
  }

  startRetrieveHistory() {
    this.startTimer("RETRIEVE_HISTORY");
  }

  async endRetrieveHistory(history: unknown[]): Promise<void> {
    const latency = this.endTimer("RETRIEVE_HISTORY");
    await this.log("INFO", "RETRIEVE_HISTORY", { history }, latency);
  }

  startRetrieveContext() {
    this.startTimer("RETRIEVE_CONTEXT");
  }

  async endRetrieveContext(context: unknown): Promise<void> {
    const latency = this.endTimer("RETRIEVE_CONTEXT");
    await this.log("INFO", "RETRIEVE_CONTEXT", { context }, latency);
  }

  async logRetrieveFormatHistory(formattedHistory: unknown): Promise<void> {
    await this.log("INFO", "FORMAT_HISTORY", { formattedHistory });
  }

  async logFinalPrompt(prompt: unknown): Promise<void> {
    await this.log("INFO", "FINAL_PROMPT", { prompt });
  }

  startLLMResponse() {
    this.startTimer("LLM_RESPONSE");
  }

  async endLLMResponse(response: unknown): Promise<void> {
    const latency = this.endTimer("LLM_RESPONSE");
    await this.log("INFO", "LLM_RESPONSE", { response }, latency);
  }

  async logError(error: Error): Promise<void> {
    await this.log("ERROR", "ERROR", { message: error.message, stack: error.stack });
  }

  getLogs(): ChatLogEntry[] {
    return this.logs;
  }
}
