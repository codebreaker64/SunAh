import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang } from './types';
import { Address } from './speech';

/**
 * Persisted settings. Section 7b: three keys, and the server stays stateless
 * about users. Language is chosen once on first launch by a family member or
 * an AAC volunteer and then never shown again — the senior only ever sees
 * one button.
 */
export interface Settings {
  lang: Lang;
  address: Address;
  /** Laptop LAN IP with port. Hotspots hand out different addresses, so
   *  section 7e requires this stay editable. */
  laptopBaseUrl: string;
  /** "Better voice (uses internet)". Off by default — section 3. */
  allowCloud: boolean;
  /** False until the language screen has been completed once. */
  setupDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'nan',
  address: 'none',
  laptopBaseUrl: 'http://192.168.43.12:8000',
  allowCloud: false,
  setupDone: false,
};

const KEY = 'sunah.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // A corrupt settings blob must not stop the app from opening.
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Non-fatal: the app works fine for this session with in-memory settings.
  }
}
