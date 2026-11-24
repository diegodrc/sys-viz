// Clipboard with fallback (SPEC §2): navigator.clipboard first, then a hidden textarea +
// document.execCommand('copy') when the API is missing or rejects (e.g. file:// in some browsers).

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    // execCommand is deprecated but is the only fallback where the async API is unavailable
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  return legacyCopy(text);
}
