import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  applyNodeChanges,
  getRectOfNodes,
  type OnConnectStartParams
} from 'reactflow';
import 'reactflow/dist/style.css'; 

import { ShaderNode } from './ShaderNode';
import ContextMenu from './ContextMenu';
import Legend from './Legend';
import Toolbar from './Toolbar';
import { NODE_REGISTRY } from '../nodes'; 
import { TYPE_COLORS } from '../core/theme';

const nodeTypes: NodeTypes = {
  shaderNode: ShaderNode,
};

const initialNodesDefault = [
  {
    id: 'out1',
    type: 'shaderNode',
    position: { x: 500, y: 100 },
    data: { definition: NODE_REGISTRY['output'] },
  },
];

interface Props {
  onChange?: (nodes: Node[], edges: Edge[]) => void;
}

const STORAGE_KEY = 'shader-nodes-save-v1';

const getLogicHash = (nodes: Node[], edges: Edge[]) => {
  const logicData = {
    nodes: nodes.map(n => ({ id: n.id, data: n.data })),
    edges: edges.map(e => ({ s: e.source, t: e.target, th: e.targetHandle }))
  };
  return JSON.stringify(logicData);
};

function EditorInner({ onChange }: Props) {
  const getInitialData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const restoredNodes = parsed.nodes.map((n: any) => {
            const defId = n.data.definition.id;
            const def = Object.values(NODE_REGISTRY).find(d => d.id === defId);
            return {
                ...n,
                data: { ...n.data, definition: def || NODE_REGISTRY['output'] }
            };
        });
        return { nodes: restoredNodes, edges: parsed.edges, viewport: parsed.viewport };
      } catch (e) {
        console.error("Auto-Save Load Error:", e);
      }
    }
    return { nodes: initialNodesDefault, edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  };

  const initialData = getInitialData();
  const [nodes, setNodes] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [clipboard, setClipboard] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);
  
  const reactFlowInstance = useReactFlow();
  
  // NOWE: Stan do trzymania informacji o typie filtru (dla Drag & Drop)
  const [menuFilter, setMenuFilter] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  
  // NOWE: Stan startu połączenia
  const connectionStartRef = useRef<OnConnectStartParams | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const lastLogicHash = useRef<string>("");
  const mousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (!isLoadedRef.current && initialData.viewport) {
        reactFlowInstance.setViewport(initialData.viewport);
        isLoadedRef.current = true;
    }
  }, [reactFlowInstance, initialData.viewport]);

  useEffect(() => {
    const dataToSave = {
      nodes: nodes.map(n => ({
        ...n,
        data: { definition: { id: n.data.definition.id }, value: n.data.value, label: n.data.label, min: n.data.min, max: n.data.max }
      })),
      edges,
      viewport: reactFlowInstance.getViewport()
    };
    
    const jsonString = JSON.stringify(dataToSave);
    localStorage.setItem(STORAGE_KEY, jsonString);
    
    const currentHash = getLogicHash(nodes, edges);
    if (currentHash !== lastLogicHash.current) {
        if (onChange) onChange(nodes, edges);
        lastLogicHash.current = currentHash;
    }
  }, [nodes, edges, onChange, reactFlowInstance]);

  const restoreGraph = (jsonString: string) => {
      try {
        const parsed = JSON.parse(jsonString);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const restoredNodes = parsed.nodes.map((n: any) => {
            const defId = n.data.definition.id;
            const def = Object.values(NODE_REGISTRY).find(d => d.id === defId);
            return {
                ...n,
                data: { ...n.data, definition: def || NODE_REGISTRY['output'] }
            };
        });
        setNodes(restoredNodes);
        setEdges(parsed.edges);
        if (parsed.viewport) reactFlowInstance.setViewport(parsed.viewport);
      } catch (e) {
          console.error("Restore Error:", e);
          alert("Nie udało się wczytać pliku.");
      }
  };

  const handleSaveFile = useCallback(() => {
      const dataToSave = {
        nodes: nodes.map(n => ({
            ...n,
            data: { definition: { id: n.data.definition.id }, value: n.data.value, label: n.data.label, min: n.data.min, max: n.data.max }
        })),
        edges,
        viewport: reactFlowInstance.getViewport()
      };
      
      const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shader_graph_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
  }, [nodes, edges, reactFlowInstance]);

  const handleLoadFileClick = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => { restoreGraph(event.target?.result as string); };
      reader.readAsText(file);
      e.target.value = ''; 
  }, [setNodes, setEdges, reactFlowInstance]);
  
  const handleClear = useCallback(() => {
      if(window.confirm("Czy na pewno chcesz wyczyścić wszystko?")) {
          setNodes(initialNodesDefault);
          setEdges([]);
          localStorage.removeItem(STORAGE_KEY);
      }
  }, [setNodes, setEdges]);

  // --- DELETE SELECTED FUNCTION ---
  const deleteSelected = useCallback(() => {
      // Filtrujemy nody: usuwamy te zaznaczone, ale Output musi zostać
      setNodes((nds) => nds.filter((n) => !n.selected || n.data.definition.id === 'output'));
      // Usuwamy zaznaczone krawędzie
      setEdges((eds) => eds.filter((e) => !e.selected));
  }, [setNodes, setEdges]);

  const onNodesChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onConnect: OnConnect = useCallback((params) => {
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        if (!sourceNode || !targetNode) { setEdges((eds) => addEdge(params, eds)); return; }

        const sourceDef = sourceNode.data.definition;
        const targetDef = targetNode.data.definition;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outputDef = sourceDef.outputs.find((o: any) => o.id === params.sourceHandle);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputDef = targetDef.inputs.find((i: any) => i.id === params.targetHandle);

        if (!outputDef || !inputDef) { setEdges((eds) => addEdge(params, eds)); return; }

        const sourceType = outputDef.type;
        const targetType = inputDef.type;

        if (targetType === 'float' && (sourceType === 'vec2' || sourceType === 'vec3' || sourceType === 'vec4')) {
            let splitNodeTypeId = '';
            if (sourceType === 'vec2') splitNodeTypeId = 'split_vec2';
            else if (sourceType === 'vec3') splitNodeTypeId = 'split_vec3';
            else if (sourceType === 'vec4') splitNodeTypeId = 'split_vec4';

            if (NODE_REGISTRY[splitNodeTypeId as keyof typeof NODE_REGISTRY]) {
                const splitNodeId = `auto_split_${Date.now()}`;
                const newX = (sourceNode.position.x + targetNode.position.x) / 2;
                const newY = (sourceNode.position.y + targetNode.position.y) / 2;
                const splitNode: Node = {
                    id: splitNodeId, type: 'shaderNode', position: { x: newX, y: newY },
                    data: { definition: NODE_REGISTRY[splitNodeTypeId as keyof typeof NODE_REGISTRY] }
                };
                setNodes((nds) => nds.concat(splitNode));
                const edge1: Edge = {
                    id: `e_${sourceNode.id}_${splitNodeId}`, source: sourceNode.id, sourceHandle: params.sourceHandle,
                    target: splitNodeId, targetHandle: 'in', style: { stroke: TYPE_COLORS[sourceType], strokeWidth: 3 }, animated: true
                };
                const edge2: Edge = {
                    id: `e_${splitNodeId}_${targetNode.id}`, source: splitNodeId, sourceHandle: 'x', 
                    target: targetNode.id, targetHandle: params.targetHandle, style: { stroke: TYPE_COLORS['float'], strokeWidth: 3 },
                };
                setEdges((eds) => [...eds, edge1, edge2]);
                return;
            }
        }
        
        const edgeColor = TYPE_COLORS[sourceType] || '#fff';
        const newEdge = { ...params, style: { stroke: edgeColor, strokeWidth: 3 }, animated: false };
        setEdges((eds) => addEdge(newEdge, eds));
    }, [nodes, setNodes, setEdges]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
      if(ref.current) {
          const bounds = ref.current.getBoundingClientRect();
          mousePos.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      }
  }, []);

  // --- UE STYLE DRAG & DROP LOGIC ---
  const onConnectStart = useCallback((_, params: OnConnectStartParams) => {
      connectionStartRef.current = params;
  }, []);

  const onConnectEnd = useCallback((event: any) => {
      // Sprawdzamy czy upuszczono na tło (pane)
      const targetIsPane = event.target.classList.contains('react-flow__pane');
      
      if (targetIsPane && connectionStartRef.current && ref.current) {
          // Użytkownik upuścił kabel na tło!
          const { nodeId, handleId, handleType } = connectionStartRef.current;
          const node = nodes.find(n => n.id === nodeId);
          
          if (node) {
              // Znajdź typ tego pinu
              let type = 'default';
              if (handleType === 'source') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const outDef = node.data.definition.outputs.find((o: any) => o.id === handleId);
                  if(outDef) type = outDef.type;
              } else {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const inDef = node.data.definition.inputs.find((i: any) => i.id === handleId);
                  if(inDef) type = inDef.type;
              }

              // Oblicz pozycję myszy
              const clientX = event.clientX;
              const clientY = event.clientY;

              // Otwórz menu z filtrem!
              setMenu({ x: clientX, y: clientY, visible: true });
              setMenuFilter(type); // Przekazujemy typ do filtra
          }
      }
      connectionStartRef.current = null;
  }, [nodes]);


  const handleCopy = useCallback(() => {
      const selectedNodes = nodes.filter(n => n.selected);
      if (selectedNodes.length === 0) return;
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
      const selectedEdges = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
      setClipboard({ nodes: selectedNodes, edges: selectedEdges });
  }, [nodes, edges]);

  const handlePaste = useCallback(() => {
      if (!clipboard) return;
      const bounds = getRectOfNodes(clipboard.nodes);
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const flowMousePos = reactFlowInstance.project(mousePos.current);
      const idMap: Record<string, string> = {};

      const newNodes = clipboard.nodes.map((node) => {
          const newId = `${node.data.definition.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          idMap[node.id] = newId;
          const offsetX = node.position.x - centerX;
          const offsetY = node.position.y - centerY;
          return {
              ...node, id: newId, position: { x: flowMousePos.x + offsetX, y: flowMousePos.y + offsetY },
              selected: true, data: { ...node.data }
          };
      });

      const newEdges = clipboard.edges.map((edge) => ({
          ...edge, id: `e_${idMap[edge.source]}_${idMap[edge.target]}_${Math.random()}`,
          source: idMap[edge.source], target: idMap[edge.target], selected: false
      }));
      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNodes));
      setEdges((eds) => eds.concat(newEdges));
  }, [clipboard, reactFlowInstance, setNodes, setEdges]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'c') handleCopy();
          if ((e.ctrlKey || e.metaKey) && e.key === 'v') handlePaste();
          if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected(); // Delete też działa
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, deleteSelected]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
      event.preventDefault(); 
      setMenu({ x: event.clientX, y: event.clientY, visible: true });
      setMenuFilter(null); // Prawy klik na tło = brak filtra (pokaż wszystko)
  }, []);

  const onAddNode = useCallback((typeId: string) => {
    if (!menu) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
    const isGroup = typeId === 'special_group';
    const newNode: Node = {
      id: `${typeId}_${Date.now()}`, type: 'shaderNode', position,
      data: { definition: NODE_REGISTRY[typeId as keyof typeof NODE_REGISTRY] },
      zIndex: isGroup ? -10 : 0,
      style: isGroup ? { width: 400, height: 300 } : undefined,
    };
    setNodes((nds) => isGroup ? [newNode, ...nds] : nds.concat(newNode));
  }, [menu, reactFlowInstance, setNodes]);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
      event.preventDefault(); setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, [setEdges]);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }} onMouseMove={onMouseMove}>
      <Toolbar onSave={handleSaveFile} onLoad={handleLoadFileClick} onClear={handleClear} />
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={4}
        fitView
        onPaneContextMenu={onPaneContextMenu} // <--- TO MUSI TU BYĆ
        onEdgeContextMenu={onEdgeContextMenu}
        // USUNIĘTE: onNodeContextMenu (żeby prawy klik nie usuwał noda)
        
        onConnectStart={onConnectStart} // <--- WAŻNE DLA DRAG & DROP
        onConnectEnd={onConnectEnd}     // <--- WAŻNE DLA DRAG & DROP

        onPaneClick={() => setMenu(null)}
        selectionOnDrag={true}
        panOnDrag={[1]} // Tylko środkowy
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Control"
        defaultEdgeOptions={{ type: 'default', interactionWidth: 25, style: { strokeWidth: 3 }}}
      >
        <Background color="#222" gap={20} />
        <Controls />
        <Legend /> 
        
        {/* KOSZ NA EKRANIE (Floating Action Button) */}
        <div 
            onClick={deleteSelected}
            title="Delete Selected (Del)"
            style={{
                position: 'absolute', bottom: 20, right: 20, zIndex: 3000,
                width: 50, height: 50, borderRadius: '50%',
                background: '#ff007a', color: 'white', fontSize: '24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
                transition: 'transform 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
        >
            🗑️
        </div>

        {menu && menu.visible && (
          <ContextMenu 
            x={menu.x} 
            y={menu.y} 
            onClose={() => setMenu(null)} 
            onAddNode={onAddNode}
            filterType={menuFilter} // Przekazujemy filtr
          />
        )}
      </ReactFlow>
    </div>
  );
}

export default function NodeEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}