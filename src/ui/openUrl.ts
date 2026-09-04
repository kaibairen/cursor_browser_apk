import * as WebBrowser from 'expo-web-browser';

export async function openExternal(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, {
    enableBarCollapsing: true,
    showTitle: true,
  });
}

export function githubHttpsUrl(repoUrl: string): string {
  if (repoUrl.startsWith('http://') || repoUrl.startsWith('https://')) {
    return repoUrl;
  }
  return `https://${repoUrl}`;
}
