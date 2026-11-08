import express, { Request, Response, NextFunction } from "express";

export interface RouteHandler {
  (req: Request, res: Response, next?: NextFunction): Promise<any>;
}

// Built-in Middleware Providers
export const cors = (options = { origin: "*" }) => (req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", options.origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
};

export const logger = () => (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
};

// Extremely simple mock auth middleware for 0.6 preview
export const requireAuth = () => (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

export const Env = {
  get(key: string): string | undefined {
    return process.env[key];
  },
  require(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Environment variable ${key} is required but not set.`);
    return val;
  }
};

export const Secrets = {
  get(key: string): string {
    return Env.require(key);
  }
};

export const Storage = {
  async put(key: string, _data: Buffer | string | Uint8Array, _options?: { contentType?: string }): Promise<void> {
    // Mock implementation for 0.6
    console.log(`[Storage] Put ${key}`);
  },
  async get(key: string): Promise<Buffer | null> {
    console.log(`[Storage] Get ${key}`);
    return null;
  }
};

export const Jobs = {
  async enqueue(jobName: string, payload: any, options?: { delay?: number; retries?: number }): Promise<void> {
    // Mock implementation for 0.6
    console.log(`[Jobs] Enqueued job '${jobName}' with payload:`, payload, options ? `(options: ${JSON.stringify(options)})` : "");
  },
  async schedule(jobName: string, cron: string, _payload?: any): Promise<void> {
    console.log(`[Jobs] Scheduled job '${jobName}' with cron '${cron}'`);
  }
};

export interface RuntimeOptions {
  port?: number;
  routes: Record<string, RouteHandler>;
  middleware?: Array<express.RequestHandler>;
  services?: Record<string, any>;
}

export function createServer(options: RuntimeOptions) {
  const app = express();
  
  app.use(express.json());
  
  if (options.services) {
    const services = options.services;
    app.use((req: any, _res, next) => {
      req.services = services;
      next();
    });
  }

  if (options.middleware) {
    for (const mw of options.middleware) {
      app.use(mw);
    }
  }
  
  // Register routes
  for (const [routeKey, handler] of Object.entries(options.routes)) {
    const [method, ...pathParts] = routeKey.split(" ");
    const path = pathParts.join(" ");
    
    if (method && path) {
      const expressMethod = method.toLowerCase() as keyof express.Application;
      if (typeof app[expressMethod] === "function") {
        app[expressMethod](path, async (req: Request, res: Response, next: NextFunction) => {
          try {
            const result = await handler(req, res, next);
            if (!res.headersSent && result !== undefined) {
              res.json(result);
            }
          } catch (error) {
            next(error);
          }
        });
      }
    }
  }

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: "error", message: "Runtime Error", error: err.toString() }));
    res.status(500).json({ error: "Internal Server Error" });
  });

  return {
    app,
    start: () => {
      const port = options.port || process.env.PORT || 3000;
      const server = app.listen(port, () => {
        console.log(JSON.stringify({ level: "info", message: `JGrandson server running on port ${port}` }));
      });

      const shutdown = () => {
        console.log(JSON.stringify({ level: "info", message: "Shutting down gracefully..." }));
        server.close(() => {
          process.exit(0);
        });
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      return server;
    }
  };
}

export * from "./db";
export * from "./ai";
