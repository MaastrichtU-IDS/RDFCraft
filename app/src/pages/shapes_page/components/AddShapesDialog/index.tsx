import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FileInput,
  FormGroup,
  InputGroup,
} from '@blueprintjs/core';
import { useRef, useState } from 'react';

interface AddShapesDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description: string; file: File }) => void;
}

const AddShapesDialog = (props: AddShapesDialogProps) => {
  const form_ref = useRef<HTMLFormElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const onClose = () => {
    props.onClose();
    setError(null);
    setFile(null);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form_ref.current) return;
    setError(null);

    const { shapes_name, description } = form_ref.current;

    if (!shapes_name || !description || !file) {
      setError('Please fill all fields');
      return;
    }

    props.onCreate({
      name: shapes_name.value,
      description: description.value,
      file,
    });
  };

  return (
    <Dialog
      className='bp5-dark'
      isOpen={props.open}
      title='Add Shape Set'
      onClose={onClose}
    >
      <form ref={form_ref} onSubmit={submit}>
        <DialogBody>
          {error && (
            <Callout className='error-callout' intent='danger'>
              {error}
            </Callout>
          )}
          <FormGroup label='Name' labelFor='shapes_name' labelInfo='(required)'>
            <InputGroup id='shapes_name' name='shapes_name' required />
          </FormGroup>
          <FormGroup
            label='Description'
            labelFor='description'
            labelInfo='(required)'
          >
            <InputGroup id='description' name='description' required />
          </FormGroup>
          <FormGroup label='File' labelFor='file' labelInfo='(required)'>
            <FileInput
              inputProps={{
                accept: '.ttl,.n3,.nt,.trig,.rdf,.xml',
              }}
              text={file?.name ?? 'Choose SHACL shapes file...'}
              onInputChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) {
                  setFile(e.target.files[0]);
                }
              }}
            />
          </FormGroup>
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

export default AddShapesDialog;
