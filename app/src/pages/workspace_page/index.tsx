import { Button, ButtonGroup, Navbar, NonIdealState } from '@blueprintjs/core';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useWorkspacePageState from './state';

import DeleteAlert from '../../components/DeleteAlert';
import useErrorToast from '../../hooks/useErrorToast';
import { MappingGraph } from '../../lib/api/mapping_service/types';
import CreateMappingDialog from './components/CreateMappingDialog';
import MappingCardItem from './components/MappingCard';
import './styles.scss';

type WorkspacePageURLProps = {
  uuid: string;
};

const WorkspacePage = () => {
  const props = useParams<WorkspacePageURLProps>();
  const navigation = useNavigate();
  const workspace = useWorkspacePageState(state => state.workspace);
  const mappingGraphs = useWorkspacePageState(state => state.mappingGraphs);
  const isLoading = useWorkspacePageState(state => state.isLoading);
  const error = useWorkspacePageState(state => state.error);
  const loadWorkspace = useWorkspacePageState(state => state.loadWorkspace);
  const createMapping = useWorkspacePageState(state => state.createMapping);
  const deleteMapping = useWorkspacePageState(state => state.deleteMapping);
  const exportMapping = useWorkspacePageState(state => state.exportMapping);
  const importMapping = useWorkspacePageState(state => state.importMapping);

  useEffect(() => {
    if (props.uuid) {
      loadWorkspace(props.uuid);
    }
  }, [props.uuid, loadWorkspace]);

  useErrorToast(error);

  const [open, setOpen] = useState<'create' | 'delete' | null>(null);
  const [toBeDeleted, setToBeDeleted] = useState<MappingGraph | null>(null);

  const handleDelete = useCallback(() => {
    if (toBeDeleted && workspace) {
      deleteMapping(workspace.uuid, toBeDeleted.uuid);
    }
    setOpen(null);
  }, [toBeDeleted, workspace, deleteMapping]);

  const handleImport = useCallback(() => {
    if (workspace) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.tar.gz';
      fileInput.onchange = async () => {
        if (fileInput.files) {
          const file = fileInput.files[0];
          importMapping(workspace.uuid, file);
        }
      };
      fileInput.click();
    }
  }, [workspace, importMapping]);

  return (
    <div className='workspace-page'>
      <DeleteAlert
        title='Delete Mapping'
        message='Are you sure you want to delete this mapping?'
        open={open === 'delete'}
        onClose={() => setOpen(null)}
        onConfirm={handleDelete}
      />
      <CreateMappingDialog
        open={open === 'create'}
        onClose={() => setOpen(null)}
        onCreate={data => {
          if (workspace) {
            createMapping(
              workspace.uuid,
              data.name,
              data.description,
              data.file,
              data.sourceType,
              data.extra,
            );
          }
          setOpen(null);
        }}
      />
      <Navbar fixedToTop>
        <Navbar.Group>
          <Button
            icon='arrow-left'
            minimal
            onClick={() => {
              navigation('/');
            }}
          />
          <div style={{ width: 10 }} />
          <Navbar.Heading>Workspace: {workspace?.name}</Navbar.Heading>
          <Navbar.Divider />
          <Navbar.Heading>{isLoading ? <>{isLoading}</> : null}</Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align='right'>
          <ButtonGroup>
            <Button
              icon='add-to-artifact'
              onClick={() => {
                setOpen('create');
              }}
            >
              Create New Mapping
            </Button>
            <Button icon='import' onClick={handleImport}>
              Import Mapping
            </Button>
            <Button
              icon='search-around'
              onClick={() => {
                navigation('ontologies');
              }}
            >
              Ontologies
            </Button>
            <Button
              icon='link'
              onClick={() => {
                navigation('prefixes');
              }}
            >
              Prefixes
            </Button>
            <Button
              icon='shield'
              onClick={() => {
                navigation('shapes');
              }}
            >
              Shapes
            </Button>
            <Button
              icon='tick-circle'
              onClick={() => {
                navigation('validate');
              }}
            >
              Validate & Refine
            </Button>
          </ButtonGroup>
        </Navbar.Group>
      </Navbar>
      <div className='workspace-page-content'>
        {!workspace && <></>}
        {workspace && mappingGraphs.length === 0 && (
          <NonIdealState
            title='No Mappings Found'
            icon='search-around'
            description='There are no mappings in this workspace.'
            action={
              <Button
                icon='add-to-artifact'
                intent='primary'
                onClick={() => {
                  setOpen('create');
                }}
              >
                Create New Mapping
              </Button>
            }
          />
        )}
        {workspace && mappingGraphs.length > 0 && (
          <div className='card-grid-4'>
            {mappingGraphs.map(mappingGraph => (
              <MappingCardItem
                key={mappingGraph.uuid}
                mapping={mappingGraph}
                onDelete={mappingGraph => {
                  setToBeDeleted(mappingGraph);
                  setOpen('delete');
                }}
                onSelected={() => {
                  navigation(
                    `/workspaces/${workspace.uuid}/mapping/${mappingGraph.uuid}`,
                  );
                }}
                onExport={mappingGraph => {
                  exportMapping(workspace.uuid, mappingGraph.uuid);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspacePage;
