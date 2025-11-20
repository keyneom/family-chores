export async function genSalt(): Promise<string> {
  const arr = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...Array.from(arr)));
}

export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const saltStr = atob(saltBase64);
  const pinBytes = new TextEncoder().encode(pin + saltStr);
  const digest = await crypto.subtle.digest('SHA-256', pinBytes);
  // convert to base64
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
