import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DataPoint {
  id: string;
  source: string;
  timestamp: string;
  data: Record<string, number>;
}

interface Anomaly {
  id: string;
  dataPointId: string;
  timestamp: string;
  score: number;
  isAnomaly: boolean;
  explanation: string;
  fields: string[];
}

interface Drift {
  id: string;
  timestamp: string;
  type: "schema" | "distribution";
  description: string;
  severity: "low" | "medium" | "high";
}

// In-memory store for demo purposes (simulating Redis/Postgres)
let dataStore: DataPoint[] = [];
let anomalyStore: Anomaly[] = [];
let driftStore: Drift[] = [];

// Configuration for anomaly detection and retention
const WINDOW_SIZE = 50;
const Z_THRESHOLD = 3.0;

const RETENTION_CONFIG = {
  dataPointsDays: parseInt(process.env.RETENTION_DATA_DAYS || "7"),
  anomaliesDays: parseInt(process.env.RETENTION_ANOMALY_DAYS || "3"),
  driftsDays: parseInt(process.env.RETENTION_DRIFT_DAYS || "3")
};

function cleanupStores() {
  const now = new Date().getTime();
  
  const dataCutoff = now - (RETENTION_CONFIG.dataPointsDays * 24 * 60 * 60 * 1000);
  const anomalyCutoff = now - (RETENTION_CONFIG.anomaliesDays * 24 * 60 * 60 * 1000);
  const driftCutoff = now - (RETENTION_CONFIG.driftsDays * 24 * 60 * 60 * 1000);

  const beforeCounts = {
    data: dataStore.length,
    anomalies: anomalyStore.length,
    drifts: driftStore.length
  };

  dataStore = dataStore.filter(dp => new Date(dp.timestamp).getTime() > dataCutoff);
  anomalyStore = anomalyStore.filter(a => new Date(a.timestamp).getTime() > anomalyCutoff);
  driftStore = driftStore.filter(d => new Date(d.timestamp).getTime() > driftCutoff);

  const afterCounts = {
    data: dataStore.length,
    anomalies: anomalyStore.length,
    drifts: driftStore.length
  };

  if (beforeCounts.data !== afterCounts.data || beforeCounts.anomalies !== afterCounts.anomalies || beforeCounts.drifts !== afterCounts.drifts) {
    console.log(`[Retention] Cleanup performed. Data: ${beforeCounts.data}->${afterCounts.data}, Anomalies: ${beforeCounts.anomalies}->${afterCounts.anomalies}, Drifts: ${beforeCounts.drifts}->${afterCounts.drifts}`);
  }
}

function calculateZScore(value: number, mean: number, stdDev: number) {
  if (stdDev === 0) return 0;
  return Math.abs((value - mean) / stdDev);
}

function getStats(values: number[]) {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / n);
  return { mean, stdDev };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/data", (req, res) => {
    const { source, timestamp, data } = req.body;
    const newDataPoint: DataPoint = {
      id: Math.random().toString(36).substr(2, 9),
      source: source || "default-service",
      timestamp: timestamp || new Date().toISOString(),
      data: data || {}
    };

    dataStore.push(newDataPoint);
    // Time-based retention handles cleanup, but we keep a hard cap for safety
    if (dataStore.length > 1000) dataStore.shift();

    // Anomaly Detection Logic
    const fields = Object.keys(newDataPoint.data);
    let maxZ = 0;
    const anomalousFields: string[] = [];

    fields.forEach(field => {
      const historicalValues = dataStore
        .slice(-WINDOW_SIZE)
        .map(dp => dp.data[field])
        .filter(v => v !== undefined);

      if (historicalValues.length > 5) {
        const { mean, stdDev } = getStats(historicalValues);
        const currentVal = newDataPoint.data[field];
        const z = calculateZScore(currentVal, mean, stdDev);
        if (z > maxZ) maxZ = z;
        if (z > Z_THRESHOLD) anomalousFields.push(field);
      }
    });

    if (maxZ > Z_THRESHOLD) {
      const anomaly: Anomaly = {
        id: Math.random().toString(36).substr(2, 9),
        dataPointId: newDataPoint.id,
        timestamp: newDataPoint.timestamp,
        score: parseFloat(maxZ.toFixed(2)),
        isAnomaly: true,
        explanation: `Detected significant deviation in fields: ${anomalousFields.join(", ")}`,
        fields: anomalousFields
      };
      anomalyStore.push(anomaly);
      if (anomalyStore.length > 500) anomalyStore.shift();
    }

    // Drift Detection (Schema)
    if (dataStore.length > 1) {
      const prevPoint = dataStore[dataStore.length - 2];
      const prevFields = Object.keys(prevPoint.data).sort().join(",");
      const currFields = Object.keys(newDataPoint.data).sort().join(",");
      
      if (prevFields !== currFields) {
        driftStore.push({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: newDataPoint.timestamp,
          type: "schema",
          description: `Schema changed from [${prevFields}] to [${currFields}]`,
          severity: "medium"
        });
      }
    }

    res.status(201).json({ 
      status: "success", 
      id: newDataPoint.id,
      anomaly: anomalyStore.find(a => a.dataPointId === newDataPoint.id) || null
    });
  });

  app.get("/api/anomalies", (req, res) => {
    res.json(anomalyStore.slice().reverse());
  });

  app.get("/api/drift", (req, res) => {
    res.json(driftStore.slice().reverse());
  });

  app.get("/api/stats", (req, res) => {
    res.json({
      totalPoints: dataStore.length,
      anomalyCount: anomalyStore.length,
      driftCount: driftStore.length,
      recentPoints: dataStore.slice(-50)
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DataGuard AI Server running on http://localhost:${PORT}`);
    
    // Start periodic cleanup every hour
    setInterval(cleanupStores, 60 * 60 * 1000);
    // Run initial cleanup
    cleanupStores();
  });
}

startServer();
