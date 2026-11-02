import { ArrowUpRight, Github, GraduationCap, Linkedin } from "lucide-react";

export function About() {
  return <div className="about-content">
    <section className="about-intro"><p className="eyebrow">The project</p><h1>Voice, fields, and flight.</h1><p>VED-SCOUT explores how spoken instructions can help people configure drone missions for agricultural weed scouting. Try the interface here with your own browser copy of the sample plots, missions, and camera sensors.</p></section>
    <div className="about-grid">
      <section className="panel about-card"><div className="about-monogram" aria-hidden="true">VA</div><p className="eyebrow">Researcher & developer</p><h2>Varun Aggarwal</h2><p className="about-role"><GraduationCap size={18} />PhD Candidate · Electrical and Computer Engineering</p><p>Varun is a PhD candidate in the Elmore School of Electrical and Computer Engineering at Purdue University. His research examines how large language models and unmanned aerial vehicles can support weed detection and management in agricultural fields.</p><p className="muted">Outside research, he enjoys hiking and cooking.</p>
        <div className="about-links"><a href="https://github.com/Salazar-Prime" target="_blank" rel="noopener noreferrer"><Github size={17} />GitHub<ArrowUpRight size={14} /></a><a href="https://www.linkedin.com/in/aggarwal-v/" target="_blank" rel="noopener noreferrer"><Linkedin size={17} />LinkedIn<ArrowUpRight size={14} /></a></div>
      </section>
    </div>
    <section id="demo-data" className="panel about-card">
      <h2>How to use and data privacy</h2>
      <p>Plots, mission types, camera sensors, and sample flight history are stored in this browser’s local storage. Your edits do not change another visitor’s copy. Use <strong>Reset demo</strong> to restore the examples, or clear this site’s browser data to remove your saved copy. This demo cannot connect to or control an aircraft.</p>
      <p>When you tap the microphone, your browser asks for microphone access. On submission, the recording is sent through the demo server to OpenAI for transcription with Whisper 1. Text commands, recent conversation context, and the demo configuration needed to interpret them are also sent to OpenAI. The demo does not write these requests to a database or save recordings; transcripts and replies remain in this tab until you navigate away or reload. OpenAI’s processing is covered by its <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener noreferrer">API data controls</a>.</p>
      <p className="muted small">The map loads tiles from OpenStreetMap, which receives the map-tile requests. Vercel hosts the site and may retain normal request/security logs. No application analytics or third-party tracking scripts are included. Browser-local data is not encrypted and is accessible to someone using the same browser profile; use sample information here.</p>
      <div className="about-links"><a href="https://github.com/Salazar-Prime/ved-scout-public" target="_blank" rel="noopener noreferrer"><Github size={17} />Demo source<ArrowUpRight size={14} /></a></div>
    </section>
  </div>;
}
