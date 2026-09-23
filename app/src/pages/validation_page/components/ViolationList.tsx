import { ShaclViolation } from '@/lib/api/shacl_api/types';
import { Card, CardList, NonIdealState, Tag } from '@blueprintjs/core';

interface ViolationListProps {
  violations: ShaclViolation[];
}

function shortenUri(uri: string): string {
  if (!uri) return '';
  const hashIndex = uri.lastIndexOf('#');
  const slashIndex = uri.lastIndexOf('/');
  const cut = Math.max(hashIndex, slashIndex);
  return cut >= 0 ? uri.slice(cut + 1) : uri;
}

const ViolationList = ({ violations }: ViolationListProps) => {
  if (violations.length === 0) {
    return (
      <NonIdealState
        icon='tick-circle'
        title='No violations'
        description='The knowledge graph conforms to the selected shape set'
      />
    );
  }

  return (
    <CardList style={{ height: 'auto' }}>
      {violations.map((violation, index) => (
        <Card
          key={`${violation.focus_node}-${violation.result_path}-${index}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 4,
          }}
        >
          <div>
            <Tag minimal intent='danger'>
              {shortenUri(violation.source_constraint_component)}
            </Tag>{' '}
            {violation.result_path && (
              <Tag minimal>{shortenUri(violation.result_path)}</Tag>
            )}
          </div>
          <div>{violation.message}</div>
          <div style={{ opacity: 0.7, fontSize: '0.85em' }}>
            Focus node: {violation.focus_node}
          </div>
        </Card>
      ))}
    </CardList>
  );
};

export default ViolationList;
