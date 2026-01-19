export interface AssetItem {
  id: string;
  label: string;
  type: "skill" | "utility" | "std_skill" | "static";
  preview?: React.ReactNode;
}
