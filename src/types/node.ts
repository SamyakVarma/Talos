export interface SkillPort {
  id: string;
  label: string;
  type:
    | "int"
    | "float"
    | "char"
    | "string"
    | "bool"
    | "int[]"
    | "float[]"
    | "string[]"
    | "bool[]"
    | "EXEC";
  io: "input" | "output";
  offset?: { x: number; y: number }; // relative to node center
}

export interface SkillData {
  id: string;
  x: number;
  y: number;
  label: string;
  skillType: string;
  inputs: SkillPort[];
  outputs: SkillPort[];
  value?: string | number | boolean | string[] | number[] | boolean[];
}