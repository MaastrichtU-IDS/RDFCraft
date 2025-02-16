import { Card, Elevation, InputGroup } from '@blueprintjs/core';

import { useEffect, useMemo } from 'react';
import './styles.scss';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
}

const ChatBubble = ({ message, isUser }: ChatBubbleProps) => {
  // If a reasoning model is used, answers will contain <think>...</think> tags
  // split the message into parts and render them separately
  const { text } = useMemo(() => {
    if (message.includes('<think>') && message.includes('</think>')) {
      const start = message.indexOf('<think>');
      const end = message.indexOf('</think>');
      return {
        reasoning: message.substring(start + 7, end),
        text: message.substring(0, start) + message.substring(end + 8),
      };
    }
    return { reasoning: '', text: message };
  }, [message]);
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
      }}
    >
      <Card
        elevation={Elevation.TWO}
        style={{
          maxWidth: '60%',
          padding: '10px',
          backgroundColor: isUser ? '#137CBD' : '#F5F8FA',
          color: isUser ? 'white' : 'black',
          borderRadius: '15px',
        }}
      >
        {text}
      </Card>
    </div>
  );
};

interface ChatProps {
  messages: {
    key: string;
    text: string;
    isUser: boolean;
  }[];
  messageStream?: string | null;
  onSendMessage?: (message: string) => void;
  disabled?: boolean;
  isAnswering?: boolean;
}

const Chat = (props: ChatProps) => {
  useEffect(() => {
    const chat = document.querySelector('.chat');
    if (chat) {
      chat.scrollTop = chat.scrollHeight;
    }
  }, [props.messages, props.messageStream]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div className='chat'>
        {props.messages.map(message => (
          <ChatBubble
            key={message.key}
            message={message.text}
            isUser={message.isUser}
          />
        ))}
        {props.messageStream && (
          <ChatBubble message={props.messageStream} isUser={false} />
        )}
      </div>
      <InputGroup
        disabled={props.disabled || props.isAnswering}
        placeholder={props.isAnswering ? 'Thinking...' : 'Type a message'}
        style={{ width: '100%' }}
        onKeyDown={e => {
          if (e.key === 'Enter' && e.currentTarget.value !== '') {
            if (props.onSendMessage) {
              props.onSendMessage(e.currentTarget.value);
            }
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
};

export default Chat;
