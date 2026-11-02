"use client";

import type { Collection } from "../lib/data";
import { Dialog } from "./dialog";

const help = {
  plots: {
    title: "What can I do with plots?",
    fields: "Rename a plot or update its latitude/longitude boundary coordinates. Click a plot in the Overview list to focus it on the map.",
    examples: ["List my plots.", "Rename plot one to North field.", "Delete plot three."],
  },
  missions: {
    title: "What can I do with mission types?",
    fields: "Change the name, mission type, linked camera, flight height, flight speed, and front/side overlap. Heights are in meters (up to 120), speeds in m/s (up to 15), and overlaps in percent (0–95). A mission needs an existing camera.",
    examples: ["Set mission one's flight height to 45 meters.", "Change mission two's speed to two meters per second.", "Delete mission four."],
  },
  cameras: {
    title: "What can I do with camera sensors?",
    fields: "Change the name, image width and height in pixels, focal length in millimeters, and sensor width in millimeters. Before deleting a camera, switch any missions that use it to another camera.",
    examples: ["List my camera sensors.", "Set camera one's focal length to 50 millimeters.", "Rename camera two to Survey RGB."],
  },
};

export function CollectionHelp({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const content = help[collection];
  return <Dialog title={content.title} onClose={onClose}><div className="editor collection-help">
    <section><h3>Add, update, or delete</h3><p>Use the gold <strong>+</strong> button to add a record. Use the pencil button to edit one and select <strong>Save changes</strong>. To delete a record, open its editor, tap the trash button, and confirm.</p></section>
    <section><h3>What you can change</h3><p>{content.fields}</p></section>
    {collection === "plots" && <section><h3>Import boundaries from KML</h3><p>Use <strong>Upload KML</strong> in the card header, or <strong>Upload KML instead</strong> inside Add plot. Every polygon becomes a separate plot, including polygons grouped together in a MultiGeometry. Review the preview and import them all at once. Files with unsupported or invalid polygons are not partially imported.</p></section>}
    <section><h3>Try your voice</h3><p>Tap the microphone on Overview to list records, add a fully specified record, or update or delete one. Use a record’s name or its position in the list, such as “plot one.” Review the result and tap <strong>Apply changes</strong> to save it.</p><ul className="help-examples">{content.examples.map(example => <li key={example}>“{example}”</li>)}</ul></section>
    <p className="muted small">Edits only change your browser’s copy. Sample flight records keep their original details. These controls do not operate a real aircraft.</p>
    <div className="dialog-actions"><button className="button" onClick={onClose}>Got it</button></div>
  </div></Dialog>;
}
