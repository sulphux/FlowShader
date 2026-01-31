import { TimeNode } from './TimeNode';
import { OutputNode } from './OutputNode';
import { SDFCircle } from './SDFCircle';
import { PaletteNode } from './PaletteNode';
import * as MathNodes from './math';
import * as VecNodes from './vector';
import * as Utils from './utils';
import * as Params from './params';
import { PreviewNodeDef } from './utils';

export const NODE_REGISTRY = {
  output: OutputNode,
  time: TimeNode,
  sdf_circle: SDFCircle,
  palette: PaletteNode,
  
  // Utils - Split
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
  math_abs: MathNodes.AbsNode,
  math_exp: MathNodes.ExpNode,
  math_pow: MathNodes.PowNode,

  // Color
  color_add: MathNodes.ColorAddNode,
  color_mult: MathNodes.ColorMultNode,

  // Vector
  uv: VecNodes.UVNode,
  vec_length: VecNodes.LengthNode,
  vec_fract: VecNodes.FractNode,
  uv_scale: VecNodes.UVScaleNode,
  uv_shift: VecNodes.UVShiftNode,

  // Utils - Relay
  relay_float: Utils.RelayFloatNode,
  relay_vec3: Utils.RelayVec3Node,
  
  // Math Utils
  math_mix: Utils.MixNode,
  math_negate: Utils.NegateNode,

  special_note: Utils.NoteNode,
  special_group: Utils.GroupNode,

  preview: PreviewNodeDef,
};