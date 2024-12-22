import { BaseNode } from '@/pages/mapping_page/components/MainPanel/components/BaseNode';
import { LabeledHandle } from '@/pages/mapping_page/components/MainPanel/components/LabeledHandle';
import { URIRefNodeType } from '@/pages/mapping_page/components/MainPanel/types';
import { Card, Icon } from '@blueprintjs/core';
import { NodeProps } from '@xyflow/react';

export function URIRefNode({ data, selected }: NodeProps<URIRefNodeType>) {
  return (
    <BaseNode selected={selected}>
      <Card
        style={{
          padding: 0,
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          className='custom-drag-handle'
          style={{
            height: '10px',
            margin: '8px auto',
            width: '100%',
            cursor: 'grab',
          }}
        >
          <Icon icon='drag-handle-horizontal' size={20} />
        </div>
        <LabeledHandle
          id={data.id}
          title={data.uri_pattern}
          type='target'
          bigTitle
        />
      </Card>
    </BaseNode>
  );
}
