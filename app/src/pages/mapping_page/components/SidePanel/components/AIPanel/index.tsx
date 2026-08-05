import Chat from '@/components/Chat';
import DeleteAlert from '@/components/DeleteAlert';
import useAIPanel from '@/pages/mapping_page/components/SidePanel/components/AIPanel/state';
import useMappingPage from '@/pages/mapping_page/state';
import {
  Button,
  Divider,
  H5,
  NonIdealState,
  Tooltip,
} from '@blueprintjs/core';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const AIPanel = () => {
  const { uuid: workspaceUuid } = useParams<{ uuid: string }>();
  const mapping = useMappingPage(state => state.mapping);
  const references = useMappingPage(state => state.source?.references);

  const initAIPanel = useAIPanel(state => state.init);
  const sendMessage = useAIPanel(state => state.sendMessage);
  const generateMapping = useAIPanel(state => state.generateMapping);
  const chatCompletion = useAIPanel(state => state.chatCompletion);
  const streamingResponse = useAIPanel(state => state.streamingResponse);
  const mappingUUID = useAIPanel(state => state.mappingUUID);
  const isReady = useAIPanel(state => state.isReady);
  const error = useAIPanel(state => state.error);
  const isLoading = useAIPanel(state => state.isLoading);

  const [confirmGenerate, setConfirmGenerate] = useState(false);

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

  const handleGenerateClick = () => {
    if (mapping && mapping.nodes.length > 0) {
      setConfirmGenerate(true);
      return;
    }
    if (workspaceUuid) {
      generateMapping(workspaceUuid);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DeleteAlert
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={() => {
          setConfirmGenerate(false);
          if (workspaceUuid) {
            generateMapping(workspaceUuid);
          }
        }}
        title='Overwrite mapping?'
        message='This mapping already has nodes on the canvas. Generating a new mapping with AI will replace the entire canvas. Continue?'
      />
      <H5>Mapping Assistant</H5>
      <Tooltip
        content='Let the AI propose a complete mapping graph from the source columns, ontology and SHACL shapes'
        placement='bottom'
      >
        <Button
          icon='predictive-analysis'
          fill
          loading={isLoading === 'generating'}
          disabled={!workspaceUuid || isLoading !== null}
          onClick={handleGenerateClick}
        >
          Generate Mapping with AI
        </Button>
      </Tooltip>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
        {getChatComponent(isReady, error, isLoading)}
      </div>
    </div>
  );
};

export default AIPanel;
