import SettingsApi from "@/lib/api/settings_api";
import OpenAI from "openai";

const getOpenAI = async () => {
  const initOpenAI = async (): Promise<{ openai: OpenAI; openai_model: string }> => {
    const openai_url = await SettingsApi.getOpenAIURL();
    const openai_key = await SettingsApi.getOpenAIKey();
    const openai_model = await SettingsApi.getOpenAIModel();

    if (!openai_url || !openai_key || !openai_model) {
      throw new Error('OpenAI URL, Key or Model not set, please set it in the settings page');
    }

    const openai = new OpenAI({
      apiKey: openai_key,
      baseURL: openai_url,
      dangerouslyAllowBrowser: true,
    });

    return { openai, openai_model };
  };

  const { openai, openai_model } = await initOpenAI();

  return { openai, openai_model }
};

export default getOpenAI;