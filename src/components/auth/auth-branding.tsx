"use client";
import NextImage from "next/image";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { ShieldCheck, Zap, HardDrive } from "lucide-react";

export function AuthBranding() {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#09090b] text-white relative overflow-hidden text-center selection:bg-blue-500/30">
      {/* WebGL Shader Animation */}
      <ShaderAnimation />

      {/* Modern Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_100%)] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none z-0 mix-blend-overlay"></div>

      {/* Glassmorphic Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-xl px-12 animate-in fade-in zoom-in-95 duration-1000">
        {/* Floating Logo Card */}
        <div className="relative mb-10 group">
          {/* Animated Glow Behind Logo */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-full blur-2xl group-hover:blur-3xl group-hover:opacity-75 transition-all duration-700 opacity-50 pointer-events-none"></div>
          
          <div className="relative p-6 rounded-3xl bg-white/5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl ring-1 ring-white/10 transform transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
            <NextImage 
              src="/logo.webp" 
              alt="CloudVault Logo" 
              width={80} 
              height={80} 
              priority 
              className="drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-transform duration-500 group-hover:rotate-3" 
            />
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 drop-shadow-sm leading-tight">
          CloudVault
        </h2>
        
        <p className="text-zinc-400 text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto drop-shadow-sm">
          The sanctuary for your digital life.
          <br className="hidden md:block" />
          <span className="text-zinc-500 font-normal mt-2 block text-base">Secure, decentralized, and blazingly fast.</span>
        </p>
        
        {/* Feature Badges */}
        <div className="mt-16 grid grid-cols-3 gap-8 w-full max-w-md">
          <div className="flex flex-col items-center gap-4 group cursor-default">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-md shadow-inner transition-all duration-300 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 group-hover:-translate-y-1">
              <ShieldCheck className="w-6 h-6 text-zinc-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase group-hover:text-zinc-300 transition-colors">E2E Secure</span>
          </div>
          
          <div className="flex flex-col items-center gap-4 group cursor-default relative">
            {/* Divider lines via pseudo-elements to avoid extra divs */}
            <div className="absolute top-7 -left-4 w-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <div className="absolute top-7 -right-4 w-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-md shadow-inner transition-all duration-300 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 group-hover:-translate-y-1">
              <Zap className="w-6 h-6 text-zinc-400 group-hover:text-amber-400 transition-colors" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase group-hover:text-zinc-300 transition-colors">Ultra Fast</span>
          </div>
          
          <div className="flex flex-col items-center gap-4 group cursor-default">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900/50 border border-white/5 backdrop-blur-md shadow-inner transition-all duration-300 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 group-hover:-translate-y-1">
              <HardDrive className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase group-hover:text-zinc-300 transition-colors">Unlimited Storage</span>
          </div>
        </div>
      </div>
    </div>
  );
}