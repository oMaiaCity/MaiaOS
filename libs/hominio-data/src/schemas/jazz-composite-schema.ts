/**
 * Comprehensive JazzComposite JSON Schema Example
 * 
 * Demonstrates all supported JSON Schema types and Jazz CoValue types
 * This schema includes every type that can be converted to Zod/CoValue schemas
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JazzCompositeJsonSchema: any = {
  type: "object",
  required: [
    "stringValue",
    "numberValue",
    "booleanValue",
    "enumValue",
    "passthroughObject",
    "nestedCoMap",
    "coListOfStrings",
    "coListOfNumbers",
    "coFeed",
    "coImage",
    "coFileStream",
    "coPlainText",
    "coRichText",
  ],
  properties: {
    // ===== Primitive Zod Types =====

    stringValue: {
      type: "string",
      description: "Simple string primitive",
    },

    numberValue: {
      type: "number",
      description: "Number primitive",
    },

    booleanValue: {
      type: "boolean",
      description: "Boolean primitive",
    },

    dateValue: {
      type: "date",
      description: "Date primitive",
    },

    enumValue: {
      enum: ["option1", "option2", "option3"],
      description: "Enum/literal type",
    },

    // ===== Passthrough Object (z.object().passthrough()) =====

    passthroughObject: {
      type: "object",
      properties: {
        id: {
          type: "string",
        },
        metadata: {
          type: "object",
          properties: {
            createdAt: {
              type: "string",
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
      },
      description: "Passthrough object (non-collaborative internally)",
    },

    // ===== Jazz CoValue Types =====

    nestedCoMap: {
      type: "o-map",
      properties: {
        nestedString: {
          type: "string",
        },
        nestedNumber: {
          type: "number",
        },
        nestedBoolean: {
          type: "boolean",
        },
      },
      required: ["nestedString", "nestedNumber"],
      description: "Nested CoMap",
    },

    coListOfStrings: {
      type: "o-list",
      items: {
        type: "string",
      },
      description: "CoList of strings",
    },

    coListOfNumbers: {
      type: "o-list",
      items: {
        type: "number",
      },
      description: "CoList of numbers",
    },

    coListOfCoMaps: {
      type: "o-list",
      items: {
        type: "o-map",
        properties: {
          itemName: {
            type: "string",
          },
          itemValue: {
            type: "number",
          },
        },
        required: ["itemName"],
      },
      description: "CoList of CoMaps",
    },

    coFeed: {
      type: "o-feed",
      items: {
        type: "string",
      },
      description: "CoFeed of strings",
    },

    coImage: {
      type: "o-image",
      description: "ImageDefinition CoValue",
    },

    coFileStream: {
      type: "o-filestream",
      description: "FileStream CoValue",
    },

    coPlainText: {
      type: "o-text",
      description: "CoPlainText CoValue",
    },

    coRichText: {
      type: "o-richText",
      description: "CoRichText CoValue",
    },

    // ===== Optional Types =====

    optionalString: {
      type: "string",
      description: "Optional string (Zod optional)",
    },

    optionalNumber: {
      type: "number",
      description: "Optional number (Zod optional)",
    },

    optionalCoMap: {
      type: "o-map",
      properties: {
        optionalField: {
          type: "string",
        },
      },
      description: "Optional CoMap (co.optional)",
    },

    optionalCoList: {
      type: "o-list",
      items: {
        type: "string",
      },
      description: "Optional CoList (co.optional)",
    },

    optionalCoFeed: {
      type: "o-feed",
      items: {
        type: "string",
      },
      description: "Optional CoFeed (co.optional)",
    },

    optionalCoImage: {
      type: "o-image",
      description: "Optional ImageDefinition (co.optional)",
    },

    optionalCoFileStream: {
      type: "o-filestream",
      description: "Optional FileStream (co.optional)",
    },

    // ===== Nested Structures =====

    nestedStructure: {
      type: "o-map",
      properties: {
        innerList: {
          type: "o-list",
          items: {
            type: "string",
          },
        },
        innerFeed: {
          type: "o-feed",
          items: {
            type: "number",
          },
        },
        innerCoMap: {
          type: "o-map",
          properties: {
            deepString: {
              type: "string",
            },
          },
          required: ["deepString"],
        },
      },
      required: ["innerList"],
      description: "Deeply nested CoValue structure",
    },
  },
};

