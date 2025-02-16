import Chat from '@/components/Chat';
import useAIPanel from '@/pages/mapping_page/components/SidePanel/components/AIPanel/state';
import useMappingPage from '@/pages/mapping_page/state';
import { Divider, H5, NonIdealState } from '@blueprintjs/core';
import { useEffect, useMemo } from 'react';

const AIPanel = () => {
  const mapping = useMappingPage(state => state.mapping);
  const references = useMappingPage(state => state.source?.references);

  const initAIPanel = useAIPanel(state => state.init);
  const sendMessage = useAIPanel(state => state.sendMessage);
  const chatCompletion = useAIPanel(state => state.chatCompletion);
  const streamingResponse = useAIPanel(state => state.streamingResponse);
  const mappingUUID = useAIPanel(state => state.mappingUUID);
  const isReady = useAIPanel(state => state.isReady);
  const error = useAIPanel(state => state.error);
  const isLoading = useAIPanel(state => state.isLoading);

  useEffect(() => {
    if (mapping && references && mapping.uuid !== mappingUUID) {
      initAIPanel(mapping.uuid, mapping.name, mapping.description, references);
    }
  }, [mapping, references, mappingUUID, initAIPanel]);

  const chatMessages = useMemo(() => {
    return chatCompletion.messages
      .map((message, index) => {
        if (message.role === 'system' || message.role === 'developer') {
          return null;
        }
        return {
          key: index.toString(),
          text: message.content ?? '',
          isUser: message.role === 'user',
        };
      })
      .filter(
        (message): message is { key: string; text: string; isUser: boolean } =>
          message !== null && message.text !== '',
      );
  }, [chatCompletion.messages]);

  const getChatComponent = (
    isReady: boolean,
    error: string | null,
    isLoading: string | null,
  ) => {
    if (error) {
      return <NonIdealState icon='error' title='Error' description={error} />;
    }

    if (!isReady) {
      return (
        <NonIdealState
          icon='refresh'
          title='Loading'
          description='Initializing AI assistant'
        />
      );
    }

    return (
      <Chat
        disabled={!isReady || isLoading !== null}
        messages={chatMessages}
        onSendMessage={sendMessage}
        messageStream={streamingResponse}
        isAnswering={isLoading === 'answering'}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <H5>Mapping Assistant</H5>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
        {getChatComponent(isReady, error, isLoading)}
      </div>
    </div>
  );
};

export default AIPanel;
