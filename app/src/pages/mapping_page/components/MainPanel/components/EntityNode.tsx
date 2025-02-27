import { Property } from '@/lib/api/ontology_api/types';
import { BaseNode } from '@/pages/mapping_page/components/MainPanel/components/BaseNode';
import { LabeledHandle } from '@/pages/mapping_page/components/MainPanel/components/LabeledHandle';
import { EntityNodeType } from '@/pages/mapping_page/components/MainPanel/types';
import useMappingPage from '@/pages/mapping_page/state';
import { Card, HTMLTable, Icon } from '@blueprintjs/core';
import { NodeProps } from '@xyflow/react';
import { useMemo } from 'react';

export function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const ontologies = useMappingPage(state => state.ontologies);

  const properties = useMemo(() => {
    if (!ontologies) return [];
    const allProperties = ontologies.flatMap(ontology => ontology.properties);
    return data.properties.map(property_1 => {
      const _property = allProperties.find(
        property_2 => property_2.full_uri === property_1,
      );
      return (
        _property ??
        ({
          type: 'property',
          belongs_to: 'Created',
          description: [],
          domain: [],
          full_uri: property_1,
          label: [],
          property_type: 'any',
          range: [],
          is_deprecated: false,
        } as Property)
      );
    });
  }, [ontologies, data.properties]);

  return (
    <BaseNode selected={selected} className='entity-node'>
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

        <HTMLTable striped>
          <tbody>
            {properties.map(entry => (
              <tr key={entry.full_uri} style={{ width: '100%' }}>
                <td
                  colSpan={100}
                  style={{
                    fontWeight: 300,
                    minWidth: '150px',
                  }}
                >
                  <LabeledHandle
                    id={entry.full_uri}
                    title={entry.label[0]?.value ?? entry.full_uri}
                    subtitle={entry.property_type}
                    type='source'
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Card>
    </BaseNode>
  );
}
