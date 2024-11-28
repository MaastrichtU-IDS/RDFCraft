import { Button, ButtonGroup, Navbar, NonIdealState } from '@blueprintjs/core';
import { useCallback, useEffect, useState } from 'react';
import useWorkspacesPageState from './state';

import CreateWorkspaceDialog from './components/CreateWorkspaceDialog';

import DeleteAlert from '../../components/DeleteAlert';
import { WorkspaceMetadata } from '../../lib/api/workspaces_api/types';
import WorkspaceCardItem from './components/WorkspaceCardItem';
import './styles.scss';

const WorkspacesPage = () => {
  const workspaces = useWorkspacesPageState(state => state.workspaces);
  const isLoading = useWorkspacesPageState(state => state.isLoading);
  const error = useWorkspacesPageState(state => state.error);
  const pull = useWorkspacesPageState(state => state.refreshWorkspaces);
  const create = useWorkspacesPageState(state => state.createWorkspace);
  const deleteWorkspace = useWorkspacesPageState(
    state => state.deleteWorkspace,
  );

  const [open, setOpen] = useState<'create' | 'delete' | null>(null);

  useEffect(() => {
    pull();
  }, [pull]);

  const [toBeDeleted, setToBeDeleted] = useState<WorkspaceMetadata | null>(
    null,
  );

  const handleDelete = useCallback(
    (workspace: WorkspaceMetadata) => {
      deleteWorkspace(workspace);
    },
    [deleteWorkspace],
  );

  const showDeleteAlert = useCallback((workspace: WorkspaceMetadata) => {
    setToBeDeleted(workspace);
    setOpen('delete');
  }, []);

  const handleOpen = useCallback((workspace: WorkspaceMetadata) => {
    console.log('Opening workspace', workspace);
  }, []);

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
          <div className='workspaces-list'>
            {workspaces.map(workspace => (
              <WorkspaceCardItem
                key={workspace.uuid}
                workspace={workspace}
                onDelete={showDeleteAlert}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspacesPage;
