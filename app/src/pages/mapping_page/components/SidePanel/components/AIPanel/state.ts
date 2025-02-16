import SettingsApi from "@/lib/api/settings_api";
import { ZustandActions } from "@/utils/zustand";
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import OpenAI from "openai";
import { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";


interface AIPanelState {
  isLoading: 'init' | 'loading' | 'answering' | null;
  isReady: boolean;
  openai: OpenAI | null;
  error: string | null;
  references: string[];
  mappingUUID: string;
  mappingName: string;
  mappingDescription: string;
  chatCompletion: ChatCompletionCreateParamsStreaming;
  streamingResponse: string | null;
  streamController: AbortController | null;
}

export const defaultAIpanelState: AIPanelState = {
  isLoading: null,
  isReady: false,
  openai: null,
  error: null,
  mappingUUID: '',
  mappingName: '',
  mappingDescription: '',
  references: [],
  chatCompletion: {
    messages: [],
    model: '',
    stream: true,
  },
  streamingResponse: null,
  streamController: null,
};

export type AIPanelStateActions = {
  init: (
    mappingUUID: string,
    mappingName: string,
    mappingDescription: string,
    references: string[]
  ) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  clear: () => void;
};

const functions: ZustandActions<AIPanelStateActions, AIPanelState> = (set, get) => ({
  clear() {
    set(defaultAIpanelState);
  },
  async init(
    mappingUUID: string,
    mappingName: string,
    mappingDescription: string,
    references: string[]
  ) {
    set({
      isReady: false,
      mappingUUID,
      mappingName,
      mappingDescription,
      references,
      isLoading: 'init'
    });
    const openai_url = await SettingsApi.getOpenAIURL();
    const openai_key = await SettingsApi.getOpenAIKey();
    const openai_model = await SettingsApi.getOpenAIModel();

    if (!openai_url || !openai_key || !openai_model) {
      set({ error: 'OpenAI URL, Key or Model not set, please set it in the settings page' });
      return;
    }

    const openai = new OpenAI({
      apiKey: openai_key,
      baseURL: openai_url,
      dangerouslyAllowBrowser: true,
    });
    const messages: AIPanelState['chatCompletion'] = {
      messages: [
        {
          role: 'system',
          content: `
        You are a RDF data mapping assistant in application where users can import ontologies/schemas and map their data to RDF.
        Tool can import any ontology/schema that is represented in RDF/OWL format.

        With the information you are given below, answer the questions that the user asks you.
        References are the column or property names in the source data that you are mapping.

        Mapping Name: ${get().mappingName}
        Mapping Description: ${get().mappingDescription}
        References: ${get().references.join(', ')}

        From this information, you can tell the user what kind of classes or properties they should use.

        If the user asks for what ontology to use, you can also suggest some standard ontologies/schemas that the user can use.

        YOU ARE MAPPING RDF, SO DO NOT SUGGEST NON-RDF CONCEPTS.
        `
        },
        {
          role: 'system',
          content: 'Before I start answering questions, I should make some deductions about the mapping. What is it about and what are the references?'
        }
      ],
      model: openai_model,
      stream: true,
    }

    // Make assistant reason about the mapping.

    const stream = openai.beta.chat.completions.stream(
      messages
    );

    const newChatCompletion = await stream.finalChatCompletion();

    messages.messages.push(
      { role: 'system', content: newChatCompletion.choices[0].message.content ?? '' },
      {
        role: 'system',
        content: `
        DO NOT USE MARKDOWN IN YOUR ANSWERS. ONLY PLAIN TEXT. ORGANIZE YOUR ANSWERS WITH LINE BREAKS.

        USE NEW LINES TO ORGANIZE YOUR ANSWERS.

        DO NOT USE ANY XML, HTML, JSON OR RDF SYNTAX IN YOUR ANSWERS.

        NO MARKDOWN, NO XML, NO HTML, NO JSON, NO RDF SYNTAX IN YOUR ANSWERS.

        YOUR ANSWERS ARE VIEWED IN A SMALL CHAT WINDOW. SO, KEEP YOUR ANSWERS SHORT AND TO THE POINT.
        `
      },
      { role: 'assistant', content: 'Hello! I am your RDF data mapping assistant. I will help you with your mapping. Ask me anything!' }
    );

    set({ openai, isReady: true, isLoading: null, chatCompletion: messages });
  },
  async sendMessage(message: string) {
    set({ isLoading: 'answering' });
    let chatCompletion = get().chatCompletion;
    chatCompletion.messages.push({ role: 'user', content: message }, {
      role: 'system',
      content: 'ANSWER WITH PLAIN TEXT. NO MARKDOWN, NO XML, NO HTML, NO JSON, NO RDF SYNTAX IN YOUR ANSWERS. USE NEW LINES TO ORGANIZE YOUR ANSWERS.'
    });
    set({
      chatCompletion: {
        ...chatCompletion,
        messages: [
          ...chatCompletion.messages,
        ]
      }
    });

    const openai = get().openai;
    if (!openai) {
      set({ error: 'OpenAI not initialized' });
      return;
    }

    const stream = openai.beta.chat.completions.stream(
      get().chatCompletion
    );

    set({ streamController: stream.controller, streamingResponse: '' });

    for await (const chunk of stream) {
      set((state) => ({
        streamingResponse: state.streamingResponse + (chunk.choices[0]?.delta?.content ?? ''),
      }));

      if (stream.controller.signal.aborted) {
        break;
      }
    }

    const newChatCompletion = await stream.finalChatCompletion();

    chatCompletion = get().chatCompletion;

    chatCompletion.messages.push({ role: 'assistant', content: newChatCompletion.choices[0].message.content });

    set({
      chatCompletion: {
        ...chatCompletion,
        messages: [
          ...chatCompletion.messages,
        ]
      }, streamingResponse: null, isLoading: null, streamController: null
    });

  },
});

export const useAIPanel = create<AIPanelState & AIPanelStateActions>()(
  devtools(
    (set, get) => ({
      ...defaultAIpanelState,
      ...functions(set, get),
    })
  )
)

export default useAIPanel;