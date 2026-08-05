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
          {entry.fix && entry.fix.operation === 'add_missing_property' && (
            <div style={{ fontSize: '0.85em' }}>
              add_missing_property: {entry.fix.new_value} (new{' '}
              {entry.fix.new_node_kind} node: {entry.fix.new_node_value}
              {entry.fix.new_node_datatype
                ? ` [${entry.fix.new_node_datatype}]`
                : ''}
              )
            </div>
          )}
          {entry.fix && entry.fix.operation !== 'add_missing_property' && (
            <div style={{ fontSize: '0.85em' }}>
              {entry.fix.operation}: {entry.fix.old_value} → {entry.fix.new_value}
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
