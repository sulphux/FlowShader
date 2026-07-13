import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, {
  addEdge, Background, Controls, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider,
  type Node, type Edge, type OnConnect, type NodeTypes, type EdgeTypes, applyNodeChanges, getRectOfNodes, type OnConnectStartParams,
  type NodeChange, type NodeRemoveChange
} from 'reactflow';
import 'reactflow/dist/style.css'; 

import { ShaderNode } from './ShaderNode';
import { PreviewNode } from './PreviewNode';
import { MonitorNode } from './MonitorNode';
import { ColorPreviewNode } from './ColorPreviewNode';
import ContextMenu from './ContextMenu';
import NodeContextMenu from './NodeContextMenu';
import CreateCustomNodeDialog from './CreateCustomNodeDialog';
import SettingsDialog from './SettingsDialog';
import CloudDialog from './CloudDialog';
import { addCustomNode, extractCustomNodePorts, loadCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import type { ShaderNodeDefinition, DataType } from '../core/types';
import Legend from './Legend';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import NavigationPanel from './NavigationPanel';
import { NODE_REGISTRY } from '../nodes'; 
import { TYPE_COLORS } from '../core/theme';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { validateConnection } from '../core/connectionValidator';
import { insertAutoAdapter } from '../core/autoAdapterSystem';
import { serializeGraph, rehydrateGraph } from '../core/graphRehydration';
import { saveProjectFile, openProjectFile, supportsFileSystemAccess, type FileHandleLike } from '../core/fileAccess';
import { computeSmartSplitPorts } from '../core/smartSplitAdapter';
import { isEditableKeyboardTarget } from '../core/keyboardTarget';
import { ImpulseEdge } from './ImpulseEdge';

const initialNodesDefault = [
  { id: 'out1', type: 'shaderNode', position: { x: 500, y: 100 }, data: { definition: NODE_REGISTRY['output'] } },
];

interface Props {
  onChange?: (nodes: Node[], edges: Edge[]) => void;
}

const STORAGE_KEY = 'shader-nodes-save-v1';
// Drill-down path into custom nodes (array of custom node labels, Main excluded),
// so a page refresh can restore "where you were" instead of always landing on Main.
const NAV_PATH_KEY = 'shader-nodes-nav-path-v1';

const getLogicHash = (nodes: Node[], edges: Edge[]) => {
  const logicData = {
    nodes: nodes.map(n => ({ id: n.id, data: n.data })),
    edges: edges.map(e => ({ s: e.source, t: e.target, th: e.targetHandle }))
  };
  return JSON.stringify(logicData);
};

// Define nodeTypes OUTSIDE component to prevent ReactFlow warning
const NODE_TYPES: NodeTypes = {
  shaderNode: ShaderNode,
  previewNode: PreviewNode,
  monitorNode: MonitorNode,
  colorPreviewNode: ColorPreviewNode,
};

const EDGE_TYPES: EdgeTypes = {
  impulse: ImpulseEdge,
};

/**
 * Helper function to extract type from a node's handle (input or output)
 */
function getHandleType(node: Node | undefined, handleId: string | null): DataType {
  if (!node?.data?.definition || !handleId) return 'auto';
  
  const def = node.data.definition;
  
  // Check outputs
  const output = def.outputs?.find((o: { id: string; type: string }) => o.id === handleId);
  if (output) return output.type as DataType;
  
  // Check inputs
  const input = def.inputs?.find((i: { id: string; type: string }) => i.id === handleId);
  if (input) return input.type as DataType;
  
  return 'auto';
}

function EditorInner({ onChange }: Props) {

  const getInitialData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const restored = rehydrateGraph(JSON.parse(saved));
        return {
          nodes: restored.nodes,
          edges: restored.edges,
          viewport: restored.viewport ?? { x: 0, y: 0, zoom: 1 },
        };
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
  const [menuFilterDirection, setMenuFilterDirection] = useState<'source' | 'target' | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; visible: boolean; type: 'pane' | 'node'; nodeId?: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [customCreationMode, setCustomCreationMode] = useState<'empty' | 'selection' | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showCloudDialog, setShowCloudDialog] = useState(false);
  
  // Navigation stack for custom nodes
  const [navigationStack, setNavigationStack] = useState<Array<{ name: string; nodes: Node[]; edges: Edge[] }>>([]);
  const [currentContext, setCurrentContext] = useState<string>('Main'); // 'Main' or custom node name
  
  const [pendingConnection, setPendingConnection] = useState<OnConnectStartParams | null>(null);
  const connectionStartRef = useRef<OnConnectStartParams | null>(null);
  // React Flow snaps a connection to the nearest handle within a radius, so
  // the drag can land ON a valid target while event.target at mouseup is
  // still the pane underneath (cursor a few px off the small handle circle)
  // — onConnectEnd's pane check alone can't tell a real connection from an
  // empty-space drop. onConnect fires first when the drop was valid, so it
  // sets this; onConnectEnd checks it before showing the quick-add menu.
  const justConnectedRef = useRef(false);

  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Uchwyt File System Access — Save nadpisuje ten plik bez pytania
  const fileHandleRef = useRef<FileHandleLike | null>(null);
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

  // Restore navigation depth after a page refresh: replay the persisted path
  // of custom node labels, one level at a time. Stops (and truncates the
  // stale path) at the first label that can no longer be resolved — e.g. the
  // custom node was renamed or deleted since the path was saved.
  useEffect(() => {
    let path: string[];
    try {
      path = JSON.parse(localStorage.getItem(NAV_PATH_KEY) || '[]');
    } catch {
      path = [];
    }
    if (!Array.isArray(path) || path.length === 0) return;

    const builtStack: Array<{ name: string; nodes: Node[]; edges: Edge[] }> = [];
    let levelNodes = initialData.nodes;
    let levelEdges: Edge[] = initialData.edges;
    let levelName = 'Main';
    let reachedLabels: string[] = [];

    for (const label of path) {
      const customDef = Object.values(NODE_REGISTRY).find(d => d.label === label && 'isCustom' in d) as CustomNodeDefinition | undefined;
      if (!customDef) break;

      builtStack.push({ name: levelName, nodes: levelNodes, edges: levelEdges });
      const subgraph = loadCustomNodeSubgraph(customDef);
      levelNodes = subgraph.nodes;
      levelEdges = subgraph.edges;
      levelName = label;
      reachedLabels = [...reachedLabels, label];
    }

    if (reachedLabels.length === 0) return;

    setNavigationStack(builtStack);
    setCurrentContext(levelName);
    setNodes(refreshNodesFromRegistry(levelNodes));
    setEdges(levelEdges);
    if (reachedLabels.length !== path.length) {
      localStorage.setItem(NAV_PATH_KEY, JSON.stringify(reachedLabels));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the current drill-down path on every navigation change
  useEffect(() => {
    const path = [...navigationStack.map(s => s.name), currentContext].filter(name => name !== 'Main');
    if (path.length === 0) {
      localStorage.removeItem(NAV_PATH_KEY);
    } else {
      localStorage.setItem(NAV_PATH_KEY, JSON.stringify(path));
    }
  }, [navigationStack, currentContext]);

  useEffect(() => {
    if (!isLoadedRef.current && initialData.viewport) {
        reactFlowInstance.setViewport(initialData.viewport);
        isLoadedRef.current = true;
    }
  }, [reactFlowInstance, initialData.viewport]);

  /** Persists the subgraph currently on canvas back into its custom node definition + registry. */
  const persistCurrentSubgraph = useCallback((contextLabel: string, currentNodes: Node[], currentEdges: Edge[]) => {
    if (contextLabel === 'Main') return;
    const customNodeId = Object.keys(NODE_REGISTRY).find(key => {
      const def = NODE_REGISTRY[key as keyof typeof NODE_REGISTRY];
      return def.label === contextLabel && 'isCustom' in def;
    });
    if (!customNodeId) return;

    const customDef = NODE_REGISTRY[customNodeId as keyof typeof NODE_REGISTRY] as CustomNodeDefinition;
    const ports = extractCustomNodePorts({ nodes: currentNodes });
    const updatedCustomNode: CustomNodeDefinition = {
      ...customDef,
      inputs: ports.inputs.length > 0 ? ports.inputs : customDef.inputs,
      outputs: ports.outputs.length > 0 ? ports.outputs : customDef.outputs,
      subgraph: { nodes: currentNodes, edges: currentEdges },
    };
    addCustomNode(updatedCustomNode);
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[customNodeId] = updatedCustomNode;
  }, []);

  useEffect(() => {
    // Inside a custom node's subgraph: persist into ITS definition (not the
    // main canvas key), same auto-save cadence as Main. Previously this only
    // happened on navigateBack/navigateToLevel, so refreshing the page while
    // still inside a subgraph (without backing out first) silently lost
    // whatever was added — nav-path restore replayed the pre-edit subgraph
    // from custom_nodes_library, since the edit was never written there.
    if (currentContext !== 'Main') {
      persistCurrentSubgraph(currentContext, nodes, edges);
      return;
    }

    const dataToSave = serializeGraph(nodes, edges, reactFlowInstance.getViewport());
    const jsonString = JSON.stringify(dataToSave);
    try {
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (e) {
      // Quota localStorage (np. duże tekstury w data URL) — auto-zapis pomijamy,
      // zapis do pliku dalej działa
      console.warn('Auto-save skipped (localStorage quota?):', e);
    }
    const currentHash = getLogicHash(nodes, edges);
    if (currentHash !== lastLogicHash.current) {
        if (onChange) onChange(nodes, edges);
        lastLogicHash.current = currentHash;
    }
  }, [nodes, edges, currentContext, onChange, reactFlowInstance, persistCurrentSubgraph]);

  const restoreGraph = useCallback((jsonString: string, filePath?: string) => {
      try {
        const restored = rehydrateGraph(JSON.parse(jsonString));
        setNodes(restored.nodes);
        setEdges(restored.edges);
        if (restored.viewport) reactFlowInstance.setViewport(restored.viewport);
        if (filePath) setCurrentFilePath(filePath);
      } catch (err) {
          console.error("Error loading graph:", err);
      }
  }, [setNodes, setEdges, reactFlowInstance]);

  /**
   * Refresh a list of nodes against the current NODE_REGISTRY / customNodeManager
   * state: custom node instances pick up their latest definition, and
   * custom_input/custom_output ports reflect their forced/detected type.
   * Used whenever we (re)display a graph level we've already visited —
   * was duplicated 3x (navigateBack, navigateToLevel x2), independently
   * editable and prone to drifting out of sync.
   */
  const refreshNodesFromRegistry = useCallback((nodesToRefresh: Node[]): Node[] => {
    return nodesToRefresh.map(node => {
      const def = node.data?.definition;

      if (def && 'isCustom' in def && def.isCustom) {
        const freshDef = NODE_REGISTRY[def.id as keyof typeof NODE_REGISTRY];
        if (freshDef) {
          return { ...node, data: { ...node.data, definition: freshDef } };
        }
      }

      const portType = node.data?.forcedType || node.data?.detectedType;
      if (def?.id === 'custom_input' && portType) {
        return {
          ...node,
          data: { ...node.data, definition: { ...NODE_REGISTRY['custom_input'], outputs: [{ id: 'out', type: portType, label: 'Value' }] } }
        };
      }
      if (def?.id === 'custom_output' && portType) {
        return {
          ...node,
          data: { ...node.data, definition: { ...NODE_REGISTRY['custom_output'], inputs: [{ id: 'in', type: portType, label: 'Value' }] } }
        };
      }

      return node;
    });
  }, []);

  /**
   * The PROJECT graph (Main level) regardless of where the user currently is.
   * Inside a custom node's subgraph the canvas holds the subgraph view —
   * saving that to a file used to overwrite the whole project with the custom
   * node's innards (no Output node, loose Custom Input/Output nodes). Subgraph
   * edits are already persisted into the custom node definition on every
   * change, so Main + custom_nodes_library is the complete project state.
   */
  const getProjectGraph = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    if (currentContext === 'Main' || navigationStack.length === 0) {
      return { nodes, edges };
    }
    const mainState = navigationStack[0];
    return { nodes: refreshNodesFromRegistry(mainState.nodes), edges: mainState.edges };
  }, [currentContext, navigationStack, nodes, edges, refreshNodesFromRegistry]);

  const handleSaveFile = useCallback((saveAs = false) => {
      const project = getProjectGraph();
      const dataToSave = serializeGraph(project.nodes, project.edges, reactFlowInstance.getViewport());
      const json = JSON.stringify(dataToSave, null, 2);

      let suggestedName = currentFilePath || 'shader_graph.json';
      if (!supportsFileSystemAccess() && (saveAs || !currentFilePath)) {
        // Fallback bez FSA: nazwa przez prompt (jak dotychczas)
        const baseName = currentFilePath ? currentFilePath.split(/[/\\]/).pop()?.replace('.json', '') : 'shader_graph';
        suggestedName = prompt('Save as:', baseName || 'shader_graph')?.trim() || suggestedName;
      }
      if (!suggestedName.endsWith('.json')) suggestedName += '.json';

      void saveProjectFile(json, fileHandleRef.current, saveAs, suggestedName).then(result => {
          if (!result.saved) return; // anulowano picker
          fileHandleRef.current = result.handle;
          setCurrentFilePath(result.fileName);
      }).catch(err => console.error('Save failed:', err));
  }, [getProjectGraph, reactFlowInstance, currentFilePath]);

  const handleLoadFileClick = useCallback(() => {
      if (supportsFileSystemAccess()) {
          void openProjectFile().then(result => {
              if (!result) return; // anulowano
              // Uchwyt zostaje — kolejne Save nadpisze wczytany plik
              fileHandleRef.current = result.handle;
              restoreGraph(result.content, result.fileName);
          });
          return;
      }
      fileInputRef.current?.click();
  }, [restoreGraph]);
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
        fileHandleRef.current = null;
      }
  }, [setNodes, setEdges, saveToHistory]);
  
  const handleNew = useCallback(() => {
    // New project without confirmation (like "File > New")
    saveToHistory();
    setNodes(initialNodesDefault);
    setEdges([]);
    setCurrentFilePath(null);
    fileHandleRef.current = null;
    setNavigationStack([]);
    setCurrentContext('Main');
    localStorage.removeItem(STORAGE_KEY);
  }, [setNodes, setEdges, saveToHistory]);
  
  const handleFitView = useCallback(() => {
    // Fit all nodes in view
    reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
  }, [reactFlowInstance]);
  
  const handleCreateCustomNode = useCallback((name: string, description: string, mode: 'empty' | 'selection') => {
    const selectedNodes = mode === 'selection' ? nodes.filter(n => n.selected) : [];
    
    // Extract selected nodes and their edges
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdges = edges
      .filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target))
      .map(edge => ({ ...edge, selected: false }));
    const selectedSubgraphNodes = selectedNodes.map(node => ({
      ...node,
      selected: false,
      data: { ...node.data },
    }));
    
    // Build the actual subgraph nodes FIRST — we need them to derive correct port types
    const defaultSubgraphNodes: Node[] = selectedSubgraphNodes.length > 0
      ? selectedSubgraphNodes
      : [
        // Default Custom Input node
        {
          id: `custom_input_default`,
          type: 'shaderNode',
          position: { x: 100, y: 200 },
          data: {
            definition: NODE_REGISTRY['custom_input'],
            value: undefined,
          }
        },
        // Default Custom Output node (NOT screen Output!)
        {
          id: `custom_output_default`,
          type: 'shaderNode',
          position: { x: 400, y: 200 },
          data: {
            definition: NODE_REGISTRY['custom_output'],
            value: 'Output',
          }
        }
      ];
    
    // Derive ports from the ACTUAL subgraph nodes so outer inputs match function parameters
    const ports = extractCustomNodePorts({ nodes: defaultSubgraphNodes });
    
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
        nodes: defaultSubgraphNodes,
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
    
    // Auto-place a new instance on the canvas near the viewport center
    const center = reactFlowInstance.screenToFlowPosition({ x: 400, y: 300 });
    const instanceId = `${customNodeId}_${Date.now()}`;
    setNodes(nds => [
      ...nds.map(node => ({ ...node, selected: false })),
      {
        id: instanceId,
        type: 'shaderNode',
        position: center,
        selected: false,
        data: { definition: customNode }
      }
    ]);
    
    alert(`✅ Custom node "${name}" created!\n\nYou can now find it in the sidebar under "Custom Nodes" category.`);
    
    // Optionally delete selected nodes after creating custom
    // setNodes((nds) => nds.filter(n => !selectedNodeIds.has(n.id)));
    // setEdges((eds) => eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
  }, [nodes, edges, reactFlowInstance, setNodes]);
  
  /** Default Custom Input/Output pair used to seed a brand-new (empty) custom node subgraph. */
  const defaultCustomSubgraphNodes = useCallback((): Node[] => [
    { id: 'custom_input_default', type: 'shaderNode', position: { x: 100, y: 200 }, data: { definition: NODE_REGISTRY['custom_input'], value: undefined } },
    { id: 'custom_output_default', type: 'shaderNode', position: { x: 400, y: 200 }, data: { definition: NODE_REGISTRY['custom_output'], value: 'Output' } },
  ], []);

  /** Loads a custom node's subgraph (fresh from storage), or seeds defaults if it's empty. */
  const loadCustomNodeSubgraph = useCallback((customDef: CustomNodeDefinition): { nodes: Node[]; edges: Edge[] } => {
    if (customDef.subgraph.nodes.length === 0) {
      return { nodes: defaultCustomSubgraphNodes(), edges: [] };
    }
    const freshCustomDef = loadCustomNodes().find(cn => cn.id === customDef.id);
    const subgraph = freshCustomDef ? freshCustomDef.subgraph : customDef.subgraph;
    return { nodes: subgraph.nodes, edges: subgraph.edges };
  }, [defaultCustomSubgraphNodes]);

  const enterCustomNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const def = node.data.definition;
    if (!('isCustom' in def) || !def.isCustom) return;

    const customDef = def as CustomNodeDefinition;
    setNavigationStack(prev => [...prev, { name: currentContext, nodes, edges }]);

    const subgraph = loadCustomNodeSubgraph(customDef);
    setNodes(subgraph.nodes);
    setEdges(subgraph.edges);
    setCurrentContext(def.label);
  }, [nodes, edges, currentContext, setNodes, setEdges, loadCustomNodeSubgraph]);

  const navigateBack = useCallback(() => {
    if (navigationStack.length === 0) return;

    const previous = navigationStack[navigationStack.length - 1];

    // Use functional state update to ensure we read LATEST state
    setNodes((currentNodes) => {
      setEdges((currentEdges) => {
        persistCurrentSubgraph(currentContext, currentNodes, currentEdges);
        return previous.edges;
      });
      return refreshNodesFromRegistry(previous.nodes);
    });

    setNavigationStack(prev => prev.slice(0, -1));
    setCurrentContext(previous.name);
  }, [navigationStack, currentContext, persistCurrentSubgraph, refreshNodesFromRegistry]);

  const navigateToLevel = useCallback((levelIndex: number) => {
    persistCurrentSubgraph(currentContext, nodes, edges);

    if (levelIndex === 0) {
      if (navigationStack.length > 0) {
        const mainState = navigationStack[0];
        setNodes(refreshNodesFromRegistry(mainState.nodes));
        setEdges(mainState.edges);
      } else {
        // No stack - use default (shouldn't happen in normal flow)
        setNodes(initialNodesDefault);
        setEdges([]);
      }
      setNavigationStack([]);
      setCurrentContext('Main');
    } else {
      const targetLevel = navigationStack[levelIndex - 1];
      setNavigationStack(prev => prev.slice(0, levelIndex));
      setCurrentContext(targetLevel.name);
      setNodes(refreshNodesFromRegistry(targetLevel.nodes));
      setEdges(targetLevel.edges);
    }
  }, [navigationStack, setNodes, setEdges, currentContext, nodes, edges, persistCurrentSubgraph, refreshNodesFromRegistry]);

  const navigateToMain = useCallback(() => {
    navigateToLevel(0);
  }, [navigateToLevel]);

  const deleteSelected = useCallback(() => {
      // Track which node ids are actually being removed (keeping the last
      // Output node alive), so their edges get removed too — deleting a node
      // used to leave any edges connected to it dangling (source/target
      // pointing at a node that no longer exists), corrupting the saved
      // graph. See also rehydrateGraph()'s dropOrphanedEdges, which cleans up
      // graphs already saved with this corruption.
      setNodes((nds) => {
        const removedIds = new Set(
          nds.filter(n => n.selected && n.data.definition.id !== 'output').map(n => n.id)
        );
        setEdges((eds) => eds.filter((e) => !e.selected && !removedIds.has(e.source) && !removedIds.has(e.target)));
        return nds.filter((n) => !n.selected || n.data.definition.id === 'output');
      });
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
    const isColorPreview = typeId === 'color_preview';
    const def = NODE_REGISTRY[typeId as keyof typeof NODE_REGISTRY];
    const newLabel = getUniqueLabel(def, nodes);
    const newNode: Node = {
      id: `${typeId}_${Date.now()}`,
      type: isPreview ? 'previewNode' : (isMonitor ? 'monitorNode' : (isColorPreview ? 'colorPreviewNode' : 'shaderNode')),
      position,
      data: {
        definition: def,
        label: newLabel,
        value: def.controls?.defaultValue,
        ...(def.id === 'feedback' ? { captureMode: 'snapshot' as const } : {}),
      },
      zIndex: isGroup ? -10 : 0,
      style: isGroup ? { width: 400, height: 300 } : undefined,
    };
    setNodes((nds) => isGroup ? [newNode, ...nds] : nds.concat(newNode));
  }, [reactFlowInstance, setNodes, nodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check if any deletion would remove the last output node
      const deletions = changes.filter((c): c is NodeRemoveChange => c.type === 'remove');
      
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
        justConnectedRef.current = true;
        if (!params.source || !params.target || !params.sourceHandle || !params.targetHandle) {
            console.warn('Auto-Adapter: Incomplete connection params');
            return;
        }
        const connectionParams = {
            source: params.source,
            sourceHandle: params.sourceHandle,
            target: params.target,
            targetHandle: params.targetHandle,
        };

        // 1. Find source/target nodes
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        
        if (!sourceNode || !targetNode) { 
            console.warn('Auto-Adapter: Source or target node not found');
            return; 
        }

        const sourceDef = sourceNode.data.definition; 
        const targetDef = targetNode.data.definition;
        const outputDef = sourceDef.outputs.find((o: { id: string; type: string }) => o.id === params.sourceHandle);
        const inputDef = targetDef.inputs.find((i: { id: string; type: string }) => i.id === params.targetHandle);
        
        if (!outputDef) { 
            console.warn('Auto-Adapter: Source output definition not found');
            return; 
        }

        // 2. Get types from handles
        const sourceType = getHandleType(sourceNode, params.sourceHandle);
        const targetType = getHandleType(targetNode, params.targetHandle);

        // === SINGLE CONNECTION PER INPUT ===
        // Remove any existing connection to the target input port FIRST
        setEdges((eds) => eds.filter(edge => 
            !(edge.target === params.target && edge.targetHandle === params.targetHandle)
        ));

        // === AUTO TYPE ADAPTATION (Smart Split + Relay) ===
        
        // Smart Split Node - adapts outputs based on input type
        // (skipped once the user has forced a type via the badge — see ShaderNode.tsx)
        if (targetDef.id === 'smart_split' && inputDef?.type === 'auto' && !targetNode.data.forcedType) {
            const type = sourceType;
            const adapted = computeSmartSplitPorts(type);

            setNodes(nds => nds.map(n => {
                if (n.id === targetNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            definition: {
                                ...n.data.definition,
                                inputs: [{ id: 'in', label: adapted.inputLabel, type: type }],
                                outputs: adapted.outputs
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
            const targetTypeActual = inputDef.type;
            setNodes(nds => nds.map(n => {
                if (n.id === sourceNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            definition: {
                                ...n.data.definition,
                                inputs: [{ id: 'in', label: targetTypeActual, type: targetTypeActual }],
                                outputs: [{ id: 'out', label: targetTypeActual, type: targetTypeActual }]
                            }
                        }
                    }
                }
                return n;
            }));
        }

        // === CUSTOM INPUT/OUTPUT AUTO-TYPE DETECTION ===
        // Skipped when the user has forced a type manually (ShaderNode.tsx's
        // FORCE TYPE buttons) — forced type always wins over auto-detection.

        // Custom Input - infer type from the node it feeds into
        // (custom_input has no input ports, so we detect from its downstream target)
        if (sourceDef.id === 'custom_input' && inputDef?.type && inputDef.type !== 'auto' && !sourceNode.data.forcedType) {
            const inferredType = inputDef.type;
            setNodes(nds => nds.map(n => {
                if (n.id === sourceNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            detectedType: inferredType,
                            definition: {
                                ...n.data.definition,
                                outputs: [{ id: 'out', type: inferredType, label: 'Value' }]
                            }
                        }
                    };
                }
                return n;
            }));
        }

        // Custom Output - detect type from INCOMING connection (what connects TO it)
        if (targetDef.id === 'custom_output' && !targetNode.data.forcedType) {
            // Custom Output is TARGET here - detect from SOURCE type (what feeds into it)
            const detectedType = sourceType;  // What connects TO Custom Output
            setNodes(nds => nds.map(n => {
                if (n.id === targetNode.id) {  // targetNode is Custom Output!
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            detectedType, // Store detected type in node data
                            definition: {
                                ...n.data.definition,
                                inputs: [{ id: 'in', type: detectedType, label: 'Value' }]
                            }
                        }
                    }
                }
                return n;
            }));
        }

        // === VALIDATION + AUTO-ADAPTER INTEGRATION ===
        
        // 3. Validate connection
        const validation = validateConnection(sourceType, targetType);
        
        // 4. If invalid + requires adapter → auto-insert
        if (!validation.valid && validation.requiresAdapter) {
            const result = insertAutoAdapter(
                nodes, edges, connectionParams, sourceType, targetType
            );
            
            if (result.newNodes.length > 0) {
                setNodes(nds => [...nds, ...result.newNodes]);
                setEdges(eds => [...eds, ...result.newEdges]);
                
                console.log('✅ Auto-Adapter inserted:', {
                    adapterNodes: result.newNodes.map(n => n.data.definition.label),
                    edgeCount: result.newEdges.length
                });
                
                return; // Don't create direct edge
            }
        }
        
        // 5. If invalid + no adapter → block (show error)
        if (!validation.valid) {
            console.warn('❌ Connection blocked:', validation.reason);
            alert(`Cannot connect ${sourceType} to ${targetType}\n\n${validation.reason}`);
            return;
        }
        
        // 6. Valid connection → proceed normally
        const edgeColor = TYPE_COLORS[sourceType] || '#fff';
        const newEdge: Edge = {
          id: `e_${connectionParams.source}_${connectionParams.target}_${Date.now()}`,
          ...connectionParams,
          type: sourceType === 'impulse' ? 'impulse' : 'default',
          style: { stroke: edgeColor, strokeWidth: 3 },
          animated: false,
        };
        setEdges((eds) => addEdge(newEdge, eds));
    }, [nodes, edges, setNodes, setEdges]);

  const onMouseMove = useCallback((e: React.MouseEvent) => { if(ref.current) { const bounds = ref.current.getBoundingClientRect(); mousePos.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top }; } }, []);
  const onConnectStart = useCallback((_: unknown, params: OnConnectStartParams) => { connectionStartRef.current = params; }, []);
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
      if (justConnectedRef.current) {
          justConnectedRef.current = false;
          connectionStartRef.current = null;
          return;
      }
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
              const point = 'changedTouches' in event ? event.changedTouches[0] : event;
              const clientX = point.clientX; const clientY = point.clientY;
              setMenu({ x: clientX, y: clientY, visible: true, type: 'pane' });
              setMenuFilter(type);
              setMenuFilterDirection(handleType === 'source' || handleType === 'target' ? handleType : null);
              setPendingConnection(connectionStartRef.current);
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
      if (isEditableKeyboardTarget(e.target)) {
        // Preserve the application Save shortcut, but leave editing/history,
        // clipboard and Backspace/Delete entirely to the focused field.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSaveFile(false);
        }
        return;
      }
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
    setMenuFilterDirection(null);
    setPendingConnection(null);
  }, []);
  const onAddNode = useCallback((typeId: string) => { 
    if (!menu) return; 
    const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y }); 
    const isGroup = typeId === 'special_group';
    const isPreview = typeId === 'preview';
    const isMonitor = typeId === 'monitor';
    const isColorPreview = typeId === 'color_preview';
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
        const adapted = computeSmartSplitPorts(type);
        def = {
          ...def,
          inputs: [{ id: 'in', label: adapted.inputLabel, type: type as DataType }],
          outputs: adapted.outputs
        };
      }
    }
    
    const newNode: Node = {
      id: newNodeId,
      type: isPreview ? 'previewNode' : (isMonitor ? 'monitorNode' : (isColorPreview ? 'colorPreviewNode' : 'shaderNode')),
      position,
      data: {
        definition: def,
        label: newLabel,
        value: def.controls?.defaultValue,
        ...(def.id === 'feedback' ? { captureMode: 'snapshot' as const } : {}),
      },
      zIndex: isGroup ? -10 : 0, 
      style: isGroup ? { width: 400, height: 300 } : undefined, 
    }; 
    setNodes((nds) => isGroup ? [newNode, ...nds] : nds.concat(newNode)); 
    
    if (pendingConnection && pendingConnection.nodeId) {
      const { nodeId, handleId, handleType } = pendingConnection as { nodeId: string; handleId: string | null; handleType: string | null };
      const originNode = nodes.find(n => n.id === nodeId);
      const originType = getHandleType(originNode, handleId);
      const worksWith = (src: string, tgt: string) => {
        const r = validateConnection(src, tgt);
        return r.valid || Boolean(r.requiresAdapter);
      };

      // Wybierz port kompatybilny z przeciąganym handle (nie ślepo pierwszy)
      let connection: { source: string; sourceHandle: string; target: string; targetHandle: string } | null = null;
      let sourceType = originType as string;
      let targetType = originType as string;
      if (handleType === 'source' && handleId) {
        const input = def.inputs.find(i => worksWith(originType, i.type)) || def.inputs[0];
        if (input) {
          connection = { source: nodeId, sourceHandle: handleId, target: newNodeId, targetHandle: input.id };
          targetType = input.type;
        }
      } else if (handleId) {
        const output = def.outputs.find(o => worksWith(o.type, originType)) || def.outputs[0];
        if (output) {
          connection = { source: newNodeId, sourceHandle: output.id, target: nodeId, targetHandle: handleId };
          sourceType = output.type;
        }
      }

      if (connection) {
        const validation = validateConnection(sourceType, targetType);
        if (validation.valid) {
          const edgeColor = TYPE_COLORS[sourceType] || '#fff';
          const newEdge: Edge = {
            id: `e_${connection.source}_${connection.target}`,
            ...connection,
            type: sourceType === 'impulse' ? 'impulse' : 'default',
            style: { stroke: edgeColor, strokeWidth: 3 },
          };
          setEdges((eds) => addEdge(newEdge, eds));
        } else if (validation.requiresAdapter) {
          // Typy się nie zgadzają — wstaw Split/Combine tak jak przy ręcznym łączeniu
          const result = insertAutoAdapter(
            [...nodes, newNode], edges, connection,
            sourceType as DataType, targetType as DataType
          );
          if (result.newNodes.length > 0) {
            setNodes(nds => [...nds, ...result.newNodes]);
            setEdges(eds => [...eds, ...result.newEdges]);
          }
        }
      }
      setPendingConnection(null);
    }
    setMenu(null);
  }, [menu, reactFlowInstance, setNodes, pendingConnection, setEdges, nodes, edges, menuFilter]);
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
        onNew={handleNew}
        onFitView={handleFitView}
        onShowCode={handleShowCode}
        onShowSettings={() => setShowSettingsDialog(true)}
        onShowCloud={() => setShowCloudDialog(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        currentFile={currentFilePath}
      />
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />
      <ReactFlow
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} minZoom={0.1} maxZoom={4} fitView
        onPaneContextMenu={onPaneContextMenu} onNodeContextMenu={onNodeContextMenu} onNodeDoubleClick={onNodeDoubleClick} onEdgeContextMenu={onEdgeContextMenu} onConnectStart={onConnectStart} onConnectEnd={onConnectEnd} onPaneClick={() => setMenu(null)} selectionOnDrag={true} panOnDrag={[1]} selectionKeyCode="Shift" multiSelectionKeyCode="Control" defaultEdgeOptions={{ type: 'default', interactionWidth: 25, style: { strokeWidth: 3 }}}
        onDragOver={onDragOver} onDrop={onDrop}
      >
        <Background color="#222" gap={20} />
        <Controls />
        <Legend />
        
        {/* Navigation panel for custom node editing */}
        <NavigationPanel
          breadcrumbs={['Main', ...navigationStack.map(s => s.name), currentContext].filter((v, i, a) => a.indexOf(v) === i)}
          currentContext={currentContext}
          onNavigateToLevel={navigateToLevel}
          onNavigateBack={navigateBack}
          onNavigateToMain={navigateToMain}
        />
        
        {document.getElementById('sidebar-root') && createPortal( <Sidebar nodes={nodes} setNodes={setNodes} currentContext={currentContext} />, document.getElementById('sidebar-root')! )}
        {createPortal( <div onClick={deleteSelected} title="Delete Selected (Del)" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, width: 50, height: 50, borderRadius: '50%', background: '#ff007a', color: 'white', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}>🗑️</div>, document.body )}
        {menu && menu.visible && menu.type === 'pane' && createPortal(
          <ContextMenu 
            x={menu.x} 
            y={menu.y} 
            onClose={() => setMenu(null)} 
            onAddNode={(id) => onAddNode(id)} 
            filterType={menuFilter}
            filterDirection={menuFilterDirection}
            onPaste={clipboard ? handlePaste : undefined}
            onCreateCustom={(mode) => setCustomCreationMode(mode)}
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
        {customCreationMode && createPortal(
          <CreateCustomNodeDialog
            mode={customCreationMode}
            onClose={() => setCustomCreationMode(null)}
            onCreate={(name, description) => handleCreateCustomNode(name, description, customCreationMode)}
          />,
          document.body
        )}
        {showSettingsDialog && createPortal(
          <SettingsDialog onClose={() => setShowSettingsDialog(false)} />,
          document.body
        )}
        {showCloudDialog && createPortal(
          <CloudDialog
            onClose={() => setShowCloudDialog(false)}
            getProjectJson={() => {
              const project = getProjectGraph();
              return JSON.stringify(serializeGraph(project.nodes, project.edges, reactFlowInstance.getViewport()));
            }}
            onLoadProject={(json, name) => restoreGraph(json, name)}
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
