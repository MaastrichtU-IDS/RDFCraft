import useErrorToast from '@/hooks/useErrorToast';
import { useSettingsPageState } from '@/pages/settings_page/state';

import DeleteAlert from '@/components/DeleteAlert';
import SettingsApi from '@/lib/api/settings_api';
import EditSettingsDialog from '@/pages/settings_page/components/EditSettingsDialog';
import { Button, Card, CardList, Navbar } from '@blueprintjs/core';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.scss';

const SettingsPage = () => {
  const navigation = useNavigate();
  const isLoading = useSettingsPageState(state => state.isLoading);
  const error = useSettingsPageState(state => state.error);
  const openai_url = useSettingsPageState(state => state.openai_url);
  const openai_key = useSettingsPageState(state => state.openai_key);
  const java_memory = useSettingsPageState(state => state.java_memory);
  const java_path = useSettingsPageState(state => state.java_path);
  const system = useSettingsPageState(state => state.system);
  const arch = useSettingsPageState(state => state.arch);
  const app_directory = useSettingsPageState(state => state.app_directory);
  const updateOpenaiUrl = useSettingsPageState(state => state.updateOpenaiUrl);
  const updateOpenaiKey = useSettingsPageState(state => state.updateOpenaiKey);
  const updateJavaMemory = useSettingsPageState(
    state => state.updateJavaMemory,
  );
  const updateJavaPath = useSettingsPageState(state => state.updateJavaPath);
  const clearTempFolder = useSettingsPageState(state => state.clearTempFolder);
  const clearLogs = useSettingsPageState(state => state.clearLogs);
  const refreshSettings = useSettingsPageState(state => state.refreshSettings);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const [open, setOpen] = useState<'delete' | 'edit' | null>(null);

  const [deleteAction, setDeleteAction] = useState<'temp' | 'logs' | null>(
    null,
  );

  const [editAction, setEditAction] = useState<
    'openai_url' | 'openai_key' | 'java_memory' | 'java_path' | null
  >(null);

  const handleDeleteAction = useCallback(() => {
    switch (deleteAction) {
      case 'temp':
        clearTempFolder();
        break;
      case 'logs':
        clearLogs();
        break;
    }
  }, [clearLogs, clearTempFolder, deleteAction]);

  const getDeleteDialogTitle = useCallback(() => {
    switch (deleteAction) {
      case 'temp':
        return 'Clear Temp Folder';
      case 'logs':
        return 'Clear Logs';
    }
    return '';
  }, [deleteAction]);

  const getDeleteDialogText = useCallback(() => {
    switch (deleteAction) {
      case 'temp':
        return 'Are you sure you want to clear temp folder?';
      case 'logs':
        return 'Are you sure you want to clear logs?';
    }
    return '';
  }, [deleteAction]);

  const getEditDialogTitle = useCallback(() => {
    switch (editAction) {
      case 'openai_url':
        return 'Edit OpenAI URL';
      case 'openai_key':
        return 'Edit OpenAI Key';
      case 'java_memory':
        return 'Edit Java Memory';
      case 'java_path':
        return 'Edit Java Path';
    }
    return '';
  }, [editAction]);

  const getValueNameForEdit = useCallback(() => {
    switch (editAction) {
      case 'openai_url':
        return 'OpenAI URL';
      case 'openai_key':
        return 'OpenAI Key';
      case 'java_memory':
        return 'Java Memory';
      case 'java_path':
        return 'Java Path';
    }
    return '';
  }, [editAction]);

  const getValueOfEdit = useCallback(() => {
    switch (editAction) {
      case 'openai_url':
        return openai_url;
      case 'openai_key':
        return openai_key;
      case 'java_memory':
        return java_memory;
      case 'java_path':
        return java_path;
    }
    return '';
  }, [editAction, java_memory, java_path, openai_key, openai_url]);

  const handleEditAction = useCallback(
    (value: string) => {
      switch (editAction) {
        case 'openai_url':
          updateOpenaiUrl(value);
          break;
        case 'openai_key':
          updateOpenaiKey(value);
          break;
        case 'java_memory':
          updateJavaMemory(value);
          break;
        case 'java_path':
          updateJavaPath(value);
          break;
      }
    },
    [
      editAction,
      updateJavaMemory,
      updateJavaPath,
      updateOpenaiKey,
      updateOpenaiUrl,
    ],
  );

  useErrorToast(error);

  return (
    <div className='settings-page'>
      <DeleteAlert
        open={open === 'delete'}
        onClose={() => setOpen(null)}
        onConfirm={handleDeleteAction}
        title={getDeleteDialogTitle()}
        message={getDeleteDialogText()}
      />
      <EditSettingsDialog
        open={open === 'edit'}
        onClose={() => setOpen(null)}
        title={getEditDialogTitle()}
        value={getValueOfEdit() ?? ''}
        value_name={getValueNameForEdit()}
        onConfirm={handleEditAction}
      />
      <Navbar fixedToTop>
        <Navbar.Group>
          <Button
            icon='arrow-left'
            minimal
            onClick={() => {
              navigation(`/`);
            }}
          />
          <div style={{ width: 10 }} />
          <Navbar.Heading>Settings</Navbar.Heading>
          <Navbar.Divider />
          <Navbar.Heading>
            {isLoading ? <>{isLoading}...</> : null}
          </Navbar.Heading>
        </Navbar.Group>
      </Navbar>
      <div className='settings-page-content'>
        <CardList className='settings-list'>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>OpenAI URL</h2>
              <p>{openai_url ?? 'Not Defined'}</p>
            </span>
            <Button
              icon='edit'
              onClick={() => {
                setEditAction('openai_url');
                setOpen('edit');
              }}
            >
              Edit
            </Button>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>OpenAI Key</h2>
              <p>{openai_key ?? 'Not Defined'}</p>
            </span>
            <Button
              icon='edit'
              onClick={() => {
                setEditAction('openai_key');
                setOpen('edit');
              }}
            >
              Edit
            </Button>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>Java Memory</h2>
              <p>{java_memory ?? 'Not Defined'}</p>
            </span>
            <Button
              icon='edit'
              onClick={() => {
                setEditAction('java_memory');
                setOpen('edit');
              }}
            >
              Edit
            </Button>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>Java Path</h2>
              <p>{java_path ?? 'Not Defined'}</p>
            </span>
            <Button
              icon='edit'
              onClick={() => {
                setEditAction('java_path');
                setOpen('edit');
              }}
            >
              Edit
            </Button>
          </Card>

          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>Download Logs</h2>
              <p>Download the RDFCraft logs</p>
            </span>
            <Button
              icon='download'
              onClick={() => {
                const a = document.createElement('a');
                a.href = SettingsApi.getLogsURL();
                a.download = 'rdfcraft.log';
                a.click();
              }}
            >
              Download
            </Button>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>Clear Temp Folder</h2>
              <p>Clear the temp folder</p>
            </span>
            <Button
              icon='trash'
              intent='danger'
              onClick={() => {
                setDeleteAction('temp');
                setOpen('delete');
              }}
            >
              Clear
            </Button>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>Clear Logs</h2>
              <p>Clear the logs</p>
            </span>
            <Button
              icon='trash'
              intent='danger'
              onClick={() => {
                setDeleteAction('logs');
                setOpen('delete');
              }}
            >
              Clear
            </Button>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>System</h2>
              <p>{system ?? 'Not Defined'}</p>
            </span>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>Architecture</h2>
              <p>{arch ?? 'Not Defined'}</p>
            </span>
          </Card>
          <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <h2>App Directory</h2>
              <p>{app_directory ?? 'Not Defined'}</p>
            </span>
          </Card>
        </CardList>
      </div>
    </div>
  );
};

export default SettingsPage;
