import { IterationLogEntry } from '@/lib/llm/repairTypes';
import { Card, CardList, Icon, NonIdealState, Tag } from '@blueprintjs/core';

interface IterationLogProps {
  entries: IterationLogEntry[];
}

const IterationLog = ({ entries }: IterationLogProps) => {
  if (entries.length === 0) {
    return (
      <NonIdealState
        icon='history'
        title='No repair attempts yet'
        description='Run Auto-Repair to see progress here'
      />
    );
  }

  return (
    <CardList style={{ height: 'auto' }}>
      {entries.map(entry => (
        <Card
          key={entry.iteration}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon
              icon={entry.accepted ? 'tick-circle' : 'cross-circle'}
              intent={entry.accepted ? 'success' : 'warning'}
            />
            <b>Iteration {entry.iteration}</b>
            {entry.mappingName && <Tag minimal>{entry.mappingName}</Tag>}
            <Tag minimal intent={entry.accepted ? 'success' : 'none'}>
              {entry.violationsBefore}
              {entry.violationsAfter !== null
                ? ` -> ${entry.violationsAfter}`
                : ''}{' '}
              violations
            </Tag>
          </div>
          {entry.violation && (
            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
              {entry.violation.message}
            </div>
          )}
          {entry.stage2 && (
            <div style={{ fontSize: '0.85em' }}>
              <Tag minimal intent='primary'>
                {entry.stage2.root_error_type}
              </Tag>{' '}
              in {entry.stage2.responsible_mapping_file}
            </div>
          )}
          {entry.stage3 && (
            <div style={{ fontSize: '0.85em' }}>
              repair: {entry.stage3.repair_type} --{' '}
              {entry.stage3.corrected_triples.length} triple(s)
            </div>
          )}
          {entry.note && (
            <div style={{ fontSize: '0.85em', opacity: 0.7 }}>{entry.note}</div>
          )}
        </Card>
      ))}
    </CardList>
  );
};

export default IterationLog;
