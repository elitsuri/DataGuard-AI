import React, { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Database, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  RefreshCw,
  Zap,
  BarChart3,
  Layers
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export default function App() {
  const [stats, setStats] = useState<{
    totalPoints: number;
    anomalyCount: number;
    driftCount: number;
    recentPoints: DataPoint[];
  } | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "anomalies" | "drift">("dashboard");

  const fetchData = async () => {
    try {
      const [statsRes, anomaliesRes, driftRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/anomalies"),
        fetch("/api/drift")
      ]);
      
      const statsData = await statsRes.json();
      const anomaliesData = await anomaliesRes.json();
      const driftData = await driftRes.json();

      setStats(statsData);
      setAnomalies(anomaliesData);
      setDrifts(driftData);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulate incoming data for demo
  const simulateData = async () => {
    const isAnomaly = Math.random() > 0.9;
    const baseValue = 50;
    const value = isAnomaly ? baseValue + (Math.random() * 100) : baseValue + (Math.random() * 10 - 5);
    
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "service-alpha",
        data: {
          throughput: value,
          latency: 20 + Math.random() * 5,
          error_rate: Math.random() * 0.01
        }
      })
    });
    fetchData();
  };

  const chartData = useMemo(() => {
    if (!stats?.recentPoints) return [];
    return stats.recentPoints.map(p => ({
      time: format(new Date(p.timestamp), "HH:mm:ss"),
      throughput: p.data.throughput,
      latency: p.data.latency,
      isAnomaly: anomalies.some(a => a.dataPointId === p.id)
    }));
  }, [stats, anomalies]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-gray-100 font-sans selection:bg-orange-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-[#0D0D0E] z-50 hidden lg:block">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">DataGuard AI</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Pipeline Integrity</p>
          </div>
        </div>

        <nav className="mt-8 px-4 space-y-2">
          {[
            { id: "dashboard", icon: BarChart3, label: "Dashboard" },
            { id: "anomalies", icon: AlertTriangle, label: "Anomalies", badge: anomalies.length },
            { id: "drift", icon: Layers, label: "Drift Detection", badge: drifts.length },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" 
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === item.id ? "bg-orange-500 text-white" : "bg-white/10 text-gray-400"
                )}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-6">
          <button 
            onClick={simulateData}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Zap size={16} className="text-orange-500" />
            Simulate Stream
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8 min-h-screen">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">
              {activeTab === "dashboard" && "System Overview"}
              {activeTab === "anomalies" && "Anomaly Engine"}
              {activeTab === "drift" && "Drift Analysis"}
            </h2>
            <p className="text-gray-500 text-sm">
              Real-time monitoring of <span className="text-orange-500 font-mono">service-alpha</span> pipeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live Engine</span>
            </div>
            <button className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              <RefreshCw size={18} className="text-gray-400" />
            </button>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Total Events", value: stats?.totalPoints || 0, icon: Database, color: "text-blue-500" },
                { label: "Anomalies", value: stats?.anomalyCount || 0, icon: AlertTriangle, color: "text-orange-500" },
                { label: "Drift Events", value: stats?.driftCount || 0, icon: TrendingUp, color: "text-purple-500" },
                { label: "Avg Latency", value: "22.4ms", icon: Clock, color: "text-green-500" },
              ].map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label}
                  className="bg-[#0D0D0E] border border-white/5 p-6 rounded-2xl relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                      <stat.icon size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">24h Change</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
                    <span className="text-xs text-green-500 font-medium">+12%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{stat.label}</p>
                  <div className="absolute -right-4 -bottom-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                    <stat.icon size={120} />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 bg-[#0D0D0E] border border-white/5 p-8 rounded-3xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Activity size={18} className="text-orange-500" />
                    Throughput Analysis
                  </h3>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-white/5 rounded text-[10px] font-mono text-gray-400">Z-Score Engine</span>
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#666" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        stroke="#666" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={[0, 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151516', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#f97316' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="throughput" 
                        stroke="#f97316" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorThroughput)" 
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#0D0D0E] border border-white/5 p-8 rounded-3xl">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-orange-500" />
                  Recent Anomalies
                </h3>
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {anomalies.slice(0, 5).map((anomaly) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={anomaly.id}
                        className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-orange-500/30 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-gray-500">{format(new Date(anomaly.timestamp), "HH:mm:ss")}</span>
                          <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] font-bold rounded">Score: {anomaly.score}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-300 line-clamp-2 leading-relaxed">
                          {anomaly.explanation}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-1">
                            {anomaly.fields.map(f => (
                              <span key={f} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-gray-400">{f}</span>
                            ))}
                          </div>
                          <ChevronRight size={14} className="text-gray-600 group-hover:text-orange-500 transition-colors" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {anomalies.length === 0 && (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-600">
                      <Shield size={32} className="mb-2 opacity-20" />
                      <p className="text-xs">No anomalies detected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "anomalies" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {anomalies.map((anomaly) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={anomaly.id}
                    className="bg-[#0D0D0E] border border-white/5 p-6 rounded-2xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg mb-1">Statistical Outlier Detected</h4>
                          <p className="text-sm text-gray-400 mb-4">{anomaly.explanation}</p>
                          <div className="flex gap-2">
                            {anomaly.fields.map(field => (
                              <span key={field} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-300">
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-500 mb-1">{anomaly.score}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Anomaly Score</div>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {format(new Date(anomaly.timestamp), "MMM d, yyyy HH:mm:ss")}</span>
                        <span className="flex items-center gap-1.5"><Database size={12} /> ID: {anomaly.dataPointId}</span>
                      </div>
                      <button className="text-orange-500 font-bold hover:underline">View Raw Payload</button>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="space-y-6">
                <div className="bg-[#0D0D0E] border border-white/5 p-6 rounded-2xl">
                  <h4 className="font-bold mb-4">Anomaly Distribution</h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <XAxis type="category" dataKey="time" name="time" stroke="#444" fontSize={10} />
                        <YAxis type="number" dataKey="score" name="score" stroke="#444" fontSize={10} />
                        <ZAxis type="number" range={[50, 400]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Anomalies" data={anomalies.map(a => ({ time: format(new Date(a.timestamp), "HH:mm"), score: a.score }))} fill="#f97316" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "drift" && (
          <div className="space-y-6">
            <div className="bg-[#0D0D0E] border border-white/5 p-8 rounded-3xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold mb-1">Schema & Distribution Drift</h3>
                  <p className="text-sm text-gray-500">Monitoring structural changes in data pipelines</p>
                </div>
                <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-500 text-xs font-bold">
                  KS-Test Active
                </div>
              </div>

              <div className="space-y-4">
                {drifts.map((drift) => (
                  <div key={drift.id} className="flex items-center gap-6 p-6 bg-white/5 border border-white/5 rounded-2xl">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      drift.severity === "high" ? "bg-red-500/10 text-red-500" : "bg-purple-500/10 text-purple-500"
                    )}>
                      <TrendingUp size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold capitalize">{drift.type} Drift Detected</h4>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          drift.severity === "high" ? "bg-red-500 text-white" : "bg-purple-500/20 text-purple-400"
                        )}>
                          {drift.severity} severity
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{drift.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">{format(new Date(drift.timestamp), "HH:mm:ss")}</div>
                      <button className="text-xs font-bold text-purple-500 hover:underline">Analyze Impact</button>
                    </div>
                  </div>
                ))}
                {drifts.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">
                    <Layers size={48} className="mb-4 opacity-10" />
                    <p className="text-sm">No drift events detected in the last 24 hours</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
