import React from "react";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-background">
      {/* Left Panel: Branding & Visuals */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-sidebar border-r border-border overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0 opacity-40">
           <img 
            src="/auth-bg.png" 
            alt="Security Network" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        </div>

        {/* Logo Area */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20 backdrop-blur-sm">
            <img src="/logo.png" alt="NetSpectre Logo" className="w-10 h-10 object-contain" />
          </div>
          <span className="text-2xl font-display font-bold tracking-wide text-foreground">
            NetSpectre <span className="text-primary">AI</span>
          </span>
        </div>

        {/* Content Area */}
        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl font-display font-bold mb-4 text-glow leading-tight">
              Advanced Threat Intelligence Platform
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Secure your infrastructure with AI-driven anomaly detection and real-time response capabilities.
              Trusted by enterprise SOC teams worldwide.
            </p>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>SECURE CONNECTION ENCRYPTED</span>
          </div>
          <span>v2.4.0-stable</span>
        </div>
      </div>

      {/* Right Panel: Form */}
      <div className="relative flex flex-col justify-center items-center p-6 lg:p-12">
         {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
           <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <img src="/logo.png" alt="NetSpectre Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-xl font-display font-bold text-foreground">
            NetSpectre <span className="text-primary">AI</span>
          </span>
        </div>

        <motion.div 
          className="w-full max-w-md space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          <div className="pt-6 text-center text-xs text-muted-foreground">
            &copy; 2024 NetSpectre Security Inc. All rights reserved.
            <br />
            Protected by reCAPTCHA and Subject to Privacy Policy.
          </div>
        </motion.div>
      </div>
    </div>
  );
}