/**
 * Property Display Utilities - Composable formatters for property values
 */

export interface DisplayInfo {
  displayValue: string;
  type: string;
  isCoValue: boolean;
  coValue: any | null;
  showImagePreview: boolean;
  imageId?: string;
  isArray?: boolean;
  arrayItems?: any[];
}

/**
 * Get display value and type information for a property
 */
export function getDisplayValue(propValue: any): DisplayInfo {
  // Handle primitive values
  if (typeof propValue !== "object" || propValue === null) {
    const stringValue = String(propValue || "");
    return {
      displayValue: stringValue,
      type: typeof propValue,
      isCoValue: false,
      coValue: null,
      showImagePreview: false,
    };
  }

  // Handle arrays
  if (Array.isArray(propValue)) {
    const arrayDisplay = propValue.map((item) => String(item)).join(", ");
    return {
      displayValue: arrayDisplay,
      type: "array",
      isCoValue: false,
      coValue: null,
      showImagePreview: false,
      isArray: true,
      arrayItems: propValue,
    };
  }

  // Handle plain objects (not CoValues)
  if (!("$jazz" in propValue) && !("type" in propValue)) {
    try {
      const keys = Object.keys(propValue).filter((k) => !k.startsWith("$"));
      if (keys.length > 0) {
        return {
          displayValue: JSON.stringify(propValue, null, 2),
          type: "object",
          isCoValue: false,
          coValue: null,
          showImagePreview: false,
        };
      }
    } catch (e) {
      // Fall through
    }
  }

  // Handle extracted property objects with type
  if ("type" in propValue) {
    if (propValue.type === "ImageDefinition") {
      const imageId = (() => {
        try {
          if (propValue.coValue?.$jazz?.id) return propValue.coValue.$jazz.id;
          if (propValue.imageDefinition?.$jazz?.id) return propValue.imageDefinition.$jazz.id;
          if (propValue.rawValue?.$jazz?.id) return propValue.rawValue.$jazz.id;
        } catch (e) {
          // Ignore
        }
        return propValue.id || "unknown";
      })();

      const isImageLoaded = (() => {
        try {
          if (propValue.coValue?.$isLoaded) return true;
          if (propValue.imageDefinition?.$isLoaded) return true;
          if (propValue.rawValue?.$isLoaded) return true;
        } catch (e) {
          // Ignore
        }
        return propValue.isLoaded || false;
      })();

      return {
        displayValue: imageId,
        type: "Image",
        isCoValue: true,
        coValue: propValue.coValue || propValue.imageDefinition || propValue.rawValue,
        showImagePreview: isImageLoaded && imageId !== "unknown",
        imageId,
      };
    } else if (propValue.type === "FileStream") {
      return {
        displayValue: propValue.id || "unknown",
        type: "FileStream",
        isCoValue: true,
        coValue: propValue.coValue || propValue.fileStream,
        showImagePreview: false,
      };
    } else if (propValue.type === "CoMap") {
      return {
        displayValue: propValue.id || "unknown",
        type: "CoMap",
        isCoValue: true,
        coValue: propValue.coValue,
        showImagePreview: false,
      };
    } else if (propValue.type === "CoList") {
      return {
        displayValue: `${propValue.length || 0} items`,
        type: "CoList",
        isCoValue: true,
        coValue: propValue.coValue,
        showImagePreview: false,
      };
    } else if (propValue.type === "CoValue") {
      return {
        displayValue: propValue.id || "unknown",
        type: "CoValue",
        isCoValue: true,
        coValue: propValue.coValue,
        showImagePreview: false,
      };
    } else {
      return {
        displayValue: String(propValue),
        type: propValue.type || "unknown",
        isCoValue: false,
        coValue: null,
        showImagePreview: false,
      };
    }
  }

  // Fallback
  return {
    displayValue: String(propValue),
    type: typeof propValue,
    isCoValue: false,
    coValue: null,
    showImagePreview: false,
  };
}

/**
 * Determine property type
 */
export function getPropertyType(propValue: any): string {
  const displayInfo = getDisplayValue(propValue);
  return displayInfo.type;
}

