/** Print only the authorized card already rendered on screen, with both faces visible. */
export async function printMemberCard(card: HTMLElement, name: string) {
  const frame = document.createElement("iframe");
  frame.title = "Member card print preview";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:816px;height:0;border:0;bottom:0;left:-10000px;";
  document.body.append(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!doc || !win) throw new Error("Print preview unavailable");
    doc.title = `${name} - Member Card`;
    doc.documentElement.className = document.documentElement.className;
    doc.documentElement.lang = document.documentElement.lang;
    doc.body.className = document.body.className;
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(source => {
      const copy = source.cloneNode(true) as HTMLElement;
      const ready = source.tagName === "LINK" ? new Promise<void>((resolve, reject) => {
        copy.onload = () => resolve();
        copy.onerror = () => reject(new Error("Print stylesheet unavailable"));
      }) : Promise.resolve();
      doc.head.append(copy);
      return ready;
    });
    const style = doc.createElement("style");
    style.textContent = `
      @page { size: portrait; margin: 12mm; }
      html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      [data-member-card-sides] {
        display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 24px !important; width: ${card.offsetWidth * 2 + 24}px !important; max-width: none !important;
        margin: 0 auto !important; transform: none !important; transition: none !important;
        transform-style: flat !important; break-inside: avoid; page-break-inside: avoid;
      }
      [data-member-card-side] {
        grid-column: auto !important; grid-row: auto !important; min-width: 0;
        transform: none !important; backface-visibility: visible !important;
        box-shadow: none !important; break-inside: avoid; page-break-inside: avoid;
      }
      [data-member-card-side] img { print-color-adjust: exact; }
      [data-member-card-side] svg { max-width: 100%; }
    `;
    doc.head.append(style);
    doc.body.append(card.cloneNode(true));
    await Promise.race([
      (async () => {
        await Promise.all(sheets);
        doc.body.getBoundingClientRect();
        await doc.fonts.ready;
        await Promise.all([...doc.images].map(image => image.decode().catch(() => undefined)));
      })(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Print preparation timed out")), 15000); }),
    ]);
    // Scale the entire layout, including type, images and QR, rather than reflowing it.
    // CSS uses 96 pixels per inch: each face is approximately four inches tall.
    const printedCard = doc.querySelector<HTMLElement>("[data-member-card-sides]")!;
    printedCard.style.zoom = String(384 / printedCard.getBoundingClientRect().height);
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
    win.focus();
    win.print();
  } catch (error) {
    frame.remove();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
