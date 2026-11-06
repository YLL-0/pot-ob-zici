import { diagnozaTras, opisShrambe } from "@/lib/traseDiagnoza";

console.log(`[trase] shramba: ${opisShrambe()}`);
for (const p of diagnozaTras()) console.warn(`[trase] ${p.koda}: ${p.sporocilo}`);
