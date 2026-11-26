import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { uploadRouter } from "./upload";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migrazione automatica e idempotente: aggiunge le colonne introdotte dopo
 * il primo deploy. Così sia il DB locale sia quello di produzione hanno le
 * colonne «feasibility» (fonte unica dell'idoneità) e «instructions»
 * (istruzioni personalizzate) senza passaggi manuali.
 */
async function ensureSchema(): Promise<void> {
  // Anteprima e produzione condividono i dati reali: in sviluppo non eseguire
  // automaticamente DDL o migrazioni. La verifica delle colonne in produzione
  // resta invariata; un eventuale DB nuovo si prepara solo con consenso.
  if (process.env.NODE_ENV === "development" || !db) return;
  try {
    await db.execute(
      sql`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS feasibility jsonb`
    );
    await db.execute(
      sql`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions text`
    );
    console.log("[ensureSchema] schema exercises aggiornato");
  } catch (err) {
    console.error("[ensureSchema] migrazione saltata:", err);
  }
}
// Production static file serving - no dev dependencies, safe to bundle
import { serveStatic } from "./static";

const isDev = process.env.NODE_ENV === "development";

// Port scanning only needed in development (multiple processes)
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Aggiorna lo schema (idempotente) prima di servire richieste
  await ensureSchema();

  // Health check endpoint for Cloud Run / load balancers
  app.get("/_health", (_req, res) => {
    res.status(200).send("OK");
  });

  // CORS per i font OpenDyslexic: così PDF/embed esterni possono caricarli
  app.use("/fonts", (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    next();
  });

  // Proxy immagini per l'esportazione PDF: le immagini dell'abbinamento
  // (media.easy-peasy.ai, Twemoji...) non hanno header CORS, quindi il
  // fetch del browser fallisce e il PDF esce con i riquadri vuoti. Il
  // server scarica al posto del browser: solo http/https, solo immagini,
  // con timeout e limite di dimensione.
  app.get("/api/img-proxy", async (req, res) => {
    const url = String(req.query.url ?? "");
    if (!/^https?:\/\/.+/i.test(url)) {
      res.status(400).json({ error: "url non valido" });
      return;
    }
    try {
      const upstream = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; IngleseFacile-PDF/1.0)" },
      });
      const type = upstream.headers.get("content-type") ?? "";
      if (!upstream.ok || !/^image\//i.test(type)) {
        res.status(502).json({ error: `sorgente non valida (${upstream.status} ${type})` });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) {
        res.status(413).json({ error: "immagine troppo grande" });
        return;
      }
      res.setHeader("content-type", type);
      res.setHeader("cache-control", "public, max-age=86400");
      res.send(buf);
    } catch {
      res.status(502).json({ error: "download non riuscito" });
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // File upload/delete via multipart form
  app.use(uploadRouter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Development mode uses Vite HMR, production mode uses static files
  if (isDev) {
    // Dynamic import - vite.ts is only loaded in development
    // This prevents bundling vite and devDependencies in production
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // In production (Cloud Run), PORT is set by the platform - use it directly
  // In development, scan for available port if preferred port is busy
  const preferredPort = parseInt(process.env.PORT || "3000");
  let port = preferredPort;

  if (isDev) {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
