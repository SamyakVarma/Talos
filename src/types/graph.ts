import { SkillData } from "./node";

export interface Connection {
  fromSkillId: string;
  fromPortId: string;
  toSkillId: string;
  toPortId: string;
  type: "execution" | "attribute";
}

export interface Graph {
  nodes: SkillData[];
  edges: Connection[];
}

export type ActiveConnection = {
  fromSkillId: string;
  fromPortId: string;
  type: "execution" | "attribute";
  startX: number;
  startY: number;
  mouseX: number;
  mouseY: number;
  fromIo: "input" | "output";
  isValid: boolean;
};