import SettingsApi from '@/lib/api/settings_api';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ZustandActions } from '../../utils/zustand';

interface SettingsPageState {
  isLoading: string | null;
  error: string | null;
  openai_url: string | null;
  openai_key: string | null;
  openai_model: string | null;
  java_memory: string | null;
  java_path: string | null;
  system: string | null;
  arch: string | null;
  app_directory: string | null;
}

interface SettingsPageStateActions {
  refreshSettings: () => void;
  updateOpenaiUrl: (openai_url: string) => void;
  updateOpenaiKey: (openai_key: string) => void;
  updateOpenaiModel: (openai_model: string) => void;
  updateJavaMemory: (java_memory: string) => void;
  updateJavaPath: (java_path: string) => void;
  clearTempFolder: () => void;
  clearLogs: () => void;
}

const defaultState: SettingsPageState = {
  isLoading: null,
  error: null,
  openai_url: null,
  openai_key: null,
  openai_model: null,
  java_memory: null,
  java_path: null,
  system: null,
  arch: null,
  app_directory: null,
};


const functions: ZustandActions<SettingsPageStateActions, SettingsPageState> = (
  set,

) => ({
  refreshSettings() {
    set({ isLoading: 'Loading settings...' });
    const allPromises = [
      SettingsApi.getOpenAIKey(),
      SettingsApi.getOpenAIURL(),
      SettingsApi.getOpenAIModel(),
      SettingsApi.getJavaMemory(),
      SettingsApi.getJavaPath(),
      SettingsApi.getSystem(),
      SettingsApi.getArch(),
      SettingsApi.getAppDirectory(),
    ]

    Promise.all(allPromises)
      .then(([
        openai_key,
        openai_url,
        openai_model,
        java_memory,
        java_path,
        system,
        arch,
        app_directory,
      ]) => {
        set({
          openai_key: openai_key == '' ? null : openai_key,
          openai_url: openai_url == '' ? null : openai_url,
          openai_model: openai_model == '' ? null : openai_model,
          java_memory,
          java_path,
          system,
          arch,
          app_directory,
          isLoading: null,
          error: null,
        });
      })
      .catch((error) => {
        set({ error: error.message, isLoading: null });
      });
  },
  updateOpenaiUrl(openai_url) {
    set({ isLoading: 'Updating OpenAI URL...' });
    SettingsApi.updateOpenAIURL(openai_url).then(() => {
      set({ openai_url, isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
  updateOpenaiKey(openai_key) {
    set({ isLoading: 'Updating OpenAI Key...' });
    SettingsApi.updateOpenAIKey(openai_key).then(() => {
      set({ openai_key, isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
  updateOpenaiModel(openai_model) {
    set({ isLoading: 'Updating OpenAI Model...' });
    SettingsApi.updateOpenAIModel(openai_model).then(() => {
      set({ openai_model, isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
  updateJavaMemory(java_memory) {
    set({ isLoading: 'Updating Java Memory...' });
    SettingsApi.updateJavaMemory(java_memory).then(() => {
      set({ java_memory, isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
  updateJavaPath(java_path) {
    set({ isLoading: 'Updating Java Path...' });
    SettingsApi.updateJavaPath(java_path).then(() => {
      set({ java_path, isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
  clearTempFolder() {
    set({ isLoading: 'Clearing temp folder...' });
    SettingsApi.clearTempDirectory().then(() => {
      set({ isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
  clearLogs() {
    set({ isLoading: 'Clearing logs...' });
    SettingsApi.clearLogs().then(() => {
      set({ isLoading: null });
    }).catch((error) => {
      set({ error: error.message, isLoading: null });
    });
  },
});

export const useSettingsPageState = create<SettingsPageState & SettingsPageStateActions>()(
  devtools((set, get) => ({
    ...defaultState,
    ...functions(set, get),
  })),
);
