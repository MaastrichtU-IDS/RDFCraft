import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
} from '@blueprintjs/core';
import { useRef, useState } from 'react';
import { BasicSelectItem } from '../../../../components/BasicSelectMenuItem';
import { CreateWorkspaceMetadata } from '../../../../lib/api/workspaces_api/types';

import './styles.scss';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: CreateWorkspaceMetadata) => void;
}

// const WORKSPACE_TYPES: BasicSelectItem[] = [
//   {
//     value: 'local',
//     text: 'Local',
//     label: '',
//   },
//   {
//     value: 'remote',
//     text: 'Remote',
//     label: '',
//   },
// ];

const CreateWorkspaceDialog = ({
  open,
  onClose,
  onConfirm,
}: CreateWorkspaceDialogProps) => {
  const form_ref = useRef<HTMLFormElement>(null);

  const [workspaceType, setWorkspaceType] = useState<BasicSelectItem | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  // const renderItem: ItemRenderer<BasicSelectItem> = (
  //   item,
  //   { handleClick, modifiers, query },
  // ) => {
  //   return (
  //     <BasicSelectMenuItem
  //       key={item.value}
  //       item={item}
  //       itemRendererProps={{ handleClick, modifiers, query }}
  //     />
  //   );
  // };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form_ref.current) return;
    setError(null);

    // const { workspace_name, type, remote_connection_string, description } =
    //   form_ref.current;

    const { workspace_name, remote_connection_string, description } =
      form_ref.current;

    if (!workspace_name.value) {
      setError('Name is required');
      return;
    }
    // if (!type.value) {
    //   setError('Type is required');
    //   return;
    // }
    // if (type.value === 'remote' && !remote_connection_string.value) {
    //   setError('Remote Connection String is required');
    //   return;
    // }

    const data: CreateWorkspaceMetadata = {
      name: workspace_name.value,
      description: description.value || '',
      type: 'local',
      location: remote_connection_string?.value || '',
    };
    onConfirm(data);
  };

  return (
    <Dialog
      title='Create Workspace'
      isOpen={open}
      onClose={onClose}
      className='bp5-dark'
      onOpening={() => {
        setError(null);
        setWorkspaceType(null);
      }}
    >
      <form ref={form_ref} onSubmit={submit}>
        <DialogBody>
          {error && (
            <Callout className='error-callout' intent='danger'>
              {error}
            </Callout>
          )}

          <FormGroup
            label='Name'
            labelFor='workspace_name'
            labelInfo='(required)'
          >
            <InputGroup id='workspace_name' name='workspace_name' required />
          </FormGroup>
          <FormGroup label='Description' labelFor='description'>
            <InputGroup id='description' name='description' />
          </FormGroup>
          {/* <FormGroup
            label='Type'
            labelFor='type'
            labelInfo='(required)'
            contentClassName='form-content-do-not-fill'
          >
            <Select<BasicSelectItem>
              popoverProps={{
                minimal: true,
                matchTargetWidth: true,
              }}
              popoverTargetProps={{}}
              filterable={false}
              items={WORKSPACE_TYPES}
              onItemSelect={item => {
                if (form_ref.current) {
                  form_ref.current.type.value = item.value;
                  setWorkspaceType(item);
                  if (item.value === 'local') {
                    form_ref.current.remote_connection_string.value = '';
                  }
                }
              }}
              itemRenderer={renderItem}
            >
              <input type='text' id='type' name='type' required hidden />
              <Button
                text={workspaceType ? workspaceType.text : 'Select Type'}
                rightIcon='double-caret-vertical'
              />
            </Select>
          </FormGroup> */}
          {workspaceType?.value === 'remote' && (
            <FormGroup
              label='Remote Connection String'
              labelFor='remote_connection_string'
              labelInfo='(required)'
            >
              <InputGroup
                id='remote_connection_string'
                name='remote_connection_string'
                required
              />
            </FormGroup>
          )}
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button text='Cancel' onClick={onClose} />
              <Button
                text='Create'
                intent='primary'
                onClick={() =>
                  form_ref.current?.dispatchEvent(
                    new Event('submit', { cancelable: true, bubbles: true }),
                  )
                }
              />
            </>
          }
        />
      </form>
    </Dialog>
  );
};

export default CreateWorkspaceDialog;
