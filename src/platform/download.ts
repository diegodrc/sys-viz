// Browser download via Blob + object URL; works under file:// too (SPEC §6.3).
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // revoke on the next tick so the browser has started the download
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
