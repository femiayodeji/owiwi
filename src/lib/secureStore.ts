// API keys live ONLY here. Never copy them into SQLite, state that is persisted,
// logs or error messages.
import * as SecureStore from 'expo-secure-store';

// SecureStore keys may only contain [A-Za-z0-9._-], so the documented
// `apikey:<id>` scheme is stored as `apikey.<id>`.
export const apiKeyName = (providerId: string): string => `apikey.${providerId}`;

export function getApiKey(providerId: string): Promise<string | null> {
  return SecureStore.getItemAsync(apiKeyName(providerId));
}

export function setApiKey(providerId: string, key: string): Promise<void> {
  return SecureStore.setItemAsync(apiKeyName(providerId), key.trim());
}

export function deleteApiKey(providerId: string): Promise<void> {
  return SecureStore.deleteItemAsync(apiKeyName(providerId));
}

export async function hasApiKey(providerId: string): Promise<boolean> {
  return (await getApiKey(providerId)) != null;
}
