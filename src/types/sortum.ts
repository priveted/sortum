/**
 * Event data emitted when dragging starts and during drag.
 */
export interface SortumDragEvent {
  /** The dragged HTML element */
  item: HTMLElement;
  /** The container element where the drag originated */
  container: HTMLElement;
  /** The initial index of the dragged item */
  index: number;
  /** The original DOM event */
  event: Event;
}

/**
 * Event data emitted during pointer/touch movement while dragging.
 */
export interface SortumMoveEvent {
  /** The dragged HTML element */
  item: HTMLElement;
  /** The container element where the drag originated */
  container: HTMLElement;
  /** The ghost element following the pointer, or null if not created yet */
  ghost: HTMLElement | null;
  /** The current drop target element under the pointer, or null */
  target: HTMLElement | null;
  /** Whether the current position is a valid drop target */
  isValid: boolean;
  /** The original DOM event */
  event: Event;
}

/**
 * Event data emitted when an item is dropped.
 */
export interface SortumDropEvent {
  /** The dragged HTML element */
  item: HTMLElement;
  /** The source container element */
  source: HTMLElement;
  /** The target element where the item was dropped, or null */
  target: HTMLElement | null;
  /** The destination container element, or null */
  destination: HTMLElement | null;
  /** The index of the item before the drag */
  fromIndex: number;
  /** The index where the item was inserted after the drop */
  toIndex: number;
  /** Whether the drop position is valid */
  isValid: boolean;
  /** Whether the item was dropped in the same container */
  isSameContainer: boolean;
  /** The original DOM event */
  event: Event;
}

/**
 * Configuration options for Sortum.
 */
export interface SortumOptions {
  /** Group name for cross-container sorting. Containers with the same group can exchange items. */
  group?: string;
  /** If true, dragged item swaps position with the target instead of inserting */
  swap?: boolean;
  /** Whether to sync the ghost size with the target element on overlap. Default: true */
  syncSizeOnOverlap?: boolean;
  /** Animation duration in milliseconds for item transitions */
  duration?: number;
  /** CSS easing function for animations */
  easing?: string;
  /** Scale factor applied to the ghost element */
  scale?: number;
  /** Opacity of the ghost element during drag */
  opacity?: number;
  /** Delay in milliseconds before drag starts on touch devices */
  pressDuration?: number;
  /** If true, items can be dropped directly on the container (appended to end) */
  dropOnContainer?: boolean;
  /** Minimum pixel distance to move before drag initiates */
  dragThreshold?: number;
  /** Minimum pixel distance to move on touch before drag initiates */
  scrollThreshold?: number;
  /** Distance in pixels from container edges to trigger auto-scroll */
  edgeThreshold?: number;
  /** Speed of auto-scroll in pixels per frame */
  scrollSpeed?: number;
  /** z-index applied to the ghost element */
  zIndex?: number;
  /** CSS selector for sortable containers */
  containerSelector?: string;
  /** CSS selector for sortable items within containers */
  itemsSelector?: string;
  /** CSS selector for elements that should be ignored during drag */
  ignoredSelector?: string;
  /** CSS selector for drag handle elements */
  handleSelector?: string;
  /** CSS selector for elements that cannot receive drops */
  noDropSelector?: string;
  /** CSS selector for elements that should not initiate drag */
  noDragSelector?: string;
  /** CSS class added to the ghost element */
  ghostClass?: string;
  /** Determines the DOM element to which the drag ghost (visual clone) will be appended during the drag operation. */
  ghostAppendTo?: HTMLElement;
  /** CSS class added to the dragged item when active */
  activeClass?: string;
  /** CSS class added on touch devices */
  touchClass?: string;
  /** CSS class added to the dragged item while dragging */
  draggingClass?: string;
  /** CSS class added to the current drop target */
  targetClass?: string;
  /** CSS class added during position animations */
  animatedClass?: string;
  /** CSS class added during the drop animation */
  dropAnimationClass?: string;
  /** CSS class added to the ghost when over an invalid position */
  invalidClass?: string;
  /** Maximum number of items allowed in a container. 0 means unlimited. Default: 0 */
  maxItems?: number;
  /**
   * Called when a drag is about to start.
   * @param data - The drag event data
   * @returns Return false to prevent the drag from starting
   */
  onStart?: (data: SortumDragEvent) => boolean | void;
  /**
   * Called when dragging begins.
   * @param data - The drag event data
   */
  onDrag?: (data: SortumDragEvent) => void;
  /**
   * Called during pointer movement while dragging.
   * @param data - The move event data
   */
  onMove?: (data: SortumMoveEvent) => void;
  /**
   * Called before an item is dropped.
   * @param data - The drop event data
   * @returns Return false to prevent the drop
   */
  onDrop?: (data: SortumDropEvent) => boolean | void;
  /**
   * Called after a successful drop.
   * @param data - The drop event data
   */
  onEnd?: (data: SortumDropEvent) => void;
  /**
   * Called when all drop animations have completed.
   */
  onAnimationEnd?: () => void;
}

/**
 * Controls for the auto-scroll animation loop.
 */
export interface SortumScrollAnimation {
  /** Starts the animation loop */
  start: () => void;
  /** Stops the animation loop */
  stop: () => void;
  /** Executes one tick of the animation */
  tick: () => void;
}

/** The mode of inserting items: "insert" or "push" */
export type SortumMode = 'insert' | 'push';

/**
 * Public interface for the Sortum instance.
 */
export interface Sortum {
  /**
   * Sorts items using a comparator function with animated transitions.
   * @param fn - Comparator function receiving two elements, returning a number
   * @returns The sorted array of elements
   */
  sort(fn: (a: HTMLElement, b: HTMLElement) => number): HTMLElement[];

  /**
   * Resets the internal state of the instance (clears grabbed item, ghost, etc.).
   */
  reset(): void;

  /**
   * Refreshes the instance with new options, re-binds events.
   * @param options - New configuration options to merge with defaults
   */
  refresh(options?: SortumOptions): void;

  /**
   * Destroys the instance, removing all event listeners and cleaning up.
   */
  destroy(): void;
}
