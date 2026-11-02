"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Mic, Send, Square, X } from "lucide-react";
import { applyActions, describeAction, proposalSchema, type Proposal } from "../lib/actions";
import { useDemo } from "../lib/store";

type Phase = "idle" | "starting" | "recording" | "transcribing" | "thinking";
type Turn = { role: "user" | "assistant"; content: string };

export function VoiceCommand() {
  const { state, ready, update } = useDemo();
  const stateRef = useRef(state);
  stateRef.current = state;
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [applied, setApplied] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<Turn[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitAudio = useRef(true);
  const alive = useRef(true);
  const proposalBase = useRef("");
  const recordingEpoch = useRef(0);
  const busy = phase !== "idle";

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    if (deadline.current) clearTimeout(deadline.current);
    timer.current = null;
    deadline.current = null;
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      recordingEpoch.current += 1;
      submitAudio.current = false;
      controller.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      releaseMic();
    };
  }, [releaseMic]);

  async function api(path: string, init: RequestInit) {
    controller.current = new AbortController();
    const response = await fetch(path, { ...init, headers: { ...init.headers, "x-ved-scout-demo": "1" }, signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(30000)]) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The demo service is unavailable. Please try again.");
    return data;
  }

  async function sendCommand(message: string) {
    if (!message.trim()) return;
    const snapshot = stateRef.current;
    setPhase("thinking"); setError(""); setProposal(null); setApplied(false);
    try {
      const result = await api("/api/demo/assistant/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.trim(), state: snapshot, history: history.slice(-6) }) });
      const parsed = proposalSchema.parse(result);
      applyActions(snapshot, parsed.actions);
      if (!alive.current) return;
      proposalBase.current = JSON.stringify(snapshot);
      setProposal(parsed);
      setHistory((previous) => [...previous, { role: "user" as const, content: message.trim() }, { role: "assistant" as const, content: parsed.message }].slice(-6));
    } catch (caught) {
      if (alive.current) setError(caught instanceof Error ? caught.message : "The command could not be interpreted. Try again.");
    } finally { if (alive.current) setPhase("idle"); }
  }

  async function transcribe(blob: Blob) {
    if (!alive.current) return;
    setPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, blob.type.includes("mp4") ? "command.mp4" : "command.webm");
      const result = await api("/api/demo/transcribe/", { method: "POST", body: form });
      if (!alive.current) return;
      const text = typeof result.text === "string" ? result.text.trim() : "";
      if (!text) { setError("No speech was detected. Tap the mic and try again, or type a command."); setPhase("idle"); return; }
      setHeard(text); setInput(text);
      await sendCommand(text);
    } catch (caught) {
      if (alive.current) { setError(caught instanceof Error ? caught.message : "The recording could not be transcribed."); setPhase("idle"); }
    }
  }

  async function startRecording() {
    if (busy || !ready) return;
    setError(""); setHeard(""); setProposal(null); setApplied(false); setSeconds(0); setPhase("starting");
    const epoch = ++recordingEpoch.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone recording is unavailable in this browser. Type a command below instead.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!alive.current || epoch !== recordingEpoch.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      let bytes = 0;
      submitAudio.current = true;
      recording.ondataavailable = (event) => {
        if (event.data.size > 0) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes > 2000000 && recording.state === "recording") {
          submitAudio.current = false; recording.stop();
          if (alive.current) setError("That recording is too large. Try a shorter command.");
        }
      };
      recording.onstop = () => {
        recorder.current = null; releaseMic();
        const blob = new Blob(chunks, { type: recording.mimeType || mime || "audio/webm" });
        chunks.length = 0;
        if (submitAudio.current && alive.current && blob.size > 0) void transcribe(blob);
        else if (alive.current) setPhase("idle");
      };
      recording.onerror = () => {
        submitAudio.current = false; releaseMic();
        if (alive.current) { setPhase("idle"); setError("Recording stopped unexpectedly. Try again or type a command."); }
      };
      recorder.current = recording; recording.start(250); setPhase("recording");
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      deadline.current = setTimeout(() => { if (recording.state === "recording") recording.stop(); }, 30000);
    } catch (caught) {
      releaseMic();
      if (alive.current) {
        setPhase("idle");
        setError(caught instanceof DOMException && caught.name === "NotAllowedError" ? "Microphone access was denied. Allow it in your browser’s site settings, or type a command below." : caught instanceof Error ? caught.message : "The microphone could not start.");
      }
    }
  }

  function stopRecording(cancel = false) {
    submitAudio.current = !cancel;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function apply() {
    if (!proposal || !proposal.actions.length) return;
    try {
      update((current) => {
        if (JSON.stringify(current) !== proposalBase.current) throw new Error("The demo data changed while this command was pending. Send the command again to use the latest values.");
        return applyActions(current, proposal.actions);
      });
      setApplied(true);
      setHistory((previous) => [...previous, { role: "assistant" as const, content: "The visitor applied the proposed changes to their browser copy." }].slice(-6));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Those changes could not be applied."); }
  }

  function submit(event: FormEvent) { event.preventDefault(); if (!busy && ready) void sendCommand(input); }

  return <section className="voice-command" aria-label="Voice commands">
    <div className="voice-brand">VED-SCOUT</div>
    <div className={`mic-row ${phase === "recording" ? "is-recording" : ""}`}>
      <div className="waveform" aria-hidden="true">{Array.from({ length: 60 }, (_, index) => <i key={index} style={{ height: `${4 + Math.round(Math.abs(Math.sin(index * 2.7)) * 20)}px`, animationDelay: `${index * .04}s` }} />)}</div>
      <button id="demo-microphone" type="button" className={`mic-button ${phase === "recording" ? "recording" : ""}`} disabled={!ready || (busy && phase !== "recording")}
        aria-label={phase === "recording" ? "Stop recording and send command" : "Record a voice command"} aria-pressed={phase === "recording"} onClick={() => phase === "recording" ? stopRecording() : void startRecording()}>
        {phase === "recording" ? <Square size={24} fill="currentColor" /> : busy ? <LoaderCircle size={26} className="spin" /> : <Mic size={28} />}
      </button>
      <div className="waveform right" aria-hidden="true">{Array.from({ length: 60 }, (_, index) => <i key={index} style={{ height: `${4 + Math.round(Math.abs(Math.sin(index * 2.7)) * 20)}px`, animationDelay: `${index * .04}s` }} />)}</div>
    </div>
    <button className="voice-caption" disabled={busy || !ready} onClick={() => void startRecording()}>Give your voice commands by tapping here.</button>
    {busy && <p className="voice-status" role="status">{phase === "recording" ? <>Listening · {seconds}s / 30s <button className="text-button" onClick={() => stopRecording(true)}>Cancel recording</button></> : phase === "transcribing" ? "Transcribing with Whisper 1…" : phase === "thinking" ? "Interpreting your command…" : "Waiting for microphone permission…"}</p>}
    <details className="typed-command"><summary>Or type a command</summary><form className="command-form" onSubmit={submit}><label className="sr-only" htmlFor="demo-command">Type a voice command</label><input id="demo-command" value={input} maxLength={1500} disabled={busy || !ready} onChange={(event) => setInput(event.target.value)} placeholder="Rename plot one to North field" autoComplete="off" /><button className="icon-button" type="submit" aria-label="Send command" disabled={busy || !input.trim() || !ready}><Send size={18} /></button></form></details>
    <p className="voice-privacy">Voice and text commands are processed by OpenAI. <a href="/about/#demo-data">Data details</a></p>
    {heard && <p className="heard"><span>Heard</span>“{heard}”</p>}
    {error && <p className="command-error" role="alert">{error}</p>}
    {proposal && <div className="command-result" aria-live="polite"><p>{proposal.message}</p>
      {proposal.actions.length > 0 && <><ul>{proposal.actions.map((action, index) => <li key={index}>{describeAction(action, state)}</li>)}</ul><div className="proposal-actions">{applied ? <span className="applied"><Check size={16} />Saved to your browser</span> : <><button className="button" onClick={apply} disabled={busy}><Check size={16} />Apply changes</button><button className="button secondary" onClick={() => { setProposal(null); setHistory((previous) => [...previous, { role: "assistant" as const, content: "The visitor discarded the proposal; no changes were saved." }].slice(-6)); }}><X size={16} />Discard</button></>}</div></>}
    </div>}
  </section>;
}
