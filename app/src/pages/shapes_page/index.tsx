import { useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonGroup, Navbar, NonIdealState } from '@blueprintjs/core';
import { useEffect, useState } from 'react';
import DeleteAlert from '../../components/DeleteAlert';
import useErrorToast from '../../hooks/useErrorToast';
import { ShapeSet } from '../../lib/api/shapes_api/types';
import AddShapesDialog from './components/AddShapesDialog';
import ShapesCardItem from './components/ShapesCardItem';
import useShapesPageState from './state';
import './styles.scss';

type ShapesPageUrlProps = {
  uuid: string;
};

const ShapesPage = () => {
  const { uuid } = useParams<ShapesPageUrlProps>();
  const shapeSets = useShapesPageState(state => state.shapeSets);
  const isLoading = useShapesPageState(state => state.isLoading);
  const error = useShapesPageState(state => state.error);
  const refreshShapeSets = useShapesPageState(state => state.refreshShapeSets);
  const createShapes = useShapesPageState(state => state.createShapes);
  const deleteShapes = useShapesPageState(state => state.deleteShapes);
  const navigation = useNavigate();

  const [open, setOpen] = useState<'create' | 'delete' | null>(null);

  const [toBeDeleted, setToBeDeleted] = useState<ShapeSet | null>(null);

  useEffect(() => {
    if (uuid) {
      refreshShapeSets(uuid);
    }
  }, [uuid, refreshShapeSets]);

  useErrorToast(error);

  const handleDelete = (shapes: ShapeSet) => {
    setToBeDeleted(shapes);
    setOpen('delete');
  };

  return (
    <div className='shapes-page'>
      <DeleteAlert
        open={open === 'delete'}
        onClose={() => setOpen(null)}
        onConfirm={() => {
          if (toBeDeleted && uuid) {
            deleteShapes(uuid, toBeDeleted.uuid);
          }
          setOpen(null);
        }}
        title='Delete Shape Set'
        message='Are you sure you want to delete this shape set?'
      />
      <AddShapesDialog
        open={open === 'create'}
        onCreate={data => {
          if (uuid) {
            try {
              createShapes(uuid, data);
            } catch {
              /* empty */
            }
          }
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
        key={uuid}
      />
      <Navbar fixedToTop>
        <Navbar.Group>
          <Button
            icon='arrow-left'
            minimal
            onClick={() => {
              navigation(`/workspaces/${uuid}`);
            }}
          />
          <div style={{ width: 10 }} />
          <Navbar.Heading>SHACL Shapes</Navbar.Heading>
          <Navbar.Divider />
          <Navbar.Heading>
            {isLoading ? <>{isLoading}...</> : null}
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align='right'>
          <ButtonGroup>
            <Button icon='add' onClick={() => setOpen('create')}>
              Add Shape Set
            </Button>
          </ButtonGroup>
        </Navbar.Group>
      </Navbar>
      <div className='shapes-page-content'>
        {!shapeSets && <></>}
        {shapeSets?.length === 0 && (
          <NonIdealState
            title='No Shape Sets'
            icon='search-around'
            description='There are no SHACL shape sets in this workspace'
            action={
              <Button
                intent='primary'
                icon='add'
                onClick={() => setOpen('create')}
              >
                Add new Shape Set
              </Button>
            }
          />
        )}
        {shapeSets && shapeSets.length > 0 && (
          <div className='card-grid-4'>
            {shapeSets.map(shapes => (
              <ShapesCardItem
                key={shapes.uuid}
                shapes={shapes}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShapesPage;
