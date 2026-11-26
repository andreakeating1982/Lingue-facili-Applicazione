/* Test manuale sintetico; richiede server IA configurato e ImageMagick:
   convert -background white scripts/test-photo-source.svg /tmp/lingue-photo-test.png
   pnpm exec tsx scripts/test-photo-ai.ts
   Non usa né salva foto di studenti. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { readExercisePhoto } from "../server/aiAssist";
const image = await readFile("/tmp/lingue-photo-test.png");
const start = Date.now();
const result = await readExercisePhoto(`data:image/png;base64,${image.toString("base64")}`, "es");
console.log(`OCR IA ${(Date.now()-start)/1000}s:`);
console.log(result);
if (!/Madrid/i.test(result) || !/manzana/i.test(result)) throw new Error("L'OCR non ha letto le frasi principali");

