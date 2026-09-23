import { Capacitor, registerPlugin } from '@capacitor/core';

interface RemoteFileOptions {
  url: string;
  name: string;
  mimeType?: string;
}

interface NativeFilesBridge {
  saveRemote(options: RemoteFileOptions): Promise<void>;
  openRemote(options: RemoteFileOptions): Promise<void>;
  shareRemote(options: RemoteFileOptions): Promise<void>;
  saveBase64(options: { base64: string; name: string; mimeType: string }): Promise<void>;
  shareText(options: { text: string; title?: string }): Promise<void>;
}

const nativeFiles = registerPlugin<NativeFilesBridge>('NativeFiles');

export function usesNativeAndroidFiles() {
  return Capacitor.getPlatform() === 'android';
}

export function isFileSaveCanceled(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'CANCELED';
}

export async function saveRemoteFile(options: RemoteFileOptions) {
  if (usesNativeAndroidFiles()) return nativeFiles.saveRemote(options);
  const link = document.createElement('a');
  link.href = options.url;
  link.download = options.name;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}

export async function openRemoteFile(options: RemoteFileOptions) {
  if (usesNativeAndroidFiles()) return nativeFiles.openRemote(options);
  window.open(options.url, '_blank', 'noopener,noreferrer');
}

export async function shareRemoteFile(options: RemoteFileOptions) {
  if (usesNativeAndroidFiles()) return nativeFiles.shareRemote(options);
  if (typeof navigator.share === 'function') return navigator.share({ url: options.url, title: options.name });
  await navigator.clipboard.writeText(options.url);
}

export async function shareText(text: string, title?: string) {
  if (usesNativeAndroidFiles()) return nativeFiles.shareText({ text, title });
  if (typeof navigator.share === 'function') return navigator.share({ title, url: text });
  await navigator.clipboard.writeText(text);
}

export async function saveBlobFile(blob: Blob, name: string) {
  if (!usesNativeAndroidFiles()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('Unable to read the file.'));
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
  return nativeFiles.saveBase64({ base64, name, mimeType: blob.type.split(';')[0] || 'application/octet-stream' });
}

export async function saveDataUrlFile(dataUrl: string, name: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('Unable to read the export.');
  return saveBlobFile(await response.blob(), name);
}
