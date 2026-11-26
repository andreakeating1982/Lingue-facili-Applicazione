/** Riduce la foto SOLO per l'invio all'IA. Il ritaglio PNG viene calcolato
 *  sulla foto orientata e normalizzata, non sulla visualizzazione. */
export async function photoAsDataUrl(file: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Foto non leggibile"));
    });
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Elaborazione foto non disponibile");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL("image/jpeg", 0.84);
    if (result.length > 3_400_000) result = canvas.toDataURL("image/jpeg", 0.66);
    if (result.length > 3_400_000) throw new Error("Foto troppo grande");
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

