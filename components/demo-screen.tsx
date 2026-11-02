"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera, Check, ChevronLeft, ChevronRight, Crosshair, History, Info, LayoutDashboard, MapPin, Mic, RotateCcw, X } from "lucide-react";
import { useDemo } from "../lib/store";
import { CollectionPanel } from "./collections";
import { FlightHistory } from "./flight-history";
import { VoiceCommand } from "./voice-command";
import { Dialog } from "./dialog";
import { About } from "./about";

const FieldMap = dynamic(() => import("./field-map"), { ssr: false, loading: () => <div className="map-loading">Loading field map…</div> });
const nav = [
  { slug: "overview", label: "Overview", icon: LayoutDashboard },
  { slug: "your-plots", label: "Your plots", icon: MapPin },
  { slug: "camera-sensors", label: "Camera sensors", icon: Camera },
  { slug: "mission-types", label: "Mission types", icon: Crosshair },
  { slug: "flight-history", label: "Flight history", icon: History },
  { slug: "about", label: "About", icon: Info },
];

export function DemoScreen({ section }: { section: string }) {
  const { ready, storageWarning, reset } = useDemo();
  const [expanded, setExpanded] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [focusedPlot, setFocusedPlot] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState(false);
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    {expanded && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setExpanded(false)} />}
    <aside className={`sidebar ${expanded ? "expanded" : ""}`} aria-label="Main navigation"><div className="sidebar-top">{expanded && <Link href="/overview/" className="sidebar-wordmark" onClick={() => setExpanded(false)}>Ved Scout</Link>}<button className="icon-button" aria-label={expanded ? "Collapse navigation" : "Expand navigation"} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button></div>
      <Link className="sidebar-voice" href="/overview/#demo-microphone" aria-label="Voice command" title="Voice command" onClick={(event) => { setExpanded(false); if (section === "overview") { event.preventDefault(); const microphone = document.getElementById("demo-microphone"); microphone?.scrollIntoView({ block: "center" }); microphone?.click(); } }}><Mic size={22} />{expanded && <span>Voice Command</span>}</Link>
      <nav>{nav.map(({ slug, label, icon: Icon }) => <Link key={slug} href={`/${slug}/`} aria-label={label} aria-current={section === slug ? "page" : undefined} title={label} onClick={() => setExpanded(false)}><Icon size={20} />{expanded && <span>{label}</span>}</Link>)}</nav>
    </aside>
    <div className="app-body">
      <main id="main" className="main-content">
        {storageWarning && <p className="storage-warning" role="alert">{storageWarning}</p>}
        {resetMessage && <p className="reset-message" role="status"><Check size={15} />Sample data restored.<button className="icon-button" aria-label="Dismiss reset message" onClick={() => setResetMessage(false)}><X size={15} /></button></p>}
        {section === "overview" && <><VoiceCommand /><div className="dashboard-top"><section className="panel map-panel" aria-label="Map overview"><FieldMap focusedPlotId={focusedPlot} /></section><CollectionPanel collection="plots" onFocus={setFocusedPlot} /></div><div className="dashboard-bottom"><FlightHistory /><CollectionPanel collection="missions" /><CollectionPanel collection="cameras" /></div></>}
        {section === "your-plots" && <><PageHeading title="Your plots" description="Give these fields a name, edit their boundaries, or add a new scouting area." /><div className="dashboard-top"><section className="panel map-panel"><FieldMap focusedPlotId={focusedPlot} /></section><CollectionPanel collection="plots" onFocus={setFocusedPlot} /></div><VoiceLink /></>}
        {section === "mission-types" && <><PageHeading title="Mission types" description="Explore mapping, surface modelling, and point-inspection configurations. Set height, speed, overlap, and the linked camera." /><div className="standalone-panel"><CollectionPanel collection="missions" /></div><VoiceLink /></>}
        {section === "camera-sensors" && <><PageHeading title="Camera sensors" description="Configure image dimensions, focal length, and sensor width for different scouting cameras." /><div className="standalone-panel"><CollectionPanel collection="cameras" /></div><VoiceLink /></>}
        {section === "flight-history" && <><PageHeading title="Flight history" description="Open a sample record to see its flight time, speed, mission configuration, and original camera details." /><div className="standalone-panel"><FlightHistory /></div></>}
        {section === "about" && <About />}
        <footer className="workspace-footer"><div><button className="reset-button" onClick={() => setResetOpen(true)} disabled={!ready}><RotateCcw size={14} />Reset demo</button><Link href="/about/">About <Info size={14} /></Link></div></footer>
      </main>
    </div>
    {resetOpen && <Dialog title="Restore the demo samples?" onClose={() => setResetOpen(false)}><div className="editor"><p>This replaces the plots, missions, cameras, and flight history saved in this browser with the original sample data.</p><div className="dialog-actions"><button className="button secondary" onClick={() => setResetOpen(false)}>Keep my changes</button><button className="button" onClick={() => { reset(); setFocusedPlot(null); setResetMessage(true); setResetOpen(false); }}><RotateCcw size={15} />Reset demo</button></div></div></Dialog>}
  </div>;
}

function PageHeading({ title, description }: { title: string; description: string }) { return <div className="page-heading"><p className="eyebrow">Your demo workspace</p><h1>{title}</h1><p>{description}</p></div>; }
function VoiceLink() { return <p className="voice-link">Prefer to say it? <Link href="/overview/#demo-microphone">Give your voice commands using the microphone on Overview.</Link></p>; }
