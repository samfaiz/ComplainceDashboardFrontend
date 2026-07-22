"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, LayoutDashboard, Plug, SlidersHorizontal } from "lucide-react";

/**
 * Left-hand panel for the split-screen login — an auto-playing carousel that
 * cross-fades through real screenshots of the (dark) product, framed as browser
 * windows and centered on the light panel, with a headline and trust badges.
 * Hidden on small screens. Screenshots live in /public/showcase (16:10).
 */

function BrowserCard({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-900/10 bg-[#0b1120] shadow-2xl shadow-indigo-950/25">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-[11px] text-slate-400">{url}</span>
      </div>
      {children}
    </div>
  );
}

const SLIDES = [
  {
    key: "dashboard", icon: LayoutDashboard, label: "Unified dashboard",
    url: "console.edrcompliance.io/overview", img: "/showcase/dashboard.png",
    title: "Every endpoint, one pane of glass.",
    desc: "Totals, health, compliance % and trends across all your security tools — live and historical.",
  },
  {
    key: "sources", icon: Plug, label: "Vendor integrations",
    url: "console.edrcompliance.io/sources/new", img: "/showcase/sources.png",
    title: "Connect any security API.",
    desc: "CrowdStrike, Defender, SentinelOne, Wazuh, Cortex, Elastic and more — normalized into one schema.",
  },
  {
    key: "builder", icon: SlidersHorizontal, label: "Dashboard builder",
    url: "console.edrcompliance.io/builder", img: "/showcase/builder.png",
    title: "Build the view you need.",
    desc: "Drag, resize and configure widgets — or write custom rules for exactly the endpoints you care about.",
  },
];

export function LoginShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#edeffb] p-10">
      {/* brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">EDR Compliance</div>
          <div className="text-xs text-slate-500">Endpoint security posture, unified</div>
        </div>
      </div>

      {/* carousel — centered in the panel */}
      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-xl">
          {/* stage: browser mockups stacked in one grid cell, cross-fading */}
          <div className="grid">
            {SLIDES.map((s, i) => (
              <div
                key={s.key}
                className={`col-start-1 row-start-1 transition-opacity duration-700 ease-in-out ${
                  i === active ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <BrowserCard url={s.url}>
                  <div className="relative aspect-16/10 w-full bg-[#0b1120]">
                    <Image
                      src={s.img}
                      alt={`${s.label} — EDR Compliance Dashboard`}
                      fill
                      sizes="640px"
                      className="object-cover object-top"
                      priority={i === 0}
                    />
                  </div>
                </BrowserCard>
              </div>
            ))}
          </div>

          {/* caption */}
          <div className="mt-7 grid">
            {SLIDES.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className={`col-start-1 row-start-1 transition-opacity duration-700 ease-in-out ${
                    i === active ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    <Icon className="h-4 w-4" /> {s.label}
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{s.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              );
            })}
          </div>

          {/* dots */}
          <div className="mt-6 flex gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Show ${s.label}`}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-8 bg-indigo-600" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* trust badges */}
      <div className="flex flex-wrap gap-2">
        {["SOC 2 Type II", "ISO 27001", "99.99% Uptime"].map((b) => (
          <span key={b} className="rounded-md border border-slate-200 bg-white/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
