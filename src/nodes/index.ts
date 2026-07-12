import { TimeNode } from './TimeNode';
import { OutputNode } from './OutputNode';
import { SDFCircle } from './SDFCircle';
import { PaletteNode } from './PaletteNode';
import * as MathNodes from './math';
import * as VecNodes from './vector';
import * as Utils from './utils';
import * as Params from './params';
import * as Media from './media';
import * as Simulation from './simulation';
import { PreviewNodeDef } from './utils';
import { MonitorNodeDef, SmartSplitNode, SmartComposeNode, RelayAutoNode } from './utils';
import { CustomInputNode } from './CustomInput';
import { CustomOutputNode } from './CustomOutput';
import type { ShaderNodeDefinition } from '../core/types';

// Test helper nodes (for testing Custom Input/Output type detection)
const InputFloatNode: ShaderNodeDefinition = {
  id: 'input_float',
  label: 'Test Float',
  compact: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Value', type: 'float' }],
  glslTemplate: () => '1.0',
  description: 'Test node that outputs float'
};

const InputVec3Node: ShaderNodeDefinition = {
  id: 'input_vec3',
  label: 'Test Vec3',
  compact: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Value', type: 'vec3' }],
  glslTemplate: () => 'vec3(1.0)',
  description: 'Test node that outputs vec3'
};

export const NODE_REGISTRY = {
  output: OutputNode,
  time: TimeNode,
  sdf_circle: SDFCircle,
  palette: PaletteNode,
  
  // Custom Node System
  custom_input: CustomInputNode,
  custom_output: CustomOutputNode,
  
  // Test helpers
  input_float: InputFloatNode,
  input_vec3: InputVec3Node,
  
  // Utils - Auto-adapting nodes
  monitor: MonitorNodeDef,
  smart_split: SmartSplitNode,
  smart_compose: SmartComposeNode,
  relay_auto: RelayAutoNode,
  color_preview: Utils.ColorPreviewNodeDef,
  code_glsl: Utils.CodeNode,

  // Media
  texture_2d: Media.TextureNode,
  audio_input: Media.AudioInputNode,
  
  // Utils - Fixed type Split
  split_vec2: Utils.SplitVec2Node,
  split_vec3: Utils.SplitVec3Node,
  split_vec4: Utils.SplitVec4Node,

  // Utils - Combine
  combine_vec2: Utils.CombineVec2Node,
  combine_vec3: Utils.CombineVec3Node,
  combine_vec4: Utils.CombineVec4Node,
  
  // Params
  param_float: Params.FloatNode,
  param_color: Params.ColorNode,
  
  // Math
  math_add: MathNodes.AddNode,
  math_sub: MathNodes.SubNode,
  math_mult: MathNodes.MultNode,
  math_div: MathNodes.DivNode,
  math_sin: MathNodes.SinNode,
  math_cos: MathNodes.CosNode,
  math_tan: MathNodes.TanNode,
  math_cot: MathNodes.CotNode,
  math_atan: MathNodes.ATanNode,
  math_abs: MathNodes.AbsNode,
  math_exp: MathNodes.ExpNode,
  math_pow: MathNodes.PowNode,
  math_fract: MathNodes.FractFloatNode,

  // Color
  color_add: MathNodes.ColorAddNode,
  color_mult: MathNodes.ColorMultNode,
  mono: MathNodes.MonoNode,

  // Vector
  uv: VecNodes.UVNode,
  vec_length: VecNodes.LengthNode,
  vec_fract: VecNodes.FractNode,
  uv_scale: VecNodes.UVScaleNode,
  uv_shift: VecNodes.UVShiftNode,
  
  // Math Utils
  math_mix: Utils.MixNode,
  math_negate: Utils.NegateNode,

  special_note: Utils.NoteNode,
  special_group: Utils.GroupNode,

  preview: PreviewNodeDef,

  // Simulation
  feedback: Simulation.FeedbackNode,
  impulse: Simulation.ImpulseNode,
  math_random: Simulation.RandomNode,
};