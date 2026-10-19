interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run<T = any>(): Promise<{ success: boolean; meta: any }>;
}

declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface DurableObjectState {
    id: { toString(): string };
    storage: {
      get<T = any>(key: string): Promise<T | undefined>;
      put(key: string, value: any): Promise<void>;
      delete(key: string): Promise<boolean>;
    };
  }

  interface DurableObjectNamespace {
    idFromName(name: string): any;
    get(id: any): {
      fetch(request: Request): Promise<Response>;
    };
  }

  class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }

  interface ResponseInit {
    webSocket?: WebSocket;
  }
}

export {};
