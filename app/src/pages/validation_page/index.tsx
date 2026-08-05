import useErrorToast from '@/hooks/useErrorToast';
import {
  Button,
  ButtonGroup,
  H5,
  HTMLSelect,
  Navbar,
  NonIdealState,
  NumericInput,
} from '@blueprintjs/core';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import IterationLog from './components/IterationLog';
import MappingRow from './components/MappingRow';
import ViolationList from './components/ViolationList';
import useValidationPageState from './state';
import './styles.scss';

type ValidationPageUrlProps = {
  uuid: string;
};

const ValidationPage = () => {
  const { uuid } = useParams<ValidationPageUrlProps>();
  const navigation = useNavigate();

  const workspace = useValidationPageState(state => state.workspace);
  const shapeSets = useValidationPageState(state => state.shapeSets);
  const selectedShapeSetId = useValidationPageState(
    state => state.selectedShapeSetId,
  );
  const mappings = useValidationPageState(state => state.mappings);
  const report = useValidationPageState(state => state.report);
  const isLoading = useValidationPageState(state => state.isLoading);
  const isRepairing = useValidationPageState(state => state.isRepairing);
  const error = useValidationPageState(state => state.error);
  const iterationLog = useValidationPageState(state => state.iterationLog);

  const loadWorkspace = useValidationPageState(state => state.loadWorkspace);
  const setSelectedShapeSetId = useValidationPageState(
    state => state.setSelectedShapeSetId,
  );
  const runValidation = useValidationPageState(state => state.runValidation);
  const runAutoRepair = useValidationPageState(state => state.runAutoRepair);

  const [maxIterations, setMaxIterations] = useState(10);

  useEffect(() => {
    if (uuid) {
      loadWorkspace(uuid);
    }
  }, [uuid, loadWorkspace]);

  useErrorToast(error);

  const busy = isLoading !== null || isRepairing;

  return (
    <div className='validation-page'>
      <Navbar fixedToTop>
        <Navbar.Group>
          <Button
            icon='arrow-left'
            minimal
            onClick={() => navigation(`/workspaces/${uuid}`)}
          />
          <div style={{ width: 10 }} />
          <Navbar.Heading>
            Validate & Refine: {workspace?.name}
          </Navbar.Heading>
          <Navbar.Divider />
          <Navbar.Heading>
            {isLoading ? <>{isLoading}</> : null}
            {isRepairing ? <>Auto-repairing...</> : null}
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align='right'>
          <ButtonGroup>
            <HTMLSelect
              disabled={busy || shapeSets.length === 0}
              value={selectedShapeSetId ?? ''}
              onChange={e => setSelectedShapeSetId(e.currentTarget.value)}
            >
              {shapeSets.length === 0 && <option value=''>No shape sets</option>}
              {shapeSets.map(shapeSet => (
                <option key={shapeSet.uuid} value={shapeSet.uuid}>
                  {shapeSet.name}
                </option>
              ))}
            </HTMLSelect>
            <Button
              icon='refresh'
              disabled={busy || !selectedShapeSetId}
              loading={isLoading === 'Validating...'}
              onClick={() => runValidation()}
            >
              Validate
            </Button>
            <NumericInput
              disabled={busy}
              value={maxIterations}
              min={1}
              max={50}
              style={{ width: 60 }}
              onValueChange={value => setMaxIterations(value)}
            />
            <Button
              icon='automatic-updates'
              intent='primary'
              disabled={busy || !selectedShapeSetId}
              loading={isRepairing}
              onClick={() => runAutoRepair(maxIterations)}
            >
              Auto-Repair
            </Button>
          </ButtonGroup>
        </Navbar.Group>
      </Navbar>
      <div className='validation-page-content'>
        {shapeSets.length === 0 && !isLoading && (
          <NonIdealState
            title='No shape sets in this workspace'
            icon='shield'
            description='Add a SHACL shape set first'
            action={
              <Button
                intent='primary'
                icon='add'
                onClick={() => navigation(`/workspaces/${uuid}/shapes`)}
              >
                Go to Shapes
              </Button>
            }
          />
        )}
        {shapeSets.length > 0 && (
          <>
            <div className='validation-page-per-table'>
              <H5>Per-Table Validation &amp; Repair</H5>
              {mappings.map(mapping => (
                <MappingRow key={mapping.uuid} mapping={mapping} />
              ))}
            </div>
            <div className='validation-page-row'>
              <div className='validation-page-column'>
                <H5>
                  Whole-Workspace Violations{' '}
                  {report ? `(${report.violations.length})` : ''} —{' '}
                  {mappings.length} mapping(s)
                </H5>
                <div className='validation-page-column-content'>
                  {report ? (
                    <ViolationList violations={report.violations} />
                  ) : (
                    <NonIdealState
                      icon='search-around'
                      title='Not validated yet'
                      description='Run Validate to check the workspace against the selected shape set'
                    />
                  )}
                </div>
              </div>
              <div className='validation-page-column'>
                <H5>Whole-Workspace Auto-Repair Log</H5>
                <div className='validation-page-column-content'>
                  <IterationLog entries={iterationLog} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ValidationPage;
