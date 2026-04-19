import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth, useAuthHeaders } from "@/lib/auth-context";
import { 
  Activity, 
  ShieldAlert, 
  Globe, 
  Menu, 
  Bell, 
  LayoutDashboard,
  LogOut,
  Cpu,
  Send,
  ChevronRight,
  Zap,
  X,
  MessageSquare,
  Info,
  Search,
  Wifi,
  Server,
  AlertTriangle,
  Eye,
  Clock,
  TrendingUp,
  Shield,
  Radio,
  Settings,
  Users,
  Database,
  Trash2,
  HardDrive,
  UserCog,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "wouter";

interface SecurityEvent {
  id: string;
  eventId: string;
  timestamp: string;
  srcIp: string;
  dstIp: string;
  attackType: string;
  confidence: number;
  pred: number;
  srcModel: string | null;
  severity: string;
}

interface Stats {
  total: number;
  alerts: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface DataSource {
  id: string;
  name: string;
  sourceType: string;
  connectionMethod: string;
  description: string | null;
  enabled: boolean;
  apiKey: string;
  status: string;
  createdBy: string;
  createdAt: string;
  lastEventAt: string | null;
  eventCount: number;
}

type ViewType = "hub" | "traffic" | "map" | "incidents" | "system" | "sources";

export default function Dashboard() {
  const { user, logout, token } = useAuth();
  const headers = useAuthHeaders();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [isChatOpen, setIsChatOpen] = useState(!isMobile);
  const [activeView, setActiveView] = useState<ViewType>("hub");
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenAlertTime, setLastSeenAlertTime] = useState<string | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "NetSpectre AI online. Systems nominal. Monitoring all ingress vectors. How can I assist?" }
  ]);
  const [input, setInput] = useState("");

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [allEvents, setAllEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, alerts: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [systemStats, setSystemStats] = useState({ cpu: 42, memory: 64, network: 85 });
  const [wsConnected, setWsConnected] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, allEventsRes, statsRes] = await Promise.all([
        fetch("/api/alerts?limit=20", { headers }),
        fetch("/api/events?limit=100", { headers }),
        fetch("/api/stats", { headers }),
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setEvents(alertsData.alerts || []);
      }
      if (allEventsRes.ok) {
        const eventsData = await allEventsRes.json();
        setAllEvents(eventsData.events || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const pollInterval = wsConnected ? 15000 : 5000;
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, wsConnected]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/alerts`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => { setWsConnected(true); };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "alert" && data.event) {
            setEvents(prev => {
              if (prev.some(e => e.eventId === data.event.eventId)) return prev;
              return [data.event, ...prev].slice(0, 50);
            });
            setAllEvents(prev => {
              if (prev.some(e => e.eventId === data.event.eventId)) return prev;
              return [data.event, ...prev].slice(0, 100);
            });
            setStats(prev => ({
              ...prev,
              total: prev.total + 1,
              alerts: prev.alerts + 1,
              [data.event.severity as string]: (prev[data.event.severity as keyof Stats] as number || 0) + 1,
            }));
            toast({
              title: `SOC Alert: ${data.event.attackType}`,
              description: `${data.event.srcIp} → ${data.event.dstIp} [${data.event.severity.toUpperCase()}]`,
              variant: data.event.severity === 'critical' ? 'destructive' : undefined,
            });
          } else if (data.type === "event" && data.event && data.event.pred === 0) {
            setAllEvents(prev => {
              if (prev.some(e => e.eventId === data.event.eventId)) return prev;
              return [data.event, ...prev].slice(0, 100);
            });
            setStats(prev => ({ ...prev, total: prev.total + 1 }));
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [toast]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        cpu: Math.min(100, Math.max(0, prev.cpu + (Math.random() * 10 - 5))),
        memory: Math.min(100, Math.max(0, prev.memory + (Math.random() * 4 - 2))),
        network: Math.min(100, Math.max(0, prev.network + (Math.random() * 14 - 7))),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const threatLevel = stats.total > 0 ? Math.min(100, Math.round(((stats.critical * 3 + stats.high * 2 + stats.medium) / Math.max(stats.total, 1)) * 50)) : 0;
  const threatLabel = threatLevel >= 70 ? "Critical" : threatLevel >= 40 ? "Elevated" : "Normal";

  const viewLabels: Record<ViewType, string> = {
    hub: "INTEL_STREAM",
    traffic: "TRAFFIC_MONITOR",
    map: "GLOBAL_MAP",
    incidents: "INCIDENT_RESPONSE",
    system: "SYS_MANAGEMENT",
    sources: "DATA_SOURCES",
  };

  const [chatLoading, setChatLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: updatedMessages.slice(1) }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Connection to SOC AI engine failed. Please retry." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error. SOC AI agent temporarily unavailable." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleNavClick = (view: ViewType) => {
    setActiveView(view);
    if (isMobile) setIsSidebarOpen(false);
  };

  const recentCriticalAlerts = useMemo(() => {
    return events.filter(e => e.severity === 'critical' || e.severity === 'high').slice(0, 10);
  }, [events]);

  const unreadCount = useMemo(() => {
    if (!lastSeenAlertTime) return recentCriticalAlerts.length;
    return recentCriticalAlerts.filter(a => new Date(a.timestamp) > new Date(lastSeenAlertTime)).length;
  }, [recentCriticalAlerts, lastSeenAlertTime]);

  const handleOpenNotifications = useCallback(() => {
    if (showNotifications) {
      setShowNotifications(false);
    } else {
      setShowNotifications(true);
      if (recentCriticalAlerts.length > 0) {
        setLastSeenAlertTime(recentCriticalAlerts[0].timestamp);
      }
    }
  }, [showNotifications, recentCriticalAlerts]);

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 fixed inset-y-0 z-50 lg:relative"
          >
            <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="NetSpectre" className="w-6 h-6 object-contain" />
                <span className="font-display font-bold text-lg tracking-wider">NetSpectre <span className="text-primary">AI</span></span>
              </div>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <NavItem icon={<LayoutDashboard size={18} />} label="Security Hub" active={activeView === "hub"} onClick={() => handleNavClick("hub")} data-testid="nav-hub" />
              <NavItem icon={<Activity size={18} />} label="Traffic Monitor" active={activeView === "traffic"} onClick={() => handleNavClick("traffic")} data-testid="nav-traffic" />
              <NavItem icon={<Globe size={18} />} label="Global Map" active={activeView === "map"} onClick={() => handleNavClick("map")} data-testid="nav-map" />
              <NavItem icon={<ShieldAlert size={18} />} label="Incidents" badge={String(stats.critical)} active={activeView === "incidents"} onClick={() => handleNavClick("incidents")} data-testid="nav-incidents" />
              <NavItem icon={<Database size={18} />} label="Data Sources" active={activeView === "sources"} onClick={() => handleNavClick("sources")} data-testid="nav-sources" />
              {user?.role === "admin" && (
                <NavItem icon={<Settings size={18} />} label="System Mgmt" active={activeView === "system"} onClick={() => handleNavClick("system")} data-testid="nav-system" />
              )}
            </nav>
            <div className="p-4 border-t border-sidebar-border space-y-1">
              <Link href="/about">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-primary/5 hover:text-foreground border border-transparent transition-all" data-testid="nav-about">
                  <Info size={18} />
                  <span className="text-sm font-medium font-display tracking-tight">About</span>
                </button>
              </Link>
              <div className="px-3 py-2 mb-2">
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest" data-testid="text-username">{user?.name}</p>
                <p className="text-[8px] font-mono text-muted-foreground/50">{user?.email}</p>
              </div>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={logout} data-testid="button-logout">
                <LogOut size={18} className="mr-2" /> De-authorize
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 shrink-0 z-40">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} data-testid="button-sidebar-toggle">
              <Menu size={20} />
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              <span className="text-primary">NS-CORE</span>
              <ChevronRight size={12} />
              <span className="text-foreground">{viewLabels[activeView]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden xl:flex items-center gap-4 pr-4 border-r border-border">
               <div className="text-right">
                  <p className="text-[9px] text-muted-foreground font-mono leading-none mb-1">TOTAL EVENTS</p>
                  <p className="text-xs font-bold font-display text-primary" data-testid="text-total-events">{stats.total.toLocaleString()}</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Button 
                  ref={bellRef}
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full border-primary/20 text-primary relative"
                  onClick={handleOpenNotifications}
                  data-testid="button-notifications"
                >
                  <Bell size={14} />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-[8px] text-white rounded-full flex items-center justify-center font-bold"
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-primary/5 border border-primary/20">
                <Activity size={12} className="text-primary animate-pulse" />
                <span className="text-[9px] font-mono text-primary font-bold hidden sm:inline">SYNCED</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <ScrollArea className="flex-1 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6 pb-20 lg:pb-0">
              {activeView === "hub" && <SecurityHubView events={events} stats={stats} systemStats={systemStats} threatLevel={threatLevel} threatLabel={threatLabel} />}
              {activeView === "traffic" && <TrafficMonitorView allEvents={allEvents} stats={stats} systemStats={systemStats} />}
              {activeView === "map" && <GlobalMapView events={events} allEvents={allEvents} stats={stats} />}
              {activeView === "incidents" && <IncidentsView events={events} stats={stats} />}
              {activeView === "sources" && <DataSourcesView headers={headers} />}
              {activeView === "system" && <SystemManagementView headers={headers} onDataChange={fetchData} />}
            </div>
          </ScrollArea>

          <AnimatePresence>
            {isChatOpen && (
              <motion.div 
                initial={isMobile ? { y: '100%' } : { x: 400 }}
                animate={isMobile ? { y: 0 } : { x: 0 }}
                exit={isMobile ? { y: '100%' } : { x: 400 }}
                className={`bg-card border-l border-border flex flex-col z-50 ${isMobile ? 'fixed inset-0 pt-16' : 'w-[380px] shrink-0'}`}
              >
                <div className="p-4 border-b border-border bg-sidebar/80 backdrop-blur-xl flex items-center justify-between sticky top-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 text-primary"><Cpu size={18} /></div>
                    <div><h3 className="font-display font-bold text-sm">NetSpectre AI</h3><p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest">Neural Operational</p></div>
                  </div>
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsChatOpen(false)}><X size={18} /></Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                          <div className="max-w-[85%] p-3 rounded-xl text-xs bg-primary text-primary-foreground font-medium rounded-tr-none">{msg.content}</div>
                        ) : (
                          <div className="max-w-[85%] p-3 rounded-xl text-xs bg-secondary/40 border border-border/50 text-foreground font-mono rounded-tl-none whitespace-pre-wrap leading-relaxed">
                            {msg.content.split('\n').map((line: string, li: number) => {
                              const isSocTag = /^\[(SOC|THREAT|ALERT|NETWORK|ATTACKER|STATUS)/.test(line);
                              const hasCritical = /CRITICAL/i.test(line);
                              const hasHigh = /HIGH/i.test(line);
                              const hasMedium = /MEDIUM/i.test(line);
                              return (
                                <span key={li} className={`block ${isSocTag ? 'text-primary font-bold mt-1' : ''} ${hasCritical ? 'text-red-400' : hasHigh ? 'text-amber-400' : hasMedium ? 'text-yellow-300' : ''}`}>
                                  {line}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] p-3 rounded-xl text-xs bg-secondary/40 border border-border/50 font-mono rounded-tl-none flex items-center gap-2 text-primary">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="animate-pulse">Analyzing telemetry...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-4 border-t border-border bg-sidebar/50">
                  <form onSubmit={handleSendMessage} className="relative">
                    <Input data-testid="input-chat" value={input} onChange={(e) => setInput(e.target.value)} placeholder={chatLoading ? "Analyzing..." : "Query AI..."} disabled={chatLoading} className="pr-12 bg-secondary/30 border-input text-xs font-mono h-10 rounded-xl" />
                    <Button data-testid="button-send-chat" type="submit" size="icon" disabled={chatLoading} className="absolute right-1 top-1 h-8 w-8 bg-primary text-primary-foreground">{chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</Button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Button 
        data-testid="button-chat-toggle"
        variant="default" 
        size="icon" 
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary shadow-2xl z-50 shadow-primary/40 border-4 border-background"
        onClick={() => setIsChatOpen(!isChatOpen)}
      >
        {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </Button>

      {showNotifications && <div className="fixed inset-0 z-[9998]" onClick={() => setShowNotifications(false)} />}
      <NotificationDropdown 
        show={showNotifications}
        bellRef={bellRef}
        alerts={recentCriticalAlerts}
        lastSeenAlertTime={lastSeenAlertTime}
        onNavigate={() => { setActiveView("incidents"); setShowNotifications(false); }}
      />
    </div>
  );
}

function NotificationDropdown({ show, bellRef, alerts, lastSeenAlertTime, onNavigate }: {
  show: boolean;
  bellRef: React.RefObject<HTMLButtonElement | null>;
  alerts: SecurityEvent[];
  lastSeenAlertTime: string | null;
  onNavigate: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (show && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, [show, bellRef]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -10 }}
          className="fixed w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          style={{ top: pos.top, right: pos.right, zIndex: 9999 }}
        >
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-display font-bold flex items-center gap-2">
              <Bell size={12} className="text-primary" /> SOC Alerts
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">{alerts.length} active</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground font-mono">
                <Shield size={20} className="mx-auto mb-2 text-emerald-500" />
                No critical alerts
              </div>
            ) : (
              alerts.map((alert) => {
                const isNew = lastSeenAlertTime ? new Date(alert.timestamp) > new Date(lastSeenAlertTime) : false;
                return (
                  <div key={alert.id} className={`p-3 border-b border-border/50 hover:bg-primary/5 cursor-pointer transition-colors ${isNew ? 'bg-primary/5' : ''}`} onClick={onNavigate} data-testid={`notification-${alert.eventId}`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className={alert.severity === 'critical' ? 'text-destructive mt-0.5' : 'text-orange-500 mt-0.5'} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] font-display font-bold truncate">{alert.attackType}</p>
                          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-[9px] font-mono text-muted-foreground">{alert.srcIp} → {alert.dstIp}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/60 mt-1">{new Date(alert.timestamp).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                      </div>
                      <Badge variant="outline" className={`${alert.severity === 'critical' ? 'text-destructive border-destructive/30 bg-destructive/5' : 'text-orange-500 border-orange-500/30 bg-orange-500/5'} text-[7px] px-1`}>{alert.severity}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-2 border-t border-border">
            <Button variant="ghost" className="w-full text-xs text-primary" onClick={onNavigate} data-testid="button-view-all-alerts">View All Incidents</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SecurityHubView({ events, stats, systemStats, threatLevel, threatLabel }: { events: SecurityEvent[]; stats: Stats; systemStats: any; threatLevel: number; threatLabel: string }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between group relative overflow-hidden">
          <div className="space-y-4 z-10">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Threat Level</h3>
            <p className="text-2xl font-display font-bold text-glow" data-testid="text-threat-label">{threatLabel}</p>
            <Badge variant="outline" className={`${threatLevel >= 70 ? 'bg-destructive/10 text-destructive border-destructive/20' : threatLevel >= 40 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'} font-mono text-[9px]`} data-testid="text-threat-badge">
              {threatLevel >= 70 ? "CRITICAL" : threatLevel >= 40 ? "ELEVATED" : "NORMAL"}
            </Badge>
          </div>
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-secondary/50" />
              <motion.circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 40} initial={{ strokeDashoffset: 2 * Math.PI * 40 }} animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - threatLevel/100) }} className="text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" strokeLinecap="round" />
            </svg>
            <span className="absolute text-lg font-display font-bold" data-testid="text-threat-level">{threatLevel}%</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          <StatusPanel label="CPU" value={systemStats.cpu} color="text-primary" />
          <StatusPanel label="NET" value={systemStats.network} color="text-emerald-500" />
          <StatusPanel label="MEM" value={systemStats.memory} color="text-primary" />
          <StatusPanel label="ALERTS" value={stats.alerts} unit="" max={Math.max(stats.alerts, 50)} color="text-destructive" />
        </div>

        <div className="hidden xl:flex bg-card border border-border rounded-xl p-5 flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Detection Rate</h3>
              <p className="text-2xl font-display font-bold mt-1">99.2<span className="text-primary text-lg">%</span></p>
            </div>
            <Zap size={20} className="text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1"><p className="text-[9px] text-muted-foreground font-mono">EVENTS</p><p className="text-xs font-bold font-display" data-testid="text-events-count">{stats.total.toLocaleString()}</p></div>
            <div className="space-y-1"><p className="text-[9px] text-muted-foreground font-mono">CRITICAL</p><p className="text-xs font-bold text-destructive font-display" data-testid="text-critical-count">{stats.critical}</p></div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden relative h-[300px] lg:h-[350px]">
        <div className="absolute top-5 left-5 z-20"><h3 className="text-sm font-display font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-primary animate-spin-slow" /> Global Ingress Vectors</h3></div>
        <img src="/auth-bg.png" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 z-10 pointer-events-none">
          <AttackPoint x="45%" y="35%" /><AttackPoint x="25%" y="40%" active />
          <AttackPoint x="72%" y="28%" /><AttackPoint x="55%" y="55%" active />
          <AttackPoint x="15%" y="30%" />
        </div>
      </div>

      <EventTable events={events} title="Security Event Stream" />
    </>
  );
}

function TrafficMonitorView({ allEvents, stats, systemStats }: { allEvents: SecurityEvent[]; stats: Stats; systemStats: any }) {
  const [filter, setFilter] = useState("");

  const protocolBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    allEvents.forEach(e => {
      map[e.attackType] = (map[e.attackType] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    if (!filter) return allEvents;
    const lf = filter.toLowerCase();
    return allEvents.filter(e => 
      e.srcIp.toLowerCase().includes(lf) || 
      e.dstIp.toLowerCase().includes(lf) || 
      e.attackType.toLowerCase().includes(lf) ||
      e.eventId.toLowerCase().includes(lf)
    );
  }, [allEvents, filter]);

  const normalTraffic = allEvents.filter(e => e.pred === 0).length;
  const maliciousTraffic = allEvents.filter(e => e.pred === 1).length;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <Activity size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold">Traffic Monitor</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Real-time network analysis</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={14} className="text-primary" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Bandwidth</span>
          </div>
          <p className="text-xl font-display font-bold">{Math.round(systemStats.network)}<span className="text-primary text-sm">%</span></p>
          <div className="mt-2 h-1 w-full bg-secondary/50 rounded-full overflow-hidden"><motion.div className="h-full bg-primary rounded-full" animate={{ width: `${systemStats.network}%` }} /></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} className="text-emerald-500" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Total Packets</span>
          </div>
          <p className="text-xl font-display font-bold" data-testid="text-total-packets">{stats.total.toLocaleString()}</p>
          <p className="text-[9px] font-mono text-muted-foreground mt-1">{normalTraffic} normal / {maliciousTraffic} flagged</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-orange-500" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Throughput</span>
          </div>
          <p className="text-xl font-display font-bold">{(systemStats.network * 12.4).toFixed(0)}<span className="text-orange-500 text-xs ml-1">Mbps</span></p>
          <div className="mt-2 h-1 w-full bg-secondary/50 rounded-full overflow-hidden"><motion.div className="h-full bg-orange-500 rounded-full" animate={{ width: `${Math.min(100, systemStats.network * 1.2)}%` }} /></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-destructive" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Blocked</span>
          </div>
          <p className="text-xl font-display font-bold text-destructive" data-testid="text-blocked-count">{maliciousTraffic}</p>
          <p className="text-[9px] font-mono text-muted-foreground mt-1">{stats.total > 0 ? ((maliciousTraffic / stats.total) * 100).toFixed(1) : 0}% of traffic</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-display font-bold mb-4 flex items-center gap-2">
            <Radio size={14} className="text-primary" /> Protocol Breakdown
          </h3>
          <div className="space-y-3">
            {protocolBreakdown.slice(0, 8).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-display font-medium truncate">{type}</span>
                    <span className="text-[9px] font-mono text-muted-foreground ml-2">{count}</span>
                  </div>
                  <div className="h-1 w-full bg-secondary/30 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary/80 rounded-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / Math.max(1, allEvents.length)) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold text-sm">Live Traffic Feed</h3>
            <div className="relative w-48">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)} 
                placeholder="Filter traffic..." 
                className="h-8 text-xs font-mono pl-7 bg-secondary/30 border-input"
                data-testid="input-traffic-filter"
              />
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-hide max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-secondary/20 sticky top-0">
                <TableRow>
                  <TableHead className="font-mono text-[9px] uppercase pl-4 py-2">Event ID</TableHead>
                  <TableHead className="font-mono text-[9px] uppercase py-2">Time</TableHead>
                  <TableHead className="font-mono text-[9px] uppercase py-2">Source</TableHead>
                  <TableHead className="font-mono text-[9px] uppercase py-2">Destination</TableHead>
                  <TableHead className="font-mono text-[9px] uppercase py-2">Type</TableHead>
                  <TableHead className="font-mono text-[9px] uppercase py-2">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono text-xs">No traffic data</TableCell></TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id} className="border-b border-border/30 hover:bg-primary/5 transition-colors" data-testid={`row-traffic-${event.eventId}`}>
                      <TableCell className="font-mono text-[10px] text-primary pl-4">{event.eventId}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">{event.srcIp}</TableCell>
                      <TableCell className="font-mono text-[10px]">{event.dstIp}</TableCell>
                      <TableCell className="text-[10px] font-display">{event.attackType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${event.pred === 1 ? 'text-destructive border-destructive/30 bg-destructive/5' : 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'} font-mono text-[8px] px-1`}>
                          {event.pred === 1 ? 'FLAGGED' : 'NORMAL'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}

function GlobalMapView({ events, allEvents, stats }: { events: SecurityEvent[]; allEvents: SecurityEvent[]; stats: Stats }) {
  const regionData = useMemo(() => {
    const regions = [
      { name: "North America", x: "22%", y: "35%", count: 0 },
      { name: "Europe", x: "48%", y: "28%", count: 0 },
      { name: "East Asia", x: "78%", y: "35%", count: 0 },
      { name: "South America", x: "30%", y: "65%", count: 0 },
      { name: "Africa", x: "50%", y: "55%", count: 0 },
      { name: "Middle East", x: "58%", y: "40%", count: 0 },
      { name: "Southeast Asia", x: "75%", y: "52%", count: 0 },
      { name: "Oceania", x: "82%", y: "70%", count: 0 },
    ];
    allEvents.forEach((_, i) => {
      regions[i % regions.length].count++;
    });
    return regions;
  }, [allEvents]);

  const topSources = useMemo(() => {
    const map: Record<string, number> = {};
    allEvents.forEach(e => { map[e.srcIp] = (map[e.srcIp] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [allEvents]);

  const topTargets = useMemo(() => {
    const map: Record<string, number> = {};
    allEvents.forEach(e => { map[e.dstIp] = (map[e.dstIp] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [allEvents]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <Globe size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold">Global Threat Map</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Worldwide attack origin tracking</p>
          </div>
        </div>
      </motion.div>

      <div className="bg-card border border-border rounded-xl overflow-hidden relative h-[400px] lg:h-[450px]">
        <div className="absolute top-5 left-5 z-20 space-y-2">
          <h3 className="text-sm font-display font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary animate-spin-slow" /> Live Attack Origins
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-[8px] font-mono text-muted-foreground">Active Threat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[8px] font-mono text-muted-foreground">Monitored</span>
            </div>
          </div>
        </div>
        <img src="/auth-bg.png" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 z-10 pointer-events-none">
          {regionData.map((region, i) => (
            <div key={region.name} className="absolute pointer-events-auto" style={{ left: region.x, top: region.y }}>
              <div className="relative group cursor-pointer">
                <motion.div 
                  animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0.6, 0.3] }} 
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity }} 
                  className={`absolute inset-0 rounded-full ${region.count > (allEvents.length / regionData.length) ? 'bg-destructive' : 'bg-primary'}`} 
                  style={{ width: Math.max(8, region.count * 2), height: Math.max(8, region.count * 2), margin: -Math.max(4, region.count) }}
                />
                <div className={`w-2.5 h-2.5 rounded-full border border-background shadow-lg relative z-10 ${region.count > (allEvents.length / regionData.length) ? 'bg-destructive' : 'bg-primary'}`} />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur border border-border rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                  <p className="text-[9px] font-display font-bold">{region.name}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">{region.count} events</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute bottom-4 right-4 z-20 bg-card/80 backdrop-blur border border-border rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[8px] font-mono text-muted-foreground">REGIONS</p><p className="text-sm font-display font-bold">{regionData.filter(r => r.count > 0).length}</p></div>
            <div><p className="text-[8px] font-mono text-muted-foreground">VECTORS</p><p className="text-sm font-display font-bold text-destructive">{events.length}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-display font-bold mb-4 flex items-center gap-2">
            <Eye size={14} className="text-primary" /> Top Attack Sources
          </h3>
          <div className="space-y-2.5">
            {topSources.map(([ip, count], i) => (
              <div key={ip} className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-muted-foreground w-4">{i + 1}</span>
                <span className="text-[11px] font-mono flex-1">{ip}</span>
                <div className="w-20 h-1 bg-secondary/30 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-destructive/80 rounded-full" initial={{ width: 0 }} animate={{ width: `${(count / Math.max(1, topSources[0][1] as number)) * 100}%` }} transition={{ delay: i * 0.05 }} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-display font-bold mb-4 flex items-center gap-2">
            <Server size={14} className="text-primary" /> Top Targets
          </h3>
          <div className="space-y-2.5">
            {topTargets.map(([target, count], i) => (
              <div key={target} className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-muted-foreground w-4">{i + 1}</span>
                <span className="text-[11px] font-mono flex-1">{target}</span>
                <div className="w-20 h-1 bg-secondary/30 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary/80 rounded-full" initial={{ width: 0 }} animate={{ width: `${(count / Math.max(1, topTargets[0][1] as number)) * 100}%` }} transition={{ delay: i * 0.05 }} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function IncidentsView({ events, stats }: { events: SecurityEvent[]; stats: Stats }) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = useMemo(() => {
    let filtered = events;
    if (severityFilter !== "all") {
      filtered = filtered.filter(e => e.severity === severityFilter);
    }
    if (searchQuery) {
      const lq = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.attackType.toLowerCase().includes(lq) ||
        e.srcIp.toLowerCase().includes(lq) ||
        e.dstIp.toLowerCase().includes(lq) ||
        e.eventId.toLowerCase().includes(lq)
      );
    }
    return filtered;
  }, [events, severityFilter, searchQuery]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-destructive/20 p-2 rounded-lg border border-destructive/30">
            <ShieldAlert size={20} className="text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold">Incident Response</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Active threat management</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-destructive/20 rounded-xl p-4 cursor-pointer hover:border-destructive/40 transition-colors" onClick={() => setSeverityFilter(severityFilter === "critical" ? "all" : "critical")}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-destructive" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Critical</span>
          </div>
          <p className="text-2xl font-display font-bold text-destructive" data-testid="text-incidents-critical">{stats.critical}</p>
          <p className="text-[8px] font-mono text-muted-foreground mt-1">Immediate action</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-orange-500/20 rounded-xl p-4 cursor-pointer hover:border-orange-500/40 transition-colors" onClick={() => setSeverityFilter(severityFilter === "high" ? "all" : "high")}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={14} className="text-orange-500" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">High</span>
          </div>
          <p className="text-2xl font-display font-bold text-orange-500" data-testid="text-incidents-high">{stats.high}</p>
          <p className="text-[8px] font-mono text-muted-foreground mt-1">Priority review</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-yellow-500/20 rounded-xl p-4 cursor-pointer hover:border-yellow-500/40 transition-colors" onClick={() => setSeverityFilter(severityFilter === "medium" ? "all" : "medium")}>
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-yellow-500" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Medium</span>
          </div>
          <p className="text-2xl font-display font-bold text-yellow-500" data-testid="text-incidents-medium">{stats.medium}</p>
          <p className="text-[8px] font-mono text-muted-foreground mt-1">Monitoring</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSeverityFilter("all")}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-primary" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Total Active</span>
          </div>
          <p className="text-2xl font-display font-bold" data-testid="text-incidents-total">{stats.alerts}</p>
          <p className="text-[8px] font-mono text-muted-foreground mt-1">All incidents</p>
        </motion.div>
      </div>

      <div className="bg-card border border-border rounded-xl flex flex-col min-w-0">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-base">Active Incidents</h3>
            {severityFilter !== "all" && (
              <Badge variant="outline" className="text-[8px] font-mono px-1.5 cursor-pointer" onClick={() => setSeverityFilter("all")}>
                {severityFilter} <X size={10} className="ml-1" />
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search incidents..." 
                className="h-8 text-xs font-mono pl-7 bg-secondary/30 border-input"
                data-testid="input-incident-search"
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">{filteredEvents.length} results</span>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="font-mono text-[9px] uppercase pl-6 py-3">Event ID</TableHead>
                <TableHead className="w-[160px] font-mono text-[9px] uppercase py-3">Time</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Severity</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Type</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Source</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Target</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Confidence</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-xs">
                    {searchQuery || severityFilter !== "all" ? "No matching incidents" : "No active incidents"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => (
                  <TableRow key={event.id} className="group border-b border-border/50 hover:bg-primary/5 transition-colors" data-testid={`row-incident-${event.eventId}`}>
                    <TableCell className="font-mono text-[10px] text-primary pl-6">{event.eventId}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${
                        event.severity === 'critical' ? 'text-destructive border-destructive/30 bg-destructive/5' : 
                        event.severity === 'high' ? 'text-orange-500 border-orange-500/30 bg-orange-500/5' : 
                        event.severity === 'medium' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' :
                        'text-blue-500 border-blue-500/30 bg-blue-500/5'
                      } font-mono text-[8px] px-1 py-0`}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-[11px] font-display">{event.attackType}</TableCell>
                    <TableCell className="font-mono text-[10px]">{event.srcIp}</TableCell>
                    <TableCell className="font-mono text-[10px]">{event.dstIp}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-secondary/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${event.confidence >= 0.9 ? 'bg-destructive' : event.confidence >= 0.7 ? 'bg-orange-500' : 'bg-primary'}`}
                            style={{ width: `${event.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground">{Math.round(event.confidence * 100)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[9px] text-muted-foreground">{event.srcModel || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

interface SystemHealth {
  uptime: number;
  nodeVersion: string;
  platform: string;
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  database: { totalEvents: number; totalAlerts: number; totalUsers: number };
  version: string;
}

function SystemManagementView({ headers, onDataChange }: { headers: Record<string, string>; onDataChange: () => void }) {
  const { toast } = useToast();
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSystemData = useCallback(async () => {
    try {
      const [usersRes, healthRes] = await Promise.all([
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/system-health", { headers }),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setAdminUsers(data.users || []);
      }
      if (healthRes.ok) {
        const data = await healthRes.json();
        setSystemHealth(data);
      }
    } catch (err) {
      console.error("Failed to fetch system data:", err);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast({ title: "Role updated", description: `User role changed to ${newRole}` });
        fetchSystemData();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        toast({ title: "User deleted", description: `${userName} has been removed` });
        fetchSystemData();
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  const handleClearEvents = async () => {
    if (!confirm("Are you sure you want to clear ALL security events? This action cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/events/clear", {
        method: "POST",
        headers,
      });
      if (res.ok) {
        toast({ title: "Events cleared", description: "All security events have been removed" });
        fetchSystemData();
        onDataChange();
      } else {
        toast({ title: "Error", description: "Failed to clear events", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to clear events", variant: "destructive" });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Settings size={24} className="text-primary animate-spin mx-auto" />
          <p className="text-xs font-mono text-muted-foreground">Loading system data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <Settings size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold">System Management</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Administration & configuration</p>
          </div>
        </div>
      </motion.div>

      {systemHealth && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-primary" />
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Uptime</span>
            </div>
            <p className="text-lg font-display font-bold" data-testid="text-sys-uptime">{formatUptime(systemHealth.uptime)}</p>
            <p className="text-[8px] font-mono text-muted-foreground mt-1">v{systemHealth.version}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={14} className="text-emerald-500" />
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Memory</span>
            </div>
            <p className="text-lg font-display font-bold" data-testid="text-sys-memory">{formatBytes(systemHealth.memory.heapUsed)}</p>
            <p className="text-[8px] font-mono text-muted-foreground mt-1">of {formatBytes(systemHealth.memory.heapTotal)} heap</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={14} className="text-orange-500" />
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Events</span>
            </div>
            <p className="text-lg font-display font-bold" data-testid="text-sys-events">{systemHealth.database.totalEvents.toLocaleString()}</p>
            <p className="text-[8px] font-mono text-muted-foreground mt-1">{systemHealth.database.totalAlerts} alerts</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-primary" />
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Users</span>
            </div>
            <p className="text-lg font-display font-bold" data-testid="text-sys-users">{systemHealth.database.totalUsers}</p>
            <p className="text-[8px] font-mono text-muted-foreground mt-1">{systemHealth.platform}</p>
          </motion.div>
        </div>
      )}

      {systemHealth && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-display font-bold mb-4 flex items-center gap-2">
            <HardDrive size={14} className="text-primary" /> System Resources
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">RSS Memory</span>
                <span className="text-[10px] font-mono font-bold">{formatBytes(systemHealth.memory.rss)}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (systemHealth.memory.rss / (512 * 1024 * 1024)) * 100)}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">Heap Used</span>
                <span className="text-[10px] font-mono font-bold">{formatBytes(systemHealth.memory.heapUsed)}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
                <motion.div className="h-full bg-emerald-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${(systemHealth.memory.heapUsed / systemHealth.memory.heapTotal) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">External</span>
                <span className="text-[10px] font-mono font-bold">{formatBytes(systemHealth.memory.external)}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
                <motion.div className="h-full bg-orange-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (systemHealth.memory.external / (64 * 1024 * 1024)) * 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-[8px] font-mono text-muted-foreground">NODE VERSION</p><p className="text-xs font-mono font-bold">{systemHealth.nodeVersion}</p></div>
            <div><p className="text-[8px] font-mono text-muted-foreground">PLATFORM</p><p className="text-xs font-mono font-bold">{systemHealth.platform}</p></div>
            <div><p className="text-[8px] font-mono text-muted-foreground">APP VERSION</p><p className="text-xs font-mono font-bold">{systemHealth.version}</p></div>
            <div><p className="text-[8px] font-mono text-muted-foreground">UPTIME</p><p className="text-xs font-mono font-bold">{formatUptime(systemHealth.uptime)}</p></div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl flex flex-col min-w-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-bold text-base flex items-center gap-2">
            <UserCog size={16} className="text-primary" /> User Management
          </h3>
          <span className="text-[9px] font-mono text-muted-foreground">{adminUsers.length} users</span>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="font-mono text-[9px] uppercase pl-6 py-3">Name</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Email</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Organization</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Role</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Joined</TableHead>
                <TableHead className="font-mono text-[9px] uppercase py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono text-xs">No users found</TableCell>
                </TableRow>
              ) : (
                adminUsers.map((u) => (
                  <TableRow key={u.id} className="border-b border-border/50 hover:bg-primary/5 transition-colors" data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-display text-[11px] font-bold pl-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        {u.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{u.organization || "—"}</TableCell>
                    <TableCell>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-secondary/30 border border-border rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-primary/50 cursor-pointer"
                        data-testid={`select-role-${u.id}`}
                      >
                        <option value="admin">admin</option>
                        <option value="analyst">analyst</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        data-testid={`button-delete-user-${u.id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-display font-bold mb-4 flex items-center gap-2">
          <Database size={14} className="text-primary" /> Database Operations
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 text-xs font-display"
            onClick={handleClearEvents}
            data-testid="button-clear-events"
          >
            <Trash2 size={14} className="mr-2" /> Clear All Events
          </Button>
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 text-xs font-display"
            onClick={() => { fetchSystemData(); onDataChange(); }}
            data-testid="button-refresh-data"
          >
            <Activity size={14} className="mr-2" /> Refresh Data
          </Button>
        </div>
      </motion.div>
    </>
  );
}

function EventTable({ events, title }: { events: SecurityEvent[]; title: string }) {
  return (
    <div className="bg-card border border-border rounded-xl flex flex-col min-w-0">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-bold text-base">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground">{events.length} alerts</span>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <Table>
          <TableHeader className="bg-secondary/20">
            <TableRow>
              <TableHead className="w-[160px] font-mono text-[9px] uppercase pl-6 py-3">Time</TableHead>
              <TableHead className="font-mono text-[9px] uppercase py-3">Severity</TableHead>
              <TableHead className="font-mono text-[9px] uppercase py-3">Type</TableHead>
              <TableHead className="font-mono text-[9px] uppercase py-3">Source/Dest</TableHead>
              <TableHead className="font-mono text-[9px] uppercase py-3">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono text-xs">
                  No security events detected
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id} className="group border-b border-border/50" data-testid={`row-event-${event.eventId}`}>
                  <TableCell className="font-mono text-[10px] text-muted-foreground pl-6">
                    {new Date(event.timestamp).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${
                      event.severity === 'critical' ? 'text-destructive border-destructive/30 bg-destructive/5' : 
                      event.severity === 'high' ? 'text-orange-500 border-orange-500/30 bg-orange-500/5' : 
                      event.severity === 'medium' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' :
                      'text-blue-500 border-blue-500/30 bg-blue-500/5'
                    } font-mono text-[8px] px-1 py-0`}>
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-[11px] font-display">{event.attackType}</TableCell>
                  <TableCell className="font-mono text-[10px]">
                    <div className="flex flex-col">
                      <span>{event.srcIp}</span>
                      <span className="text-muted-foreground/60 text-[8px]">{event.dstIp}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-secondary/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${event.confidence >= 0.9 ? 'bg-destructive' : event.confidence >= 0.7 ? 'bg-orange-500' : 'bg-primary'}`}
                          style={{ width: `${event.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground">{Math.round(event.confidence * 100)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DataSourcesView({ headers }: { headers: Record<string, string> }) {
  const { toast } = useToast();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    sourceType: "suricata" as string,
    connectionMethod: "http" as string,
    description: "",
    enabled: true,
  });

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/data-sources", { headers });
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (err) {
      console.error("Failed to fetch data sources:", err);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Data source created", description: `API Key: ${data.apiKey}` });
        setRevealedKeys(prev => new Set(prev).add(data.source.id));
        setShowAdd(false);
        setFormData({ name: "", sourceType: "suricata", connectionMethod: "http", description: "", enabled: true });
        fetchSources();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } catch { toast({ title: "Error", description: "Failed to create data source", variant: "destructive" }); }
  };

  const toggleEnabled = async (ds: DataSource) => {
    try {
      await fetch(`/api/data-sources/${ds.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !ds.enabled }),
      });
      fetchSources();
    } catch { toast({ title: "Error", description: "Failed to update", variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/data-sources/${id}`, { method: "DELETE", headers });
      toast({ title: "Deleted", description: "Data source removed" });
      fetchSources();
    } catch { toast({ title: "Error", description: "Failed to delete", variant: "destructive" }); }
  };

  const sourceTypeLabels: Record<string, string> = {
    suricata: "Suricata IDS",
    snort: "Snort IDS",
    firewall: "Firewall",
    custom_api: "Custom API",
  };

  const connectionLabels: Record<string, string> = {
    http: "HTTP Endpoint",
    syslog: "Syslog",
    agent: "Agent",
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-display font-bold" data-testid="text-sources-title">Data Sources</h2>
          <p className="text-xs font-mono text-muted-foreground">External IDS, Firewall & log integrations</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-2 text-xs" data-testid="button-add-source">
          <Zap size={14} /> Add Data Source
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2"><Zap size={14} className="text-primary" /> New Data Source</h3>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Source Name</label>
                  <Input data-testid="input-source-name" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Suricata-Prod-01" className="bg-secondary/30 border-input text-xs font-mono h-9" required />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Source Type</label>
                  <select data-testid="select-source-type" value={formData.sourceType} onChange={(e) => setFormData(p => ({ ...p, sourceType: e.target.value }))} className="w-full bg-secondary/30 border border-input rounded-md text-xs font-mono h-9 px-3 text-foreground">
                    <option value="suricata">Suricata IDS</option>
                    <option value="snort">Snort IDS</option>
                    <option value="firewall">Firewall</option>
                    <option value="custom_api">Custom API</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Connection Method</label>
                  <select data-testid="select-connection-method" value={formData.connectionMethod} onChange={(e) => setFormData(p => ({ ...p, connectionMethod: e.target.value }))} className="w-full bg-secondary/30 border border-input rounded-md text-xs font-mono h-9 px-3 text-foreground">
                    <option value="http">HTTP Endpoint</option>
                    <option value="syslog">Syslog (future)</option>
                    <option value="agent">Agent (future)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">Description (optional)</label>
                  <Input data-testid="input-source-description" value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Brief description..." className="bg-secondary/30 border-input text-xs font-mono h-9" />
                </div>
                <div className="md:col-span-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData(p => ({ ...p, enabled: e.target.checked }))} className="accent-primary" data-testid="checkbox-source-enabled" />
                    <span className="text-xs font-mono text-muted-foreground">Enabled</span>
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowAdd(false)} className="text-xs">Cancel</Button>
                    <Button type="submit" className="text-xs gap-1" data-testid="button-submit-source"><Zap size={12} /> Create Source</Button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Sources</p>
          <p className="text-2xl font-display font-bold text-primary" data-testid="text-total-sources">{sources.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Active</p>
          <p className="text-2xl font-display font-bold text-emerald-500" data-testid="text-active-sources">{sources.filter(s => s.enabled).length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Ingested</p>
          <p className="text-2xl font-display font-bold" data-testid="text-total-ingested">{sources.reduce((s, d) => s + d.eventCount, 0).toLocaleString()}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-sm">Loading...</div>
      ) : sources.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Database size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-display font-bold text-sm mb-1">No Data Sources Configured</p>
          <p className="text-xs text-muted-foreground font-mono mb-4">Add an IDS, Firewall, or API integration to start ingesting events</p>
          <Button onClick={() => setShowAdd(true)} className="text-xs gap-1"><Zap size={12} /> Add First Source</Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sources.map((ds, i) => (
            <motion.div 
              key={ds.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors"
              data-testid={`card-source-${ds.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`p-2.5 rounded-lg border ${ds.enabled ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-secondary/30 border-border text-muted-foreground'}`}>
                    {ds.sourceType === 'firewall' ? <Shield size={18} /> : ds.sourceType === 'custom_api' ? <Server size={18} /> : <Radio size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-display font-bold text-sm truncate">{ds.name}</h4>
                      <Badge variant="outline" className={`text-[8px] px-1.5 ${ds.enabled ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-muted-foreground border-border'}`}>
                        {ds.enabled ? "ACTIVE" : "DISABLED"}
                      </Badge>
                    </div>
                    {ds.description && <p className="text-[10px] text-muted-foreground font-mono mb-2 truncate">{ds.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1"><Radio size={10} /> {sourceTypeLabels[ds.sourceType] || ds.sourceType}</span>
                      <span className="flex items-center gap-1"><Wifi size={10} /> {connectionLabels[ds.connectionMethod] || ds.connectionMethod}</span>
                      <span className="flex items-center gap-1"><Activity size={10} /> {ds.eventCount.toLocaleString()} events</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(ds.createdAt).toLocaleDateString()}</span>
                      {ds.lastEventAt && <span className="flex items-center gap-1"><TrendingUp size={10} /> Last: {new Date(ds.lastEventAt).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">API Key:</span>
                      {revealedKeys.has(ds.id) ? (
                        <code className="text-[9px] font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20 select-all">{(ds as any).apiKeyFull || ds.apiKey}</code>
                      ) : (
                        <button onClick={() => setRevealedKeys(prev => new Set(prev).add(ds.id))} className="text-[9px] font-mono text-primary hover:underline" data-testid={`button-reveal-key-${ds.id}`}>
                          <Eye size={10} className="inline mr-1" />Reveal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleEnabled(ds)} data-testid={`button-toggle-${ds.id}`}>
                    {ds.enabled ? <Eye size={14} className="text-emerald-500" /> : <Eye size={14} className="text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(ds.id)} data-testid={`button-delete-source-${ds.id}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2"><Server size={14} className="text-primary" /> Ingestion API Reference</h3>
        <div className="bg-secondary/20 rounded-lg p-4 font-mono text-[10px] space-y-2 text-muted-foreground">
          <p className="text-primary font-bold">POST /ingest/events</p>
          <p>Authorization: Bearer {"<your_api_key>"}</p>
          <p>Content-Type: application/json</p>
          <div className="mt-2 bg-background/50 rounded p-3 border border-border/50">
            <pre className="text-[9px] whitespace-pre-wrap">{`{
  "timestamp": "2026-01-15T12:00:00Z",
  "src_ip": "192.168.1.45",
  "dst_ip": "10.0.0.1",
  "attack_type": "SQL Injection",
  "confidence": 0.92,
  "pred": 1,
  "src_model": "suricata-v7"
}`}</pre>
          </div>
        </div>
      </div>
    </>
  );
}

function NavItem({ icon, label, active = false, badge, onClick, ...rest }: any) {
  return (
    <button 
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-primary/5 hover:text-foreground border border-transparent"}`}
      onClick={onClick}
      {...rest}
    >
      <span className={active ? "text-primary" : "group-hover:text-primary"}>{icon}</span>
      <span className="text-sm font-medium font-display tracking-tight">{label}</span>
      {badge && parseInt(badge) > 0 && <span className="ml-auto text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">{badge}</span>}
    </button>
  );
}

function StatusPanel({ label, value, unit = "%", max = 100, color }: any) {
  return (
    <div className="bg-card border border-border p-3 rounded-lg flex flex-col justify-between">
      <div className="flex justify-between items-center mb-1"><span className="text-[8px] font-mono text-muted-foreground">{label}</span></div>
      <div className="flex items-baseline gap-1"><span className="text-lg font-display font-bold leading-none">{Math.round(value)}</span><span className="text-[8px] font-mono text-muted-foreground">{unit}</span></div>
      <div className="mt-2 h-0.5 w-full bg-secondary/50 rounded-full overflow-hidden"><motion.div className={`h-full bg-current ${color}`} animate={{ width: `${Math.min(100, (value/max)*100)}%` }} /></div>
    </div>
  );
}

function AttackPoint({ x, y, active = false }: any) {
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className="relative">
        <motion.div animate={{ scale: [1, 2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className={`absolute inset-0 rounded-full ${active ? 'bg-destructive' : 'bg-primary'}`} />
        <div className={`w-1.5 h-1.5 rounded-full border border-background shadow-lg relative z-10 ${active ? 'bg-destructive' : 'bg-primary'}`} />
      </div>
    </div>
  );
}
