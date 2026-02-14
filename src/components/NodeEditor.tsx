import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, {
  addEdge, Background, Controls, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider,
  type Node, type Edge, type OnConnect, type NodeTypes, applyNodeChanges, getRectOfNodes, type OnConnectStartParams
} from 'reactflow';
import 'reactflow/dist/style.css'; 

import { ShaderNode } from './ShaderNode';
import { PreviewNode } from './PreviewNode';
import { MonitorNode } from './MonitorNode';
import ContextMenu from './ContextMenu';
import NodeContextMenu from './NodeContextMenu';
import CreateCustomNodeDialog from './CreateCustomNodeDialog';
import { addCustomNode, extractCustomNodePorts, loadCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import type { ShaderNodeDefinition } from '../core/types';
import Legend from './Legend';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import { NODE_REGISTRY } from '../nodes'; 
import { TYPE_COLORS } from '../core/theme';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { validateConnection } from '../core/connectionValidator';

const initialNodesDefault = [
  { id: 'out1', type: 'shaderNode', position: { x: 500, y: 100 }, data: { definition: NODE_REGISTRY['output'] } },
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
  // FIX: Memoizacja nodeTypes - WAŻNE!
  const nodeTypes = useMemo<NodeTypes>(() => ({
    shaderNode: ShaderNode,
    previewNode: PreviewNode,
    monitorNode: MonitorNode,
  }), []);

  const getInitialData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const restoredNodes = parsed.nodes.map((n: any) => {
            const defId = n.data.definition.id;
            const def = Object.values(NODE_REGISTRY).find(d => d.id === defId);
            let type = 'shaderNode';
            if (defId === 'preview') type = 'previewNode';
            if (defId === 'monitor') type = 'monitorNode';
            return {
                ...n, type,
                data: { ...n.data, definition: def || NODE_REGISTRY['output'] }
            };
        });
        return { nodes: restoredNodes, edges: parsed.edges, viewport: parsed.viewport };
      } catch (e) { console.error("Load Error:", e); }
    }
    return { nodes: initialNodesDefault, edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  };

  const initialData = getInitialData();
  const [nodes, setNodes] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [clipboard, setClipboard] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50;
  const reactFlowInstance = useReactFlow();
  
  const [menuFilter, setMenuFilter] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; visible: boolean; type: 'pane' | 'node'; nodeId?: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  
  // Navigation stack for custom nodes
  const [navigationStack, setNavigationStack] = useState<Array<{ name: string; nodes: Node[]; edges: Edge[] }>>([]);
  const [currentContext, setCurrentContext] = useState<string>('Main'); // 'Main' or custom node name
  
  const [pendingConnection, setPendingConnection] = useState<OnConnectStartParams | null>(null);
  const connectionStartRef = useRef<OnConnectStartParams | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastLogicHash = useRef<string>("");
  const mousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const isLoadedRef = useRef(false);
  
  // Load custom nodes into registry on mount
  useEffect(() => {
    const customNodes = loadCustomNodes();
    customNodes.forEach(customNode => {
      (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[customNode.id] = customNode;
    });
  }, []);

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

  const restoreGraph = useCallback((jsonString: string, filePath?: string) => {
      try {
        const parsed = JSON.parse(jsonString);
        const restoredNodes = parsed.nodes.map((n: { data: { definition: { id: string } } }) => {
            const defId = n.data.definition.id;
            const def = Object.values(NODE_REGISTRY).find(d => d.id === defId);
            let type = 'shaderNode';
            if (defId === 'preview') type = 'previewNode';
            if (defId === 'monitor') type = 'monitorNode';
            return {
                ...n, type,
                data: { ...n.data, definition: def || NODE_REGISTRY['output'] }
            };
        });
        
        // Auto-adapt Smart Split and Relay nodes based on existing connections
        const adaptedNodes = restoredNodes.map((node: Node) => {
          const def = node.data.definition;
          
          // Smart Split - adapt based on input edge
          if (def.id === 'smart_split') {
            const inputEdge = parsed.edges.find((e: Edge) => e.target === node.id && e.targetHandle === 'in');
            if (inputEdge) {
              const sourceNode = restoredNodes.find((n: Node) => n.id === inputEdge.source);
              if (sourceNode) {
                const sourceDef = sourceNode.data.definition;
                const outputDef = sourceDef.outputs.find((o: { id: string; type: string }) => o.id === inputEdge.sourceHandle);
                if (outputDef) {
                  const type = outputDef.type;
                  let newOutputs = def.outputs;
                  let newInputLabel = 'Input';
                  const createOutput = (id: string, label: string) => ({ id, label, type: 'float' as const });
                  
                  if (type === 'vec2') { 
                    newOutputs = [createOutput('x', 'X'), createOutput('y', 'Y')]; 
                    newInputLabel = 'Vec2'; 
                  } else if (type === 'vec3') { 
                    newOutputs = [createOutput('x', 'R'), createOutput('y', 'G'), createOutput('z', 'B')]; 
                    newInputLabel = 'Vec3'; 
                  } else if (type === 'vec4') { 
                    newOutputs = [createOutput('x', 'R'), createOutput('y', 'G'), createOutput('z', 'B'), createOutput('w', 'A')]; 
                    newInputLabel = 'Vec4'; 
                  } else if (type === 'float') {
                    newOutputs = [createOutput('x', 'Value')];
                    newInputLabel = 'Float';
                  }
                  
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      definition: {
                        ...def,
                        inputs: [{ id: 'in', label: newInputLabel, type: type }],
                        outputs: newOutputs
                      }
                    }
                  };
                }
              }
            }
          }
          
          // Relay Auto - adapt based on input edge
          if (def.id === 'relay_auto') {
            const inputEdge = parsed.edges.find((e: Edge) => e.target === node.id && e.targetHandle === 'in');
            if (inputEdge) {
              const sourceNode = restoredNodes.find((n: Node) => n.id === inputEdge.source);
              if (sourceNode) {
                const sourceDef = sourceNode.data.definition;
                const outputDef = sourceDef.outputs.find((o: { id: string; type: string }) => o.id === inputEdge.sourceHandle);
                if (outputDef) {
                  const sourceType = outputDef.type;
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      definition: {
                        ...def,
                        inputs: [{ id: 'in', label: sourceType, type: sourceType }],
                        outputs: [{ id: 'out', label: sourceType, type: sourceType }]
                      }
                    }
                  };
                }
              }
            }
          }
          
          return node;
        });
        
        setNodes(adaptedNodes);
        setEdges(parsed.edges);
        if (parsed.viewport) reactFlowInstance.setViewport(parsed.viewport);
        if (filePath) setCurrentFilePath(filePath);
      } catch (err) { 
          console.error("Error loading graph:", err);
      }
  }, [setNodes, setEdges, reactFlowInstance]);

  const handleSaveFile = useCallback((saveAs = false) => {
      const dataToSave = {
        nodes: nodes.map(n => ({ ...n, data: { definition: { id: n.data.definition.id }, value: n.data.value, label: n.data.label, min: n.data.min, max: n.data.max } })),
        edges, viewport: reactFlowInstance.getViewport()
      };
      const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      let filename = currentFilePath || `shader_graph_${Date.now()}.json`;
      if (saveAs || !currentFilePath) {
        const baseName = currentFilePath ? currentFilePath.split(/[/\\]/).pop()?.replace('.json', '') : 'shader_graph';
        filename = prompt('Save as:', baseName || 'shader_graph')?.trim() || filename;
        if (!filename.endsWith('.json')) filename += '.json';
      }
      
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = filename; 
      a.click(); 
      URL.revokeObjectURL(url);
      
      setCurrentFilePath(filename);
  }, [nodes, edges, reactFlowInstance, currentFilePath]);

  const handleLoadFileClick = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader(); 
      reader.onload = (event) => { 
          if (event.target?.result) {
              restoreGraph(event.target.result as string, file.name); 
          }
      }; 
      reader.readAsText(file); 
      e.target.value = ''; 
  }, [restoreGraph]);
  
  // Undo/Redo history management
  const saveToHistory = useCallback(() => {
    const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      return newHistory.slice(-maxHistorySize);
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [nodes, edges, historyIndex, maxHistorySize]);
  
  // Auto-save to history on changes (debounced)
  useEffect(() => {
    const currentHash = getLogicHash(nodes, edges);
    if (currentHash !== lastLogicHash.current && nodes.length > 0) {
      const timeoutId = setTimeout(() => {
        saveToHistory();
      }, 2000); // 2 second debounce
      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges, saveToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);
  
  const handleClear = useCallback(() => {
      if(window.confirm("Clear all nodes?")) { 
        saveToHistory();
        setNodes(initialNodesDefault); 
        setEdges([]); 
        localStorage.removeItem(STORAGE_KEY); 
        setCurrentFilePath(null);
      }
  }, [setNodes, setEdges, saveToHistory]);
  
  const handleCreateCustomNode = useCallback((name: string, description: string) => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      alert('Please select nodes to create a custom node.');
      return;
    }
    
    // Extract selected nodes and their edges
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdges = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
    
    // Extract inputs and outputs from Custom Input/Output nodes
    const ports = extractCustomNodePorts({ nodes: selectedNodes });
    
    // Allow empty custom nodes - add placeholder output if none exist
    const finalOutputs = ports.outputs.length > 0 
      ? ports.outputs 
      : [{ id: 'out', label: 'Out', type: 'vec3' }];
    
    // Create custom node definition
    const customNodeId = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const customNode: CustomNodeDefinition = {
      id: customNodeId,
      label: name,
      description: description || `Custom node: ${name}`,
      compact: false,
      inputs: ports.inputs,
      outputs: finalOutputs,
      isCustom: true,
      subgraph: {
        nodes: selectedNodes,
        edges: selectedEdges
      },
      glslTemplate: () => {
        // Placeholder - actual compilation happens in compiler.ts via recursive subgraph compilation
        return 'vec3(1.0, 0.0, 1.0)'; // Magenta error color (should never be used)
      },
    };
    
    // Save to storage
    addCustomNode(customNode);
    
    // Add to NODE_REGISTRY dynamically
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[customNodeId] = customNode;
    
    // Trigger sidebar refresh
    window.dispatchEvent(new Event('customNodesUpdated'));
    
    alert(`✅ Custom node "${name}" created!\n\nYou can now find it in the sidebar under "Custom Nodes" category.`);
    
    // Optionally delete selected nodes after creating custom
    // setNodes((nds) => nds.filter(n => !selectedNodeIds.has(n.id)));
    // setEdges((eds) => eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
  }, [nodes, edges]);
  
  const enterCustomNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const def = node.data.definition;
    if (!('isCustom' in def) || !def.isCustom) return;
    
    const customDef = def as CustomNodeDefinition;
    
    // Save current state to navigation stack
    setNavigationStack(prev => [...prev, { name: currentContext, nodes, edges }]);
    
    // Load subgraph
    setCurrentContext(def.label);
    setNodes(customDef.subgraph.nodes);
    setEdges(customDef.subgraph.edges);
  }, [nodes, edges, currentContext, setNodes, setEdges]);
  
  const navigateBack = useCallback(() => {
    if (navigationStack.length === 0) return;
    
    const previous = navigationStack[navigationStack.length - 1];
    setNavigationStack(prev => prev.slice(0, -1));
    setCurrentContext(previous.name);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [navigationStack, setNodes, setEdges]);

  const deleteSelected = useCallback(() => {
      setNodes((nds) => nds.filter((n) => !n.selected || n.data.definition.id === 'output'));
      setEdges((eds) => eds.filter((e) => !e.selected));
  }, [setNodes, setEdges]);

  const handleShowCode = useCallback(() => {
      const safeNodes: GraphNode[] = nodes.map(node => ({
        id: node.id, type: node.type || 'shaderNode', data: node.data
      }));
      const code = compileGraphToGLSL(safeNodes, edges);
      setCurrentCode(code);
      setShowCode(true);
  }, [nodes, edges]);

  const getUniqueLabel = (def: { id: string; label: string }, existingNodes: Node[]) => {
      let newLabel = def.label;
      if (def.id === 'param_float' || def.id === 'param_color') {
          let counter = 1;
          let uniqueNameFound = false;
          while (!uniqueNameFound) {
              const potentialName = counter === 1 ? def.label : `${def.label} ${counter}`;
              const exists = existingNodes.some(n => (n.data.label || n.data.definition.label) === potentialName);
              if (!exists) { newLabel = potentialName; uniqueNameFound = true; } else { counter++; }
          }
      }
      return newLabel;
  };

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const typeId = event.dataTransfer.getData('application/reactflow');
    if (!typeId) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const isGroup = typeId === 'special_group';
    const isPreview = typeId === 'preview';
    const isMonitor = typeId === 'monitor';
    const def = NODE_REGISTRY[typeId as keyof typeof NODE_REGISTRY];
    const newLabel = getUniqueLabel(def, nodes);
    const newNode: Node = {
      id: `${typeId}_${Date.now()}`,
      type: isPreview ? 'previewNode' : (isMonitor ? 'monitorNode' : 'shaderNode'),
      position,
      data: { definition: def, label: newLabel, value: def.controls?.defaultValue },
      zIndex: isGroup ? -10 : 0,
      style: isGroup ? { width: 400, height: 300 } : undefined,
    };
    setNodes((nds) => isGroup ? [newNode, ...nds] : nds.concat(newNode));
  }, [reactFlowInstance, setNodes, nodes]);

  const onNodesChange = useCallback(
    (changes: { type: string; id?: string }[]) => {
      // Check if any deletion would remove the last output node
      const deletions = changes.filter(c => c.type === 'remove');
      
      if (deletions.length > 0) {
        const remainingNodes = nodes.filter(n => 
          !deletions.some(d => d.id === n.id)
        );
        
        const outputNodesAfterDeletion = remainingNodes.filter(n => 
          n.data.definition?.id === 'output'
        );
        
        // Block deletion if it would remove the last output node
        const deletingOutputs = deletions.filter(d => {
          const node = nodes.find(n => n.id === d.id);
          return node?.data.definition?.id === 'output';
        });
        
        if (deletingOutputs.length > 0 && outputNodesAfterDeletion.length === 0) {
          console.warn('❌ Cannot delete the last Output node');
          alert('Cannot delete the last Output node!\n\nAt least one Output node must remain in the graph.');
          return; // Block the deletion
        }
      }
      
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes, nodes]
  );

  const onConnect: OnConnect = useCallback((params) => {
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        if (!sourceNode || !targetNode) { 
            setEdges((eds) => addEdge(params, eds)); 
            return; 
        }

        const sourceDef = sourceNode.data.definition; 
        const targetDef = targetNode.data.definition;
        const outputDef = sourceDef.outputs.find((o: { id: string; type: string }) => o.id === params.sourceHandle);
        const inputDef = targetDef.inputs.find((i: { id: string; type: string }) => i.id === params.targetHandle);
        
        if (!outputDef) { 
            setEdges((eds) => addEdge(params, eds)); 
            return; 
        }

        const sourceType = outputDef.type;

        // === SINGLE CONNECTION PER INPUT ===
        // Remove any existing connection to the target input port
        if (params.target && params.targetHandle) {
            setEdges((eds) => eds.filter(edge => 
                !(edge.target === params.target && edge.targetHandle === params.targetHandle)
            ));
        }

        // === AUTO TYPE ADAPTATION ===
        
        // Smart Split Node - adapts outputs based on input type
        if (targetDef.id === 'smart_split' && inputDef?.type === 'auto') {
            const type = sourceType;
            let newOutputs = targetDef.outputs;
            let newInputLabel = 'Input';
            const createOutput = (id: string, label: string) => ({ id, label, type: 'float' as const });
            
            if (type === 'vec2') { 
                newOutputs = [createOutput('x', 'X'), createOutput('y', 'Y')]; 
                newInputLabel = 'Vec2'; 
            } else if (type === 'vec3') { 
                newOutputs = [createOutput('x', 'R'), createOutput('y', 'G'), createOutput('z', 'B')]; 
                newInputLabel = 'Vec3'; 
            } else if (type === 'vec4') { 
                newOutputs = [createOutput('x', 'R'), createOutput('y', 'G'), createOutput('z', 'B'), createOutput('w', 'A')]; 
                newInputLabel = 'Vec4'; 
            } else if (type === 'float') {
                newOutputs = [createOutput('x', 'Value')];
                newInputLabel = 'Float';
            }
            
            setNodes(nds => nds.map(n => {
                if (n.id === targetNode.id) {
                    console.log('✅ Smart Split adapted:', {
                        nodeId: n.id,
                        from: n.data.definition.outputs.map((o: {id: string}) => o.id),
                        to: newOutputs.map(o => o.id),
                        inputType: type
                    });
                    return { 
                        ...n, 
                        data: { 
                            ...n.data, 
                            definition: { 
                                ...n.data.definition, 
                                inputs: [{ id: 'in', label: newInputLabel, type: type }], 
                                outputs: newOutputs 
                            } 
                        } 
                    }
                }
                return n;
            }));
        }

        // Auto Relay Node - adapts to passthrough type
        if (targetDef.id === 'relay_auto' && inputDef?.type === 'auto') {
            // Target is relay_auto, adapt it to source type
            setNodes(nds => nds.map(n => {
                if (n.id === targetNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            definition: {
                                ...n.data.definition,
                                inputs: [{ id: 'in', label: sourceType, type: sourceType }],
                                outputs: [{ id: 'out', label: sourceType, type: sourceType }]
                            }
                        }
                    }
                }
                return n;
            }));
        }
        
        if (sourceDef.id === 'relay_auto' && outputDef.type === 'auto' && inputDef) {
            // Source is relay_auto with auto output, adapt it to target input type
            const targetType = inputDef.type;
            setNodes(nds => nds.map(n => {
                if (n.id === sourceNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            definition: {
                                ...n.data.definition,
                                inputs: [{ id: 'in', label: targetType, type: targetType }],
                                outputs: [{ id: 'out', label: targetType, type: targetType }]
                            }
                        }
                    }
                }
                return n;
            }));
        }

        // Validate connection using our validator
        if (inputDef) {
            const targetType = inputDef.type;
            const validation = validateConnection(
                sourceType as 'float' | 'vec2' | 'vec3' | 'vec4' | 'auto', 
                targetType as 'float' | 'vec2' | 'vec3' | 'vec4' | 'auto'
            );
            
            // BLOCK invalid connections
            if (!validation.valid) {
                console.warn(`❌ Connection blocked: ${sourceType} → ${targetType}`);
                console.warn(`Reason: ${validation.reason}`);
                
                // Show user-friendly error message
                alert(`Cannot connect ${sourceType} to ${targetType}\n\n${validation.reason}`);
                return; // Block the connection
            }

            // Connection is valid - create edge
            const edgeColor = TYPE_COLORS[sourceType] || '#fff';
            const newEdge = { ...params, style: { stroke: edgeColor, strokeWidth: 3 }, animated: false };
            setEdges((eds) => addEdge(newEdge, eds));
        }
    }, [nodes, setNodes, setEdges]);

  const onMouseMove = useCallback((e: React.MouseEvent) => { if(ref.current) { const bounds = ref.current.getBoundingClientRect(); mousePos.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top }; } }, []);
  const onConnectStart = useCallback((_, params: OnConnectStartParams) => { connectionStartRef.current = params; }, []);
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      const targetIsPane = target.classList.contains('react-flow__pane');
      if (targetIsPane && connectionStartRef.current && ref.current) {
          const { nodeId, handleId, handleType } = connectionStartRef.current;
          const node = nodes.find(n => n.id === nodeId);
          if (node) {
              let type = 'default';
              if (handleType === 'source') { 
                  const outDef = node.data.definition.outputs.find((o: { id: string; type: string }) => o.id === handleId); 
                  if(outDef) type = outDef.type; 
              } else { 
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const inDef = node.data.definition.inputs.find((i: any) => i.id === handleId); if(inDef) type = inDef.type; 
              }
              const clientX = event.clientX; const clientY = event.clientY;
              setMenu({ x: clientX, y: clientY, visible: true, type: 'pane' }); setMenuFilter(type); setPendingConnection(connectionStartRef.current);
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
  
  const handleCut = useCallback(() => {
    handleCopy();
    deleteSelected();
  }, [handleCopy, deleteSelected]);
  
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
      return { ...node, id: newId, position: { x: flowMousePos.x + offsetX, y: flowMousePos.y + offsetY }, selected: true, data: { ...node.data } }; 
    }); 
    const newEdges = clipboard.edges.map((edge) => ({ 
      ...edge, 
      id: `e_${idMap[edge.source]}_${idMap[edge.target]}_${Math.random()}`, 
      source: idMap[edge.source], 
      target: idMap[edge.target], 
      selected: false 
    })); 
    setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNodes)); 
    setEdges((eds) => eds.concat(newEdges)); 
  }, [clipboard, reactFlowInstance, setNodes, setEdges]);
  useEffect(() => { 
    const handleKeyDown = (e: KeyboardEvent) => { 
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') handleCopy(); 
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') handleCut();
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') handlePaste(); 
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSaveFile(false); }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected(); 
    }; 
    window.addEventListener('keydown', handleKeyDown); 
    return () => window.removeEventListener('keydown', handleKeyDown); 
  }, [handleCopy, handleCut, handlePaste, deleteSelected, undo, redo, handleSaveFile]);
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => { 
    event.preventDefault(); 
    // Store mouse position for paste
    mousePos.current = { x: event.clientX, y: event.clientY };
    setMenu({ x: event.clientX, y: event.clientY, visible: true, type: 'pane' }); 
    setMenuFilter(null); 
    setPendingConnection(null); 
  }, []);
  const onAddNode = useCallback((typeId: string) => { 
    if (!menu) return; 
    const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y }); 
    const isGroup = typeId === 'special_group'; 
    const isPreview = typeId === 'preview'; 
    const isMonitor = typeId === 'monitor'; 
    let def = NODE_REGISTRY[typeId as keyof typeof NODE_REGISTRY]; 
    const newLabel = getUniqueLabel(def, nodes); 
    const newNodeId = `${typeId}_${Date.now()}`;
    
    // === AUTO TYPE PRE-ADAPTATION ===
    // If adding an auto-type node via drag-to-add, adapt it BEFORE creating the node
    if (pendingConnection && menuFilter) {
      const { handleType } = pendingConnection;
      
      // Adapt relay_auto
      if (typeId === 'relay_auto') {
        def = {
          ...def,
          inputs: [{ id: 'in', label: menuFilter, type: menuFilter as DataType }],
          outputs: [{ id: 'out', label: menuFilter, type: menuFilter as DataType }]
        };
      }
      
      // Adapt smart_split
      if (typeId === 'smart_split' && handleType === 'source') {
        const type = menuFilter;
        let newOutputs = def.outputs;
        let newInputLabel = 'Input';
        const createOutput = (id: string, label: string) => ({ id, label, type: 'float' as const });
        
        if (type === 'vec2') { 
          newOutputs = [createOutput('x', 'X'), createOutput('y', 'Y')]; 
          newInputLabel = 'Vec2'; 
        } else if (type === 'vec3') { 
          newOutputs = [createOutput('x', 'R'), createOutput('y', 'G'), createOutput('z', 'B')]; 
          newInputLabel = 'Vec3'; 
        } else if (type === 'vec4') { 
          newOutputs = [createOutput('x', 'R'), createOutput('y', 'G'), createOutput('z', 'B'), createOutput('w', 'A')]; 
          newInputLabel = 'Vec4'; 
        } else if (type === 'float') {
          newOutputs = [createOutput('x', 'Value')];
          newInputLabel = 'Float';
        }
        
        def = {
          ...def,
          inputs: [{ id: 'in', label: newInputLabel, type: type as DataType }],
          outputs: newOutputs
        };
      }
    }
    
    const newNode: Node = { 
      id: newNodeId, 
      type: isPreview ? 'previewNode' : (isMonitor ? 'monitorNode' : 'shaderNode'), 
      position, 
      data: { definition: def, label: newLabel, value: def.controls?.defaultValue }, 
      zIndex: isGroup ? -10 : 0, 
      style: isGroup ? { width: 400, height: 300 } : undefined, 
    }; 
    setNodes((nds) => isGroup ? [newNode, ...nds] : nds.concat(newNode)); 
    
    if (pendingConnection) { 
      const { nodeId, handleId, handleType } = pendingConnection; 
      let newEdge: Edge | null = null; 
      if (handleType === 'source') { 
        const input = def.inputs[0]; 
        if (input) { 
          newEdge = { id: `e_${nodeId}_${newNodeId}`, source: nodeId, sourceHandle: handleId, target: newNodeId, targetHandle: input.id, style: { stroke: '#fff', strokeWidth: 3 } }; 
        } 
      } else { 
        const output = def.outputs[0]; 
        if (output) { 
          newEdge = { id: `e_${newNodeId}_${nodeId}`, source: newNodeId, sourceHandle: output.id, target: nodeId, targetHandle: handleId, style: { stroke: '#fff', strokeWidth: 3 } }; 
        } 
      } 
      if (newEdge) { 
        setEdges((eds) => addEdge(newEdge!, eds)); 
      } 
      setPendingConnection(null); 
    } 
    setMenu(null);
  }, [menu, reactFlowInstance, setNodes, pendingConnection, setEdges, nodes, menuFilter]);
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => { 
    event.preventDefault(); 
    setEdges((eds) => eds.filter((e) => e.id !== edge.id)); 
  }, [setEdges]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, visible: true, type: 'node', nodeId: node.id });
  }, []);
  
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Double-click custom node to enter its subgraph
    if ('isCustom' in node.data.definition && node.data.definition.isCustom) {
      enterCustomNode(node.id);
    }
  }, [enterCustomNode]);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }} onMouseMove={onMouseMove}>
      <Toolbar 
        onSave={handleSaveFile} 
        onLoad={handleLoadFileClick} 
        onClear={handleClear} 
        onShowCode={handleShowCode}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        currentFile={currentFilePath}
        breadcrumbs={['Main', ...navigationStack.map(s => s.name), currentContext].filter((v, i, a) => a.indexOf(v) === i)}
        onNavigateBack={navigateBack}
      />
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />
      <ReactFlow
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} minZoom={0.1} maxZoom={4} fitView
        onPaneContextMenu={onPaneContextMenu} onNodeContextMenu={onNodeContextMenu} onNodeDoubleClick={onNodeDoubleClick} onEdgeContextMenu={onEdgeContextMenu} onConnectStart={onConnectStart} onConnectEnd={onConnectEnd} onPaneClick={() => setMenu(null)} selectionOnDrag={true} panOnDrag={[1]} selectionKeyCode="Shift" multiSelectionKeyCode="Control" defaultEdgeOptions={{ type: 'default', interactionWidth: 25, style: { strokeWidth: 3 }}}
        onDragOver={onDragOver} onDrop={onDrop}
      >
        <Background color="#222" gap={20} />
        <Controls />
        <Legend /> 
        {document.getElementById('sidebar-root') && createPortal( <Sidebar nodes={nodes} setNodes={setNodes} currentContext={currentContext} />, document.getElementById('sidebar-root')! )}
        {createPortal( <div onClick={deleteSelected} title="Delete Selected (Del)" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, width: 50, height: 50, borderRadius: '50%', background: '#ff007a', color: 'white', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}>🗑️</div>, document.body )}
        {menu && menu.visible && menu.type === 'pane' && createPortal(
          <ContextMenu 
            x={menu.x} 
            y={menu.y} 
            onClose={() => setMenu(null)} 
            onAddNode={(id) => onAddNode(id)} 
            filterType={menuFilter}
            onPaste={clipboard ? handlePaste : undefined}
            onCreateCustom={() => setShowCustomDialog(true)}
            hasClipboard={!!clipboard}
            hasSelection={nodes.some(n => n.selected)}
          />, 
          document.body 
        )}
        {menu && menu.visible && menu.type === 'node' && menu.nodeId && createPortal(
          <NodeContextMenu 
            x={menu.x} 
            y={menu.y}
            nodeId={menu.nodeId}
            nodeName={(() => {
              const node = nodes.find(n => n.id === menu.nodeId);
              return node?.data.label || node?.data.definition?.label || 'Node';
            })()}
            isCustomNode={(() => {
              const node = nodes.find(n => n.id === menu.nodeId);
              return !!(node && 'isCustom' in node.data.definition && node.data.definition.isCustom);
            })()}
            isLastOutput={(() => {
              const node = nodes.find(n => n.id === menu.nodeId);
              if (node?.data.definition?.id !== 'output') return false;
              return nodes.filter(n => n.data.definition?.id === 'output').length === 1;
            })()}
            onClose={() => setMenu(null)}
            onCopy={() => {
              const node = nodes.find(n => n.id === menu.nodeId);
              if (node) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === menu.nodeId })));
                setTimeout(handleCopy, 10);
              }
            }}
            onCut={() => {
              const node = nodes.find(n => n.id === menu.nodeId);
              if (node) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === menu.nodeId })));
                setTimeout(handleCut, 10);
              }
            }}
            onDelete={() => {
              setNodes((nds) => nds.filter((n) => n.id !== menu.nodeId));
              setEdges((eds) => eds.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId));
            }}
            onEditCustom={() => {
              enterCustomNode(menu.nodeId!);
            }}
          />, 
          document.body 
        )}
        {showCustomDialog && createPortal(
          <CreateCustomNodeDialog 
            onClose={() => setShowCustomDialog(false)}
            onCreate={handleCreateCustomNode}
          />, 
          document.body 
        )}
        {showCode && createPortal( <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCode(false)}> <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #444', width: '80%', height: '80%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}> <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#fff', fontWeight: 'bold' }}> <span>GENERATED GLSL</span> <button onClick={() => setShowCode(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>✕</button> </div> <textarea readOnly value={currentCode} style={{ flex: 1, background: '#111', color: '#81c784', border: 'none', fontFamily: 'monospace', padding: '10px', resize: 'none' }} /> </div> </div>, document.body )}
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