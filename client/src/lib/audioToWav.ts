/** Conversione di sicurezza per i browser che registrano solo OGG. Non usa
 *  servizi esterni: decodifica nel browser e ricampiona a 16 kHz mono. */
export async function audioToWav(blob: Blob): Promise<Blob> {
  const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor || typeof OfflineAudioContext === "undefined") throw new Error("Conversione audio non disponibile");
  const context = new AudioCtor();
  try {
    const original = await context.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const frameCount = Math.max(1, Math.ceil(Math.min(original.duration, 60) * rate));
    const offline = new OfflineAudioContext(1, frameCount, rate);
    const source = offline.createBufferSource();
    source.buffer = original;
    source.connect(offline.destination);
    source.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    const result = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(result);
    const str = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    str(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
    str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
      const sample = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    return new Blob([result], { type: "audio/wav" });
  } finally { await context.close().catch(() => {}); }
}

