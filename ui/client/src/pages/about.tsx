import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Cpu, Globe, Zap, Database, Activity, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

interface AboutInfo {
  name: string;
  tagline: string;
  description: string;
  status: string;
  developer: string;
  features: string[];
}

export default function AboutPage() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/about")
      .then((res) => res.json())
      .then(setInfo)
      .catch(console.error);
  }, []);

  const handleExit = () => {
    logout();
    navigate("/auth/login");
  };

  const featureIcons = [Activity, Cpu, Shield, Database, Globe];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground mb-6" data-testid="link-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="text-center space-y-4 mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-display font-bold tracking-tight">
              {info?.name || "NetSpectre"} <span className="text-primary">AI</span>
            </h1>
            <p className="text-lg text-primary font-mono tracking-wider uppercase">
              {info?.tagline || "AI-Powered SOC / IDS Platform"}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-8">
            <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-description">
              {info?.description || "Loading..."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-8">
            <h2 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Key Capabilities
            </h2>
            <div className="grid gap-4">
              {(info?.features || []).map((feature, i) => {
                const Icon = featureIcons[i % featureIcons.length];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-secondary/20 border border-border/50"
                    data-testid={`text-feature-${i}`}
                  >
                    <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{feature}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Status</p>
              <p className="font-display font-bold text-primary" data-testid="text-status">{info?.status || "Loading..."}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Developer</p>
              <p className="font-display font-bold" data-testid="text-developer">{info?.developer || "Loading..."}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}