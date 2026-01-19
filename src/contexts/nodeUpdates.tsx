import { useCallback } from "react";
import { SkillData } from "../types/node";

interface NodeOperations {
  removePort: (nodeId: string, portId: string) => void;
  updateNode: (nodeId: string, updates: Partial<SkillData>) => void;
  updatePortOffset: (nodeId: string, portId: string, offset: { x: number; y: number }) => void;
}

export function useNodeOperations(setGraph: React.Dispatch<any>): NodeOperations {
  // ---------------- REMOVE PORT ----------------
  const removePort = useCallback(
    (nodeId: string, portId: string) => {
      setGraph((prev: any) => ({
        ...prev,
        edges: prev.edges.filter(
          (e: any) =>
            e.fromPortId !== portId &&
            e.toPortId !== portId
        ),
        nodes: prev.nodes.map((n: SkillData) =>
          n.id === nodeId
            ? {
                ...n,
                inputs: n.inputs.filter((p) => p.id !== portId),
                outputs: n.outputs.filter((p) => p.id !== portId),
              }
            : n
        ),
      }));
    },
    [setGraph]
  );

  // ---------------- UPDATE NODE ----------------
  const updateNode = useCallback(
    (oldId: string, updates: Partial<SkillData>) => {
      setGraph((prev: any) => {
        const oldNode = prev.nodes.find((n: SkillData) => n.id === oldId);
        if (!oldNode) return prev;

        const newId = updates.id ?? oldId;

        return {
          ...prev,
          nodes: prev.nodes.map((n: SkillData) =>
            n.id === oldId ? { ...n, ...updates, id: newId } : n
          ),
          edges:
            newId !== oldId
              ? prev.edges.map((e: any) => ({
                  ...e,
                  fromSkillId:
                    e.fromSkillId === oldId ? newId : e.fromSkillId,
                  toSkillId:
                    e.toSkillId === oldId ? newId : e.toSkillId,
                }))
              : prev.edges,
        };
      });
    },
    [setGraph]
  );

  // ---------------- UPDATE PORT OFFSET ----------------
  const updatePortOffset = useCallback(
    (nodeId: string, portId: string, offset: { x: number; y: number }) => {
      setGraph((prev: any) => ({
        ...prev,
        nodes: prev.nodes.map((n: SkillData) =>
          n.id === nodeId
            ? {
                ...n,
                inputs: n.inputs.map((p) =>
                  p.id === portId ? { ...p, offset } : p
                ),
                outputs: n.outputs.map((p) =>
                  p.id === portId ? { ...p, offset } : p
                ),
              }
            : n
        ),
      }));
    },
    [setGraph]
  );

  return { removePort, updateNode, updatePortOffset };
}
