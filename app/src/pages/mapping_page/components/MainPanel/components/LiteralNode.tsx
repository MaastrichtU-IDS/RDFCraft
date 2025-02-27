import { BaseNode } from '@/pages/mapping_page/components/MainPanel/components/BaseNode';
import { LabeledHandle } from '@/pages/mapping_page/components/MainPanel/components/LabeledHandle';
import { LiteralNodeType } from '@/pages/mapping_page/components/MainPanel/types';
import { Card, H6, Icon } from '@blueprintjs/core';
import { NodeProps } from '@xyflow/react';

export function LiteralNode({ data, selected }: NodeProps<LiteralNodeType>) {
  const typeRender = () => {
    if (data.literal_type.includes('http://www.w3.org/2001/XMLSchema#')) {
      return data.literal_type.split('#')[1];
    }
    return data.literal_type;
  };
  return (
    <BaseNode selected={selected} className='literal-node'>
      <Card
        style={{
          padding: 0,
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          className='custom-drag-handle'
        >
          <Icon icon='drag-handle-horizontal' size={20} />
        </div>
        <LabeledHandle id={data.id} title={data.label} type='target' bigTitle />
        <H6>{typeRender()}</H6>
      </Card>
    </BaseNode>
  );
}
