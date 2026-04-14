import { createRequire } from "node:module";

type RequestInitWithDispatcher = RequestInit & {
  dispatcher?: unknown;
};

type Dispatcher = unknown;
type UndiciModule = {
  ProxyAgent: new (proxyUrl: string) => Dispatcher;
  fetch: (input: string | URL, init?: RequestInitWithDispatcher) => Promise<Response>;
};

const require = createRequire(import.meta.url);

let cachedProxyUrl: string | null = null;
let cachedDispatcher: Dispatcher | null = null;
let cachedUndiciModule: UndiciModule | null = null;

function getUndici() {
  if (cachedUndiciModule) {
    return cachedUndiciModule;
  }

  cachedUndiciModule = require("undici") as UndiciModule;
  return cachedUndiciModule;
}

function getProxyUrl(target: string | URL) {
  const protocol = new URL(target).protocol;
  if (protocol === "https:") {
    return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || null;
  }

  return process.env.HTTP_PROXY || process.env.ALL_PROXY || null;
}

function getDispatcher(proxyUrl: string) {
  if (cachedDispatcher && cachedProxyUrl === proxyUrl) {
    return cachedDispatcher;
  }

  const { ProxyAgent } = getUndici();
  cachedProxyUrl = proxyUrl;
  cachedDispatcher = new ProxyAgent(proxyUrl);
  return cachedDispatcher;
}

export function serverFetch(input: string | URL, init?: RequestInit) {
  const { fetch: undiciFetch } = getUndici();
  const proxyUrl = getProxyUrl(input);
  const requestInit: RequestInitWithDispatcher = { ...(init ?? {}) };

  if (proxyUrl) {
    requestInit.dispatcher = getDispatcher(proxyUrl);
  }

  return undiciFetch(input, requestInit);
}
