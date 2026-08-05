import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import ShapesApi from '../../lib/api/shapes_api';
import { ShapeSet } from '../../lib/api/shapes_api/types';
import { ZustandActions } from '../../utils/zustand';

interface ShapesPageState {
  shapeSets: ShapeSet[] | null;
  isLoading: string | null;
  error: string | null;
}

interface ShapesPageStateActions {
  refreshShapeSets: (workspaceUuid: string) => void;
  createShapes: (
    workspaceUuid: string,
    data: {
      name: string;
      description: string;
      file: File;
    },
  ) => void;
  deleteShapes: (workspaceUuid: string, shapesUuid: string) => void;
}

const defaultState: ShapesPageState = {
  shapeSets: null,
  isLoading: null,
  error: null,
};

const functions: ZustandActions<ShapesPageStateActions, ShapesPageState> = (
  set,
  get,
) => ({
  refreshShapeSets(workspaceUuid: string) {
    set({ isLoading: 'Loading shape sets...' });
    ShapesApi.getShapesInWorkspace(workspaceUuid)
      .then(shapeSets => {
        set({ shapeSets, error: null });
      })
      .catch(error => {
        if (error instanceof Error) {
          set({ error: error.message });
        }
      })
      .finally(() => {
        set({ isLoading: null });
      });
  },
  createShapes(workspaceUuid, data) {
    set({ isLoading: 'Creating shape set...' });
    ShapesApi.createShapesInWorkspace(
      workspaceUuid,
      data.name,
      data.description,
      data.file,
    )
      .then(() => {
        get().refreshShapeSets(workspaceUuid);
      })
      .catch(error => {
        if (error instanceof Error) {
          set({ error: error.message });
        }
      })
      .finally(() => {
        set({ isLoading: null });
      });
  },
  deleteShapes(workspaceUuid, shapesUuid) {
    set({ isLoading: 'Deleting shape set...' });
    ShapesApi.deleteShapesInWorkspace(workspaceUuid, shapesUuid)
      .then(() => {
        get().refreshShapeSets(workspaceUuid);
      })
      .catch(error => {
        if (error instanceof Error) {
          set({ error: error.message });
        }
      })
      .finally(() => {
        set({ isLoading: null });
      });
  },
});

const useShapesPageState = create<ShapesPageState & ShapesPageStateActions>()(
  devtools((set, get) => ({
    ...defaultState,
    ...functions(set, get),
  })),
);

export default useShapesPageState;
