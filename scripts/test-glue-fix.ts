/** Prova rapida del riparatore di parole incollate (shared/exercise.ts). */
import { repairGluedSegments } from "../shared/exercise";

const casi: Array<[string, { t: string; v?: string }[]]> = [
  ["My+name", [{ t: "subject", v: "My" }, { t: "text", v: "name" }, { t: "blank" }, { t: "text", v: "Julia." }]],
  ["Am+I", [{ t: "text", v: "Am" }, { t: "subject", v: "I" }, { t: "blank" }, { t: "text", v: "only one that thinks he's lying?" }]],
  ["già corretto", [{ t: "subject", v: "She" }, { t: "text", v: " speak French." }]],
  ["punteggiatura", [{ t: "subject", v: "John" }, { t: "text", v: ", and Peter, has got a dog." }]],
];

for (const [nome, segs] of casi) {
  const out = repairGluedSegments(segs).map((s) => (s.v === undefined ? "␣␣␣" : s.v)).join("|");
  console.log(`${nome} → ${out}`);
}
