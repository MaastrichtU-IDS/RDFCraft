import { Menu, MenuItem, showContextMenu } from '@blueprintjs/core';

import {
  addEdge,
  Background,
  Connection,
  ControlButton,
  Controls,
  EdgeChange,
  EdgeTypes,
  MarkerType,
  MiniMap,
  NodeChange,
  NodeTypes,
  OnConnectEnd,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useState } from 'react';
import { MappingGraph } from '../../../../lib/api/mapping_service/types';

import ConnectionLineComponent from '@/pages/mapping_page/components/MainPanel/components/ConnectionLineComponent';
import { EntityNode } from '@/pages/mapping_page/components/MainPanel/components/EntityNode';
import FloatingEdge from '@/pages/mapping_page/components/MainPanel/components/FloatingEdge';
import { LiteralNode } from '@/pages/mapping_page/components/MainPanel/components/LiteralNode';

import { URIRefNode } from '@/pages/mapping_page/components/MainPanel/components/URIRefNode';
import { useBackendMappingGraph } from '@/pages/mapping_page/hooks/useBackendMappingGraph';
import useMappingPage from '@/pages/mapping_page/state';
import {
  EntityNodeType,
  LiteralNodeType,
  URIRefNodeType,
  XYEdgeType,
  XYNodeTypes,
} from './types';

import { Trash } from '@blueprintjs/icons';
import { v4 as uuidv4 } from 'uuid';

type MainPanelProps = {
  initialGraph: MappingGraph | null;
};
const nodeTypes: NodeTypes = {
  entity: EntityNode,
  uri_ref: URIRefNode,
  literal: LiteralNode,
};

const edgeTypes: EdgeTypes = {
  floating: FloatingEdge,
};

const defaultEdgeOptions = {
  type: 'floating',
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
  style: {
    stroke: '#b1b1b7',
    strokeWidth: 4,
  },
};

const MainPanel = ({ initialGraph }: MainPanelProps) => {
  const reactflow = useReactFlow();
  const setIsSaved = useMappingPage(state => state.setIsSaved);
  const { nodes: initialNodes, edges: initialEdges } =
    useBackendMappingGraph(initialGraph);
  const [dropConnection, setDropConnection] = useState<{
    source: string;
    sourceHandle: string;
  } | null>(null);
  const [newNode, setNewNode] = useState<XYNodeTypes | null>(null);

  const [nodes, setNodes, xyOnNodesChange] = useNodesState<XYNodeTypes>([]);
  const [edges, setEdges, xyOnEdgesChange] = useEdgesState<XYEdgeType>([]);
  const [ignoreNodesChange, setIgnoreNodesChange] = useState(false);

  const onNodesChange = useCallback(
    (nodes: NodeChange<XYNodeTypes>[]) => {
      setIsSaved(ignoreNodesChange);
      if (ignoreNodesChange) {
        setIgnoreNodesChange(false);
      }
      xyOnNodesChange(nodes);
    },
    [setIsSaved, ignoreNodesChange, xyOnNodesChange],
  );

  const onEdgesChange = useCallback(
    (edges: EdgeChange<XYEdgeType>[]) => {
      setIsSaved(ignoreNodesChange);
      if (ignoreNodesChange) {
        setIgnoreNodesChange(false);
      }
      xyOnEdgesChange(edges);
    },
    [setIsSaved, xyOnEdgesChange, ignoreNodesChange],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setIsSaved(ignoreNodesChange);
      if (ignoreNodesChange) {
        setIgnoreNodesChange(false);
      }
      setEdges(edges => addEdge(params, edges));
    },
    [setEdges, setIsSaved, ignoreNodesChange],
  );

  const screenToFlowPosition = reactflow.screenToFlowPosition;

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    reactflow.fitView({
      duration: 500,
      maxZoom: 1,
      padding: 0.1,
      minZoom: 0.1,
    });
    setIgnoreNodesChange(true);
  }, [initialNodes, initialEdges, setNodes, setEdges, reactflow]);

  useEffect(() => {
    if (dropConnection && newNode) {
      setEdges(edges =>
        addEdge(
          {
            source: dropConnection.source,
            target: newNode.id,
            sourceHandle: dropConnection.sourceHandle,
            targetHandle: newNode.id,
          },
          edges,
        ),
      );
      setDropConnection(null);
      setNewNode(null);
    }
  }, [dropConnection, newNode, setEdges]);

  const handleAddEntityNode = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const id = uuidv4();
      const newNode = {
        id: id,
        data: {
          id: id,
          label: 'New Entity',
          rdf_type: [],
          uri_pattern: '',
          properties: [],
          type: 'entity',
          position: position,
        },
        position: position,
        type: 'entity',
        selected: true,
      } as EntityNodeType;
      setNodes(nodes => [...nodes, newNode]);
      setNewNode(newNode);
    },
    [setNodes, screenToFlowPosition, setNewNode],
  );

  const handleAddUriRefNode = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const id = uuidv4();
      const newNode = {
        id: id,
        data: {
          id: id,
          uri_pattern: '',
          type: 'uri_ref',
          position: position,
        },
        position: position,
        type: 'uri_ref',
        selected: true,
      } as URIRefNodeType;
      setNodes(nodes => [...nodes, newNode]);
      setNewNode(newNode);
    },
    [setNodes, screenToFlowPosition, setNewNode],
  );

  const handleAddLiteralNode = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const id = uuidv4();
      const newNode = {
        id: id,
        data: {
          id: id,
          label: 'New Literal',
          value: '',
          literal_type: '',
          type: 'literal',
          position: position,
        },
        position: position,
        type: 'literal',
        selected: true,
      } as LiteralNodeType;
      setNodes(nodes => [...nodes, newNode]);
      setNewNode(newNode);
    },
    [setNodes, screenToFlowPosition, setNewNode],
  );

  const openMenu = useCallback(
    (targetOffset: { left: number; top: number }) => {
      showContextMenu({
        content: (
          <Menu>
            <MenuItem text='Create Node' onClick={handleAddEntityNode} />
            <MenuItem
              text='Create URI Reference'
              onClick={handleAddUriRefNode}
            />
            <MenuItem text='Create Literal' onClick={handleAddLiteralNode} />
          </Menu>
        ),
        targetOffset,
        isDarkTheme: true,
      });
    },
    [handleAddEntityNode, handleAddLiteralNode, handleAddUriRefNode],
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, { fromNode, fromHandle }) => {
      const targetIsPane =
        event.target instanceof HTMLElement &&
        event.target.classList.contains('react-flow__pane');

      if (
        targetIsPane &&
        fromNode &&
        fromHandle &&
        fromHandle.type === 'source'
      ) {
        if (!fromHandle.id) throw new Error('fromHandle.id is undefined');

        setDropConnection({
          source: fromNode.id,
          sourceHandle: fromHandle.id,
        });
        setNewNode(null);

        if (event instanceof MouseEvent)
          openMenu({
            left: event.clientX,
            top: event.clientY,
          });
        else if (event instanceof TouchEvent)
          openMenu({
            left: event.touches[0].clientX,
            top: event.touches[0].clientY,
          });
      }
    },
    [openMenu],
  );

  const onDelete = useCallback(() => {
    setNodes(nodes => nodes.filter(n => (n.selected ?? false) === false));
    setEdges(edges => edges.filter(e => (e.selected ?? false) === false));
  }, [setNodes, setEdges]);

  return (
    // disable default right click menu
    <div className='main-panel'>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineComponent={ConnectionLineComponent}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        colorMode='dark'
        onContextMenu={e => {
          e.preventDefault();
          openMenu({
            left: e.clientX,
            top: e.clientY,
          });
        }}
        onConnectEnd={onConnectEnd}
      >
        <Background bgColor='#1C2127' gap={16} size={1} />
        <MiniMap
          nodeColor={n => {
            if (n.type === 'entity') return '#ff0072';
            if (n.type === 'uri_ref') return '#00ff00';
            if (n.type === 'literal') return '#0057ff';
            return '#eee';
          }}
          pannable
        />
        <Controls>
          <ControlButton onClick={onDelete}>
            <Trash />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
};

export default MainPanel;
