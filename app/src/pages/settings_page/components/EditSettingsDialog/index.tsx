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

interface EditSettingsDialog {
  title: string;
  value_name: string;
  value: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (data: string) => void;
}

const EditSettingsDialog = (props: EditSettingsDialog) => {
  const form_ref = useRef<HTMLFormElement>(null);

  const [error, setError] = useState<string | null>(null);

  const onClose = () => {
    props.onClose();
    setError(null);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form_ref.current) return;
    setError(null);
    if (form_ref.current.value === '') {
      setError('Please fill all fields');
      return;
    }
    props.onConfirm(form_ref.current.value.value);
    onClose();
  };

  return (
    <Dialog
      className='bp5-dark'
      isOpen={props.open}
      title={props.title}
      onClose={onClose}
    >
      <form ref={form_ref} onSubmit={submit}>
        <DialogBody>
          {error && (
            <Callout className='error-callout' intent='danger'>
              {error}
            </Callout>
          )}
          <FormGroup
            label={props.value_name}
            labelFor={props.value_name}
            labelInfo='(required)'
          >
            <InputGroup
              id='value'
              name={props.value_name}
              defaultValue={props.value}
              required
            />
          </FormGroup>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button text='Cancel' onClick={onClose} />
              <Button
                text='Save'
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

export default EditSettingsDialog;
