import { Button } from '@blueprintjs/core';
import CardItem from '../../../../components/CardItem';
import { ShapeSet } from '../../../../lib/api/shapes_api/types';

interface ShapesCardItemProps {
  shapes: ShapeSet;
  onDelete: (shapes: ShapeSet) => void;
}

const ShapesCardItem = ({ shapes, onDelete }: ShapesCardItemProps) => {
  return (
    <CardItem
      title={shapes.name}
      description={
        <p>
          <b>Description</b>: <br />
          {shapes.description}
        </p>
      }
      actions={
        <Button intent='danger' onClick={() => onDelete(shapes)}>
          Delete
        </Button>
      }
    />
  );
};

export default ShapesCardItem;
