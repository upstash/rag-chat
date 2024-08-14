import type { CustomPrompt } from "./rag-chat";

export const DEFAULT_CHAT_SESSION_ID = "upstash-rag-chat-session";
export const DEFAULT_CHAT_RATELIMIT_SESSION_ID = "upstash-rag-chat-ratelimit-session";

export const RATELIMIT_ERROR_MESSAGE = "ERR:USER_RATELIMITED";

export const DEFAULT_VECTOR_DB_NAME = "upstash-rag-chat-vector";
export const DEFAULT_REDIS_DB_NAME = "upstash-rag-chat-redis";

//Retrieval related default options
export const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
export const DEFAULT_TOP_K = 5;

//History related default options
export const DEFAULT_HISTORY_TTL = 86_400;
export const DEFAULT_HISTORY_LENGTH = 5;

//We need that constant to split creator LLM such as `ChatOpenAI_gpt-3.5-turbo`. Format is `provider_modelName`.
export const MODEL_NAME_WITH_PROVIDER_SPLITTER = "_";

//We need to make sure namespace is not undefined, but "". This will force vector-db to query default namespace.
export const DEFAULT_NAMESPACE = "";

export const DEFAULT_PROMPT: CustomPrompt = ({ context, question, chatHistory }) =>
  `You are a friendly AI assistant augmented with an Upstash Vector Store.
  To help you answer the questions, a context and/or chat history will be provided.
  Answer the question at the end using only the information available in the context or chat history, either one is ok.

  -------------
  Chat history:
  ${chatHistory}
  -------------
  Context:
  ${context}
  -------------

  Question: ${question}
  Helpful answer:`;

export const DEFAULT_PROMPT_WITHOUT_RAG: CustomPrompt = ({ question, chatHistory }) =>
  `You are a friendly AI assistant.
    To help you answer the questions, a chat history will be provided.
    Answer the question at the end.
    -------------
    Chat history:
    ${chatHistory}
    -------------
    Question: ${question}
    Helpful answer:`;

export const OLLAMA_MODELS = [
  "llama3.1",
  "gemma2",
  "mistral-nemo",
  "mistral-large",
  "qwen2",
  "deepseek-coder-v2",
  "phi3",
  "mistral",
  "mixtral",
  "codegemma",
  "command-r",
  "command-r-plus",
  "llava",
  "llama3",
  "gemma",
  "qwen",
  "llama2",
  "codellama",
  "dolphin-mixtral",
  "nomic-embed-text",
  "llama2-uncensored",
  "phi",
  "deepseek-coder",
  "zephyr",
  "mxbai-embed-large",
  "dolphin-mistral",
  "orca-mini",
  "dolphin-llama3",
  "starcoder2",
  "yi",
  "mistral-openorca",
  "llama2-chinese",
  "llava-llama3",
  "starcoder",
  "vicuna",
  "tinyllama",
  "codestral",
  "wizard-vicuna-uncensored",
  "nous-hermes2",
  "wizardlm2",
  "openchat",
  "aya",
  "tinydolphin",
  "stable-code",
  "wizardcoder",
  "openhermes",
  "all-minilm",
  "granite-code",
  "codeqwen",
  "stablelm2",
  "wizard-math",
  "neural-chat",
  "phind-codellama",
  "llama3-gradient",
  "dolphincoder",
  "nous-hermes",
  "sqlcoder",
  "xwinlm",
  "deepseek-llm",
  "yarn-llama2",
  "llama3-chatqa",
  "starling-lm",
  "wizardlm",
  "falcon",
  "orca2",
  "snowflake-arctic-embed",
  "solar",
  "samantha-mistral",
  "moondream",
  "stable-beluga",
  "dolphin-phi",
  "bakllava",
  "deepseek-v2",
  "wizardlm-uncensored",
  "yarn-mistral",
  "medllama2",
  "llama-pro",
  "glm4",
  "nous-hermes2-mixtral",
  "meditron",
  "codegeex4",
  "nexusraven",
  "llava-phi3",
  "codeup",
  "everythinglm",
  "magicoder",
  "stablelm-zephyr",
  "codebooga",
  "mistrallite",
  "wizard-vicuna",
  "duckdb-nsql",
  "megadolphin",
  "falcon2",
  "notux",
  "goliath",
  "open-orca-platypus2",
  "notus",
  "internlm2",
  "llama3-groq-tool-use",
  "dbrx",
  "alfred",
  "mathstral",
  "firefunction-v2",
  "nuextract",
  "bge-m3",
  "bge-large",
  "paraphrase-multilingual",
] as const;
