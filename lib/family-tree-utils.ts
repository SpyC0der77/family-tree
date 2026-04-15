import { toPng } from "html-to-image";

export async function downloadFamilyTreePng(
  viewportElement: HTMLElement,
  filename = "family-tree.png",
): Promise<void> {
  const dataUrl = await toPng(viewportElement, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
