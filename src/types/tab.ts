export type Tab =
  | {
      type: "bot";
      id: string;
      label: string;
      path: string;
      botPath: string;
    }
  | {
      type: "Basic";
      id: string;
      label: string;
      path: string;
      skillId: string;
      botPath: string;
    }
  | {
      type: "Complex";
      id: string;
      label: string;
      path: string;
      skillId: string;
      botPath: string;
    };
