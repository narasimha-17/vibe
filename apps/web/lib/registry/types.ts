import type { Node } from "@/lib/types";

export type FieldType = "text" | "textarea" | "color" | "image" | "select" | "array";

export interface EditableField {
  key: string;
  label: string;
  type: FieldType;
  path: string; // dot path into node.props
  options?: string[];
  itemFields?: EditableField[]; // for type "array": fields per list item
  itemLabel?: string; // label used for "+ Add X" button
}

export interface VariantDef {
  id: string;
  label: string;
  render: (props: Record<string, any>) => React.ReactNode;
}

export interface ComponentDef {
  type: string;
  label: string;
  category: string;
  icon: string; // simple glyph, keeps the palette dependency-free
  variants: VariantDef[];
  defaultProps: Record<string, any>;
  editableFields: EditableField[];
}

export function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function setByPath(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const clone = structuredClone(obj ?? {});
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cursor[key] == null) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}
