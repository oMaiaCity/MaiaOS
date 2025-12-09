/**
 * Todo List Leaf Component
 */

import type { LeafNode } from "../../../view/leaf-types";
import { todoItemLeaf } from "./todoItem";

export const todoListLeaf: LeafNode = {
  tag: "div",
  classes: ["min-h-[100px]"],
  bindings: {
    foreach: {
      items: "data.todos",
      key: "id",
      leaf: todoItemLeaf,
    },
  },
};

