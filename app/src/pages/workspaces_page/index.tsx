import { Button, ButtonGroup, Navbar, NonIdealState } from '@blueprintjs/core';
import { useCallback, useEffect, useState } from 'react';
import useWorkspacesPageState from './state';

import CreateWorkspaceDialog from './components/CreateWorkspaceDialog';

import { useNavigate } from 'react-router-dom';
import DeleteAlert from '../../components/DeleteAlert';
import toast from '../../consts/toast';
import useErrorToast from '../../hooks/useErrorToast';
import { Workspace } from '../../lib/api/workspaces_api/types';
import WorkspaceCardItem from './components/WorkspaceCardItem';
import './styles.scss';

const WorkspacesPage = () => {
  const workspaces = useWorkspacesPageState(state => state.workspaces);
  const isLoading = useWorkspacesPageState(state => state.isLoading);
  const error = useWorkspacesPageState(state => state.error);
  const pull = useWorkspacesPageState(state => state.refreshWorkspaces);
  const create = useWorkspacesPageState(state => state.createWorkspace);
  const navigate = useNavigate();
  const deleteWorkspace = useWorkspacesPageState(
    state => state.deleteWorkspace,
  );
  const exportWorkspace = useWorkspacesPageState(
    state => state.exportWorkspace,
  );
  const importWorkspace = useWorkspacesPageState(
    state => state.importWorkspace,
  );

  const [open, setOpen] = useState<'create' | 'delete' | null>(null);

  useEffect(() => {
    pull();
  }, [pull]);

  useErrorToast(error);

  const [toBeDeleted, setToBeDeleted] = useState<Workspace | null>(null);

  const handleDelete = useCallback(
    (workspace: Workspace) => {
      deleteWorkspace(workspace);
      toast.show({
        message: 'Workspace deleted successfully',
        intent: 'success',
      });
    },
    [deleteWorkspace],
  );

  const showDeleteAlert = useCallback((workspace: Workspace) => {
    setToBeDeleted(workspace);
    setOpen('delete');
  }, []);

  const handleOpen = useCallback(
    (workspace: Workspace) => {
      navigate(`/workspaces/${workspace.uuid}`);
    },
    [navigate],
  );

  const handleImport = useCallback(() => {
    // Open file picker

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.tar.gz';
    fileInput.onchange = async () => {
      if (fileInput.files) {
        const file = fileInput.files[0];
        importWorkspace(file);
      }
    };
    fileInput.click();
  }, [importWorkspace]);

  return (
    <div>
      <DeleteAlert
        title='Delete Workspace'
        message='Are you sure you want to delete this workspace?'
        open={open === 'delete'}
        onClose={() => setOpen(null)}
        onConfirm={() => {
          if (toBeDeleted) {
            handleDelete(toBeDeleted);
          }
          setOpen(null);
        }}
      />
      <CreateWorkspaceDialog
        open={open === 'create'}
        onClose={() => setOpen(null)}
        onConfirm={data => {
          create(data);
          setOpen(null);
          toast.show({
            message: 'Workspace created successfully',
            intent: 'success',
          });
        }}
      />
      <Navbar fixedToTop>
        <Navbar.Group>
          <Navbar.Heading>Workspaces</Navbar.Heading>
          <Navbar.Divider />
          <Navbar.Heading>
            {isLoading ? 'Loading...' : error ?? ''}
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align='right'>
          <ButtonGroup>
            <Button icon='refresh' onClick={pull} />
            <Button icon='add' onClick={() => setOpen('create')}>
              Create Workspace
            </Button>
            <Button icon='import' onClick={handleImport}>
              Import Workspace
            </Button>
            <Button icon='cog' onClick={() => navigate('/settings')}>
              Settings
            </Button>
          </ButtonGroup>
        </Navbar.Group>
      </Navbar>

      <div className='workspaces-content'>
        {workspaces.length === 0 && isLoading === false && (
          <div className='no-workspaces'>
            <NonIdealState
              icon='folder-open'
              iconSize={32}
              title={'No workspaces'}
              description='Create a workspace to get started'
              layout='vertical'
              action={
                <Button intent='primary' onClick={() => setOpen('create')}>
                  Create Workspace
                </Button>
              }
            />
          </div>
        )}
        {workspaces.length > 0 && (
          <div className='card-grid-4'>
            {workspaces.map(workspace => (
              <WorkspaceCardItem
                key={workspace.uuid}
                workspace={workspace}
                onDelete={showDeleteAlert}
                onOpen={handleOpen}
                onExport={exportWorkspace}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspacesPage;
