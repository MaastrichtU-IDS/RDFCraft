import { MappingGraph } from '@/lib/api/mapping_service/types';
import {
  Button,
  ButtonGroup,
  Card,
  Icon,
  NumericInput,
  Tag,
} from '@blueprintjs/core';
import { useState } from 'react';
import useValidationPageState from '../state';
import IterationLog from './IterationLog';
import ViolationList from './ViolationList';

interface MappingRowProps {
  mapping: MappingGraph;
}

const MappingRow = ({ mapping }: MappingRowProps) => {
  const perMapping = useValidationPageState(
    state => state.perMapping[mapping.uuid],
  );
  const selectedShapeSetId = useValidationPageState(
    state => state.selectedShapeSetId,
  );
  const runValidationForMapping = useValidationPageState(
    state => state.runValidationForMapping,
  );
  const runAutoRepairForMapping = useValidationPageState(
    state => state.runAutoRepairForMapping,
  );

  const [expanded, setExpanded] = useState(false);
  const [maxIterations, setMaxIterations] = useState(10);

  const isLoading = perMapping?.isLoading ?? null;
  const isRepairing = perMapping?.isRepairing ?? false;
  const report = perMapping?.report ?? null;
  const iterationLog = perMapping?.iterationLog ?? [];
  const busy = isLoading !== null || isRepairing;

  return (
    <Card style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          minimal
          small
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          onClick={() => setExpanded(e => !e)}
        />
        <b style={{ flex: 1 }}>{mapping.name}</b>
        {report && (
          <Tag intent={report.conforms ? 'success' : 'danger'} minimal>
            {report.violations.length} violation(s)
          </Tag>
        )}
        <ButtonGroup>
          <Button
            small
            icon='refresh'
            disabled={busy || !selectedShapeSetId}
            loading={isLoading === 'Validating...'}
            onClick={() => {
              setExpanded(true);
              runValidationForMapping(mapping.uuid);
            }}
          >
            Validate
          </Button>
          <NumericInput
            small
            disabled={busy}
            value={maxIterations}
            min={1}
            max={50}
            style={{ width: 50 }}
            onValueChange={value => setMaxIterations(value)}
          />
          <Button
            small
            icon='automatic-updates'
            intent='primary'
            disabled={busy || !selectedShapeSetId}
            loading={isRepairing}
            onClick={() => {
              setExpanded(true);
              runAutoRepairForMapping(mapping.uuid, maxIterations);
            }}
          >
            Auto-Repair
          </Button>
        </ButtonGroup>
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {report ? (
              <ViolationList violations={report.violations} />
            ) : (
              <div style={{ opacity: 0.6, display: 'flex', gap: 6 }}>
                <Icon icon='search-around' />
                Not validated yet
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <IterationLog entries={iterationLog} />
          </div>
        </div>
      )}
    </Card>
  );
};

export default MappingRow;
