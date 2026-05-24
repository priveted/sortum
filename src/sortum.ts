import {
  addClass,
  removeClass,
  css,
  remove,
  attr,
  on,
  off,
  append,
  removeAttr,
  queryList,
  closest,
  rect,
} from 'snappykit';
import {
  Sortum as ISortum,
  SortumDragEvent,
  SortumDropEvent,
  SortumMoveEvent,
  SortumOptions,
  SortumScrollAnimation,
} from '@/types';

export * from '@/types';

export default class Sortum implements ISortum {
  /** The container element managed by this instance */
  private container: HTMLElement;

  /** Combined CSS selector for finding sortable items */
  private fullItemsSelector: string = '';
  /** The ghost element that follows the pointer during drag */
  private ghost: HTMLElement | null = null;
  /** The element currently being dragged */
  private grabbed: HTMLElement | null = null;
  /** The current valid drop target element */
  private target: HTMLElement | null = null;
  /** The element that was dropped on */
  private dropped: HTMLElement | null = null;
  /** The destination container element */
  private destination: HTMLElement | null = null;
  /** The original index of the grabbed item before dragging */
  private fromIndex: number = -1;
  /** The index where the item will be inserted after drop */
  private toIndex: number = -1;
  /** Elements affected by the current drag operation (for animation) */
  private affected: HTMLElement[] = [];
  /** The scrollable ancestor element used for auto-scrolling */
  private scrollContainer: HTMLElement | null = null;
  /** Current auto-scroll direction ("up", "down", "left", "right") */
  private scrollDirection: string | null = null;
  /** Animation controller for smooth auto-scrolling */
  private scrollAnimation: SortumScrollAnimation | null = null;
  /** Current pressure value near the edge (0 to edgeThreshold) */
  private edgePressure: number = 0;
  /** Timer ID for touch press-and-hold delay */
  private pressTimer: number | undefined;
  /** Whether dragging/scrolling is currently active */
  private isScrolling: boolean = false;
  /** Whether the pointer has moved past the drag threshold */
  private hasMoved: boolean = false;
  /** Whether the touch has moved past the scroll threshold */
  private hasTouchMoved: boolean = false;
  /** Whether the container class was auto-added and should be removed on destroy */
  private shouldRemoveContainerClass: boolean = false;
  /** The pointer position when drag started */
  private startPosition: { clientX: number; clientY: number } | null = null;
  /** The touch position when touch started */
  private touchStart: { clientX: number; clientY: number } | null = null;
  /** The most recent event, stored for use in callbacks */
  private currentEvent: Event | null = null;

  // Options
  private group!: string;
  private swap!: boolean;
  private syncSizeOnOverlap!: boolean;
  private duration!: number;
  private easing!: string;
  private scale!: number;
  private opacity!: number;
  private pressDuration!: number;
  private dropOnContainer!: boolean;
  private dragThreshold!: number;
  private scrollThreshold!: number;
  private edgeThreshold!: number;
  private scrollSpeed!: number;
  private zIndex!: number;
  private containerSelector!: string;
  private itemsSelector!: string;
  private ignoredSelector!: string;
  private handleSelector!: string;
  private noDropSelector!: string;
  private noDragSelector!: string;
  private ghostClass!: string;
  private activeClass!: string;
  private touchClass!: string;
  private draggingClass!: string;
  private targetClass!: string;
  private animatedClass!: string;
  private dropAnimationClass!: string;
  private invalidClass!: string;

  /** @inheritdoc */
  onStart?: (data: SortumDragEvent) => boolean | void;
  /** @inheritdoc */
  onDrag?: (data: SortumDragEvent) => void;
  /** @inheritdoc */
  onMove?: (data: SortumMoveEvent) => void;
  /** @inheritdoc */
  onDrop?: (data: SortumDropEvent) => boolean | void;
  /** @inheritdoc */
  onEnd?: (data: SortumDropEvent) => void;
  /** @inheritdoc */
  onAnimationEnd?: () => void;

  /**
   * Creates a new Sortum instance.
   * @param element - The container element to make sortable
   * @param options - Configuration options (merged with defaults)
   */
  constructor(element: HTMLElement, options: SortumOptions = {}) {
    this.container = element;
    this.refresh(options);
  }

  /**
   * Gets the child elements of a parent, excluding the ghost element.
   * @param parent - The parent element to get children from, or null
   * @returns Array of child elements without the ghost
   */
  private getChildren(parent: HTMLElement | null): HTMLElement[] {
    if (!parent) return [];
    return ([...parent.children] as HTMLElement[]).filter((el) => !el.matches(`.${this.ghostClass}`));
  }

  /**
   * Checks if the pointer has moved a significant distance from the start.
   * @param start - The starting position
   * @param current - The current position
   * @param distance - The minimum distance threshold in pixels
   * @returns True if the Euclidean distance exceeds the threshold
   */
  private hasSignificantMove(
    start: { clientX: number; clientY: number },
    current: { clientX: number; clientY: number },
    distance: number,
  ): boolean {
    return Math.hypot(current.clientX - start.clientX, current.clientY - start.clientY) >= distance;
  }

  /**
   * Creates a clone of the grabbed element to serve as the drag ghost.
   * The ghost is positioned absolutely and follows the pointer.
   */
  private createGhost(): void {
    if (!this.grabbed) return;

    const { x, y, width, height } = rect(this.grabbed);
    this.ghost = this.grabbed.cloneNode(true) as HTMLElement;

    css(this.ghost, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      pointerEvents: 'none',
      zIndex: this.zIndex,
      opacity: this.opacity,
    });

    removeClass(this.ghost, [this.activeClass, this.targetClass]);
    addClass(this.ghost, this.ghostClass);

    this.ghost.animate([{ scale: `${this.scale}` }], {
      duration: 250,
      easing: this.easing,
      fill: 'forwards',
    });

    append(this.container, this.ghost);
  }

  /**
   * Removes the ghost element from the DOM and clears the reference.
   */
  private removeGhost(): void {
    if (!this.ghost) return;
    remove(this.ghost);
    this.ghost = null;
  }

  /**
   * Updates the ghost element's position relative to the pointer.
   * @param clientX - Current pointer X coordinate
   * @param clientY - Current pointer Y coordinate
   */
  private updateGhostPosition(clientX: number, clientY: number): void {
    if (!this.ghost || !this.startPosition) return;
    const dx = clientX - this.startPosition.clientX;
    const dy = clientY - this.startPosition.clientY;

    // Adjust position to account for size changes
    if (this.syncSizeOnOverlap && this.grabbed) {
      const originalRect = rect(this.grabbed);
      const ghostRect = rect(this.ghost);
      const widthDiff = (ghostRect.width - originalRect.width) / 2;
      const heightDiff = (ghostRect.height - originalRect.height) / 2;

      this.ghost.style.translate = `${dx - widthDiff}px ${dy - heightDiff}px`;
    } else {
      this.ghost.style.translate = `${dx}px ${dy}px`;
    }
  }

  /**
   * Animates an element from its current position to a target position.
   * @param params.el - The element to animate
   * @param params.x - Target X coordinate
   * @param params.y - Target Y coordinate
   * @returns The Animation object, or undefined if no movement needed
   */
  private animateItem({ el, x, y }: { el: HTMLElement; x: number; y: number }): Animation | undefined {
    const { left, top } = rect(el);

    if (x === left && y === top) return;

    addClass(el, this.animatedClass);

    const keyframes =
      el === this.grabbed
        ? [
            {
              position: 'relative',
              zIndex: 1,
              translate: `${x - left}px ${y - top}px`,
              opacity: 0.9,
              scale: `${this.scale}`,
            },
            { position: 'relative', zIndex: 1, translate: '0', opacity: 1, scale: '1' },
          ]
        : [
            { position: 'relative', zIndex: 0, scale: '1.0', translate: `${x - left}px ${y - top}px` },
            { position: 'relative', zIndex: 0, scale: `${2 - this.scale}` },
            { position: 'relative', zIndex: 0, scale: '1.0', translate: '0' },
          ];
    const anim = el.animate(keyframes as Keyframe[], {
      duration: this.duration,
      easing: this.easing,
      fill: 'forwards',
    });

    anim.addEventListener('finish', () => {
      removeClass(el, this.animatedClass);
      anim.cancel();
    });

    return anim;
  }

  /**
   * Finds the best drop target at the given coordinates.
   * Checks all containers and their children for intersection with the ghost.
   * @param clientX - Pointer X coordinate
   * @param clientY - Pointer Y coordinate
   * @returns The target element and its container (both can be null)
   */
  private findDropTarget(
    clientX: number,
    clientY: number,
  ): {
    target: HTMLElement | null;
    dropContainer: HTMLElement | null;
  } {
    if (!this.ghost) {
      const fromPoint = document.elementFromPoint(clientX, clientY) as HTMLElement;
      const target = fromPoint?.closest(`${this.fullItemsSelector}, ${this.containerSelector}`) as HTMLElement;
      const dropContainer = fromPoint?.closest(this.containerSelector) as HTMLElement;
      return { target: target || null, dropContainer: dropContainer || null };
    }

    const ghostRect = rect(this.ghost);
    const ghostCenterY = ghostRect.top + ghostRect.height / 2;
    const containers = queryList<HTMLElement>(this.containerSelector);

    for (const container of containers) {
      const containerRect = rect(container);

      const intersectsContainer = !(
        ghostRect.right < containerRect.left ||
        ghostRect.left > containerRect.right ||
        ghostRect.bottom < containerRect.top ||
        ghostRect.top > containerRect.bottom
      );

      if (!intersectsContainer) continue;

      const dropContainer = container as HTMLElement,
        children = this.getChildren(container as HTMLElement);

      const validChildren = children.filter((child) => child !== this.grabbed);

      if (validChildren.length === 0) {
        return { target: dropContainer, dropContainer };
      }

      for (const child of validChildren) {
        const childRect = rect(child);

        const intersectsChild = !(
          ghostRect.right < childRect.left ||
          ghostRect.left > childRect.right ||
          ghostRect.bottom < childRect.top ||
          ghostRect.top > childRect.bottom
        );

        if (intersectsChild) {
          return { target: child, dropContainer };
        }
      }

      const firstChild = validChildren[0];
      const lastChild = validChildren[validChildren.length - 1];
      const firstChildRect = rect(firstChild);
      const lastChildRect = rect(lastChild);

      if (ghostCenterY < firstChildRect.top + firstChildRect.height / 2) {
        return { target: firstChild, dropContainer };
      }

      if (ghostCenterY > lastChildRect.top + lastChildRect.height / 2) {
        return { target: dropContainer, dropContainer };
      }

      for (let i = 0; i < validChildren.length - 1; i++) {
        const currentChild = validChildren[i];
        const nextChild = validChildren[i + 1];
        const currentRect = rect(currentChild);
        const nextRect = rect(nextChild);
        const currentCenter = currentRect.top + currentRect.height / 2;
        const nextCenter = nextRect.top + nextRect.height / 2;

        if (ghostCenterY > currentCenter && ghostCenterY < nextCenter) {
          return { target: nextChild, dropContainer };
        }
      }

      return { target: dropContainer, dropContainer };
    }

    return { target: null, dropContainer: null };
  }

  /**
   * Checks if a position or element is a valid drop target.
   * Validates group membership, ignored selectors, and container rules.
   * @param params.clientX - X coordinate to check
   * @param params.clientY - Y coordinate to check
   * @param params.el - Element to check directly
   * @returns True if the position/element is a valid drop target
   */
  private isValidPosition({
    clientX = 0,
    clientY = 0,
    el,
  }: {
    clientX?: number;
    clientY?: number;
    el?: HTMLElement;
  } = {}): boolean {
    if (el) {
      if (el.closest(`${this.ignoredSelector}`)) return false;

      const target = el.closest(`${this.fullItemsSelector}, ${this.containerSelector}`) as HTMLElement;
      const dropContainer = el.closest(this.containerSelector) as HTMLElement;

      if (!target || !dropContainer) return false;

      const isSelf = target && closest(target, this.grabbed) === this.grabbed;
      const isSameContainer = dropContainer === this.container;
      const isContainerTarget = target === dropContainer;

      if (!this.dropOnContainer && isContainerTarget) return false;

      const group = dropContainer.dataset.sortumGroup;
      const isValidGroup = !isSameContainer && !!(group && this.group === group);

      return !isSelf && (isValidGroup || isSameContainer);
    }

    const { target, dropContainer } = this.findDropTarget(clientX, clientY);

    if (!target || !dropContainer) return false;
    if (target.closest(`${this.ignoredSelector}`)) return false;

    const isSelf = closest(target, this.grabbed) === this.grabbed;
    const isSameContainer = dropContainer === this.container;
    const isContainerTarget = target === dropContainer;

    if (!this.dropOnContainer && isContainerTarget) return false;

    const group = dropContainer.dataset.sortumGroup;
    const isValidGroup = !isSameContainer && !!(group && this.group === group);

    return !isSelf && (isValidGroup || isSameContainer);
  }

  /**
   * Creates a frame-rate-controlled animation loop.
   * @param cb - Callback to execute on each tick
   * @param fps - Target frames per second (default 60)
   * @returns Animation controller with start, stop, and tick methods
   */
  private animationEngine(cb: () => void, fps: number = 60): SortumScrollAnimation {
    const msPerFrame = 1000 / fps;
    let msPrev = 0;
    let id: number | null = null;
    const tick = () => {
      id = requestAnimationFrame(tick);
      const msNow = window.performance.now();
      const msPassed = msNow - msPrev;
      if (msPassed < msPerFrame) return;
      const excessTime = msPassed % msPerFrame;
      msPrev = msNow - excessTime;
      cb();
    };
    const start = () => {
      stop();
      msPrev = performance.now();
      id = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (id !== null) cancelAnimationFrame(id);
      id = null;
      msPrev = 0;
    };
    return { start, stop, tick };
  }

  /**
   * Finds the nearest scrollable ancestor of an element.
   * @param el - The element to start searching from
   * @returns The scrollable ancestor, or document.documentElement
   */
  private findScrollParent(el: Element | null | undefined): Element {
    while (el && el !== document.documentElement) {
      const style = getComputedStyle(el);
      if (
        (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) &&
        /^(auto|scroll)$/.test(style.overflowY)
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return document.documentElement;
  }

  /**
   * Performs one tick of auto-scrolling based on current direction and pressure.
   */
  private scrollTick(): void {
    if (!this.scrollDirection || !this.scrollContainer) return;
    const speed = this.scrollSpeed * (this.edgePressure / Math.max(this.edgeThreshold, 1));
    if (this.scrollDirection === 'up') {
      this.scrollContainer.scrollTop -= speed;
    } else if (this.scrollDirection === 'down') {
      this.scrollContainer.scrollTop += speed;
    } else if (this.scrollDirection === 'left') {
      this.scrollContainer.scrollLeft -= speed;
    } else if (this.scrollDirection === 'right') {
      this.scrollContainer.scrollLeft += speed;
    }
  }

  /**
   * Starts auto-scrolling in the specified direction.
   * @param direction - The scroll direction ("up", "down", "left", "right")
   */
  private startAutoScroll(direction: string): void {
    if (this.scrollDirection !== direction) {
      this.scrollDirection = direction;
      if (!this.scrollAnimation) {
        this.scrollAnimation = this.animationEngine(() => this.scrollTick());
        this.scrollAnimation?.start();
      }
    }
  }

  /**
   * Stops auto-scrolling and cleans up the animation.
   */
  private stopAutoScroll(): void {
    this.scrollDirection = null;
    if (this.scrollAnimation) {
      this.scrollAnimation.stop();
      this.scrollAnimation = null;
    }
  }

  /**
   * Checks if the pointer is near an edge and triggers auto-scrolling.
   * Calculates edge pressure based on distance from the edge.
   * @param ev - The pointer or touch event with client coordinates
   */
  private handleEdgeScroll(ev: PointerEvent | Touch): void {
    if (!this.scrollContainer) {
      this.scrollContainer = this.findScrollParent(this.grabbed) as HTMLElement;
    }

    const rects = rect(this.scrollContainer);
    const doc = document.documentElement;
    const isDOC = this.scrollContainer === doc;
    const topEdge = isDOC ? 0 : rects.top;
    const bottomEdge = isDOC ? window.innerHeight : rects.bottom;
    const leftEdge = isDOC ? 0 : rects.left;
    const rightEdge = isDOC ? window.innerWidth : rects.right;

    if (ev.clientY < topEdge + this.edgeThreshold) {
      this.edgePressure = Math.min(this.edgeThreshold, this.edgeThreshold - (ev.clientY - topEdge));
      this.startAutoScroll('up');
    } else if (ev.clientY > bottomEdge - this.edgeThreshold) {
      this.edgePressure = Math.min(this.edgeThreshold, this.edgeThreshold - (bottomEdge - ev.clientY));
      this.startAutoScroll('down');
    } else if (ev.clientX < leftEdge + this.edgeThreshold) {
      this.edgePressure = Math.min(this.edgeThreshold, this.edgeThreshold - (ev.clientX - leftEdge));
      this.startAutoScroll('left');
    } else if (ev.clientX > rightEdge - this.edgeThreshold) {
      this.edgePressure = Math.min(this.edgeThreshold, this.edgeThreshold - (rightEdge - ev.clientX));
      this.startAutoScroll('right');
    } else {
      this.stopAutoScroll();
    }
  }

  /**
   * Executes the drop operation: validates, reorders DOM elements, and triggers animations.
   * Handles same-container and cross-container drops, swap mode, and insert mode.
   * @param grabElement - The element being dragged
   * @param targetElement - The element under the pointer at drop time
   * @returns True if the drop was successfully performed
   */
  private performDrop(grabElement: HTMLElement, targetElement: HTMLElement): boolean {
    const source = grabElement.closest(this.containerSelector) as HTMLElement;
    const sourceChildren = this.getChildren(source);
    this.fromIndex = sourceChildren.indexOf(grabElement);
    const sourceSiblings = sourceChildren.filter((el) => el !== grabElement);

    this.dropped = targetElement?.closest(`${this.fullItemsSelector}, ${this.containerSelector}`) as HTMLElement;
    const isOntoContainer = this.dropped?.matches(this.containerSelector);
    this.destination = this.dropped?.closest(this.containerSelector) as HTMLElement;

    const destChildren = this.getChildren(this.destination);
    const isSameContainer = source === this.destination;

    this.toIndex = isOntoContainer
      ? Math.max(0, isSameContainer ? sourceSiblings.length : destChildren.length)
      : destChildren.indexOf(this.dropped);

    if (!isSameContainer && !isOntoContainer && this.dropped && this.ghost) {
      const ghostRect = rect(this.ghost);
      const droppedRect = rect(this.dropped);
      const ghostCenterY = ghostRect.top + ghostRect.height / 2;
      const droppedCenterY = droppedRect.top + droppedRect.height / 2;

      if (ghostCenterY > droppedCenterY) {
        this.toIndex++;
      }
    }

    if (!this.ghost) return false;

    this.ghost?.animate([{ scale: 1.0 }], { duration: 0, fill: 'forwards' });
    const ghostRect = rect(this.ghost);

    this.affected = [];

    if (this.swap) {
      this.affected = this.dropped ? [this.dropped] : [];
    } else if (isSameContainer) {
      const min = isOntoContainer ? this.fromIndex : Math.min(this.toIndex, this.fromIndex);
      const max = isOntoContainer ? sourceSiblings.length : Math.max(this.toIndex, this.fromIndex);
      this.affected = sourceSiblings.slice(min, max);
    } else {
      this.affected = [...sourceSiblings.slice(this.fromIndex), ...destChildren.slice(this.toIndex)];
    }

    const isValid = this.isValidPosition({ el: targetElement });
    const canDrop =
      this.onDrop?.({
        item: this.grabbed!,
        source,
        target: this.dropped,
        destination: this.destination,
        fromIndex: this.fromIndex,
        toIndex: this.toIndex,
        isValid,
        isSameContainer,
        event: this.currentEvent!,
      }) ?? true;

    const notMoved = isSameContainer && this.fromIndex === this.toIndex;
    const shouldDrop = this.dropped && isValid && canDrop && !notMoved;

    if (shouldDrop) {
      const itemsData = this.affected.map((el) => {
        const { x, y } = rect(el);
        return { el, x, y };
      });

      if (this.swap && !isOntoContainer) {
        const next = grabElement.nextSibling;
        this.destination?.insertBefore(grabElement, this.dropped!.nextSibling);
        source?.insertBefore(this.dropped!, next);
      } else {
        if (isOntoContainer) {
          append(this.destination!, grabElement);
        } else if (isSameContainer) {
          this.destination?.insertBefore(
            grabElement,
            this.toIndex < this.fromIndex ? this.dropped : this.dropped!.nextSibling,
          );
        } else {
          if (this.toIndex > destChildren.indexOf(this.dropped!)) {
            this.destination?.insertBefore(grabElement, this.dropped!.nextSibling);
          } else {
            this.destination?.insertBefore(grabElement, this.dropped);
          }
        }
      }

      itemsData.forEach(({ el, x, y }) => {
        if (el !== grabElement) this.animateItem({ el, x, y });
      });
    }

    if (ghostRect) {
      addClass(grabElement, this.dropAnimationClass);
      const anim = this.animateItem({ el: grabElement, x: ghostRect.left, y: ghostRect.top });
      if (anim) {
        anim.addEventListener('finish', () => {
          removeClass(grabElement, this.dropAnimationClass);
          this.onAnimationEnd?.();
        });
      } else {
        removeClass(grabElement, this.dropAnimationClass);
      }
    }

    this.removeGhost();
    return shouldDrop;
  }

  /**
   * Handles pointer down event: initiates drag on a valid sortable item.
   * Validates the target against ignored/handle/no-drag selectors and calls onStart/onDrag.
   * @param ev - The pointer event
   */
  private onPointerDown(ev: PointerEvent): void {
    if (this.grabbed) return;

    const target = ev.target as Element;
    const item = target.closest(`${this.fullItemsSelector}`) as HTMLElement;

    if (!item || item.parentElement !== this.container) return;

    const isIgnored =
      target !== item &&
      ((this.noDropSelector && target.closest(this.noDropSelector)) ||
        (this.noDragSelector && target.closest(this.noDragSelector)));

    if (isIgnored) return;

    if (this.handleSelector) {
      const handle = target.closest(this.handleSelector);
      if (!handle || !item.contains(handle)) return;
    }

    this.startPosition = { clientX: ev.clientX, clientY: ev.clientY };
    this.grabbed = item;
    this.fromIndex = this.getChildren(this.container).indexOf(this.grabbed);

    if (
      this.onStart?.({
        item: this.grabbed,
        container: this.container,
        index: this.fromIndex,
        event: ev,
      }) === false
    ) {
      this.reset();
      return;
    }

    ev.preventDefault();
    addClass(this.grabbed, this.activeClass);
    css(this.grabbed, { cursor: 'move', userSelect: 'none' });

    if (ev.pointerType === 'mouse') {
      this.isScrolling = true;
    }

    this.onDrag?.({
      item: this.grabbed,
      container: this.container,
      index: this.fromIndex,
      event: ev,
    });
  }

  /**
   * Handles pointer move event: updates ghost position, finds drop targets, triggers auto-scroll.
   * Only processes if dragging is active and the drag threshold has been exceeded.
   * @param ev - The pointer event
   */
  private onPointerMove(ev: PointerEvent): void {
    if (!this.grabbed || !this.isScrolling) return;
    if (this.hasMoved && !this.grabbed.hasPointerCapture(ev.pointerId)) return;

    if (!this.hasMoved && this.hasSignificantMove(this.startPosition!, ev, this.dragThreshold)) {
      this.hasMoved = true;
      this.grabbed.setPointerCapture(ev.pointerId);
      addClass(this.grabbed, this.draggingClass);
      this.createGhost();
    }

    const { clientX, clientY } = ev;
    const fromPoint = document.elementFromPoint(clientX, clientY);
    const target = fromPoint?.closest(this.fullItemsSelector) as HTMLElement;
    const isValid = this.isValidPosition({ clientX, clientY });

    if (this.ghost && this.startPosition) {
      this.ghost.style.translate = `${clientX - this.startPosition.clientX}px ${clientY - this.startPosition.clientY}px`;
      if (isValid) {
        removeClass(this.ghost, this.invalidClass);
      } else {
        addClass(this.ghost, this.invalidClass);
      }
    }

    css(this.grabbed, { cursor: isValid ? 'grab' : 'not-allowed' });

    if (target !== this.target) {
      if (this.target) {
        removeClass(this.target, this.targetClass);
        // Reset ghost size when leaving a target
        if (this.syncSizeOnOverlap && this.ghost && this.grabbed) {
          const { width, height } = rect(this.grabbed);
          css(this.ghost, { width: `${width}px`, height: `${height}px` });
        }
      }
      if (isValid && target && !target.matches(this.containerSelector)) {
        this.target = target;
        addClass(this.target, this.targetClass);
        // Sync ghost size with new target
        this.syncGhostSize(target);
      } else {
        this.target = null;
      }
    }

    this.handleEdgeScroll(ev);
    this.onMove?.({
      item: this.grabbed,
      container: this.container,
      ghost: this.ghost,
      target: this.target,
      isValid,
      event: ev,
    });
  }

  /**
   * Handles pointer up event: performs the drop operation, triggers onEnd callback, and resets state.
   * @param ev - The pointer event
   */
  private onPointerUp(ev: PointerEvent): void {
    if (!this.grabbed) return;
    this.stopAutoScroll();
    this.isScrolling = false;
    css(this.grabbed, { userSelect: '', cursor: '' });
    removeClass(this.grabbed, [this.activeClass, this.draggingClass, this.touchClass]);
    if (this.target) removeClass(this.target, this.targetClass);

    const fromPoint = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;
    this.currentEvent = ev;

    if (this.performDrop(this.grabbed, fromPoint)) {
      this.onEnd?.({
        item: this.grabbed,
        source: this.container,
        target: this.dropped,
        destination: this.destination,
        fromIndex: this.fromIndex,
        toIndex: this.toIndex,
        isValid: true,
        isSameContainer: this.container === this.destination,
        event: ev,
      });
    }

    this.reset();
    this.removeGhost();
  }

  /**
   * Handles touch start event: records touch position and starts press timer.
   * @param ev - The touch event
   */
  private onTouchStart(ev: TouchEvent): void {
    if (!this.grabbed || this.touchStart) return;
    this.touchStart = {
      clientX: ev.touches[0].clientX,
      clientY: ev.touches[0].clientY,
    };
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      if (!this.hasTouchMoved) {
        addClass(this.grabbed!, this.touchClass);
        this.isScrolling = true;
      }
    }, this.pressDuration);
  }

  /**
   * Handles touch move event: updates ghost position, triggers auto-scroll, or cancels press on significant move.
   * @param ev - The touch event
   */
  private onTouchMove(ev: TouchEvent): void {
    if (!this.grabbed || !this.touchStart) return;

    const touch = ev.touches[0];

    if (this.isScrolling) {
      if (ev.cancelable) ev.preventDefault();

      if (this.hasMoved && this.ghost) {
        this.updateGhostPosition(touch.clientX, touch.clientY);
        this.handleEdgeScroll(touch);
      }
      return;
    }

    if (!this.hasTouchMoved && this.hasSignificantMove(this.touchStart, touch, this.scrollThreshold)) {
      this.hasTouchMoved = true;
      clearTimeout(this.pressTimer);
      this.pressTimer = undefined;
    }
  }

  /**
   * Syncs the ghost element's size with the target element's size.
   * @param target - The target element to match sizes with
   */
  private syncGhostSize(target: HTMLElement): void {
    if (!this.ghost || !this.syncSizeOnOverlap || !this.grabbed) return;

    // Skip container targets
    if (target.matches(this.containerSelector)) {
      // Reset to original size
      const { width, height } = rect(this.grabbed);

      css(this.ghost, {
        width: `${width}px`,
        height: `${height}px`,
      });

      return;
    }

    const targetRect = rect(target);

    css(this.ghost, {
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
    });
  }

  /** @see ISortum.sort */
  sort(fn: (a: HTMLElement, b: HTMLElement) => number): HTMLElement[] {
    const items = this.getChildren(this.container);
    const itemsData = items.map((el) => {
      const { x, y } = rect(el);
      return { el, x, y };
    });
    const sorted = [...items].sort(fn);
    sorted.forEach((item) => append(this.container, item));
    itemsData.forEach((data) => this.animateItem(data));
    return sorted;
  }

  /** @see ISortum.reset */
  reset(): void {
    this.ghost = null;
    this.grabbed = null;
    this.target = null;
    this.dropped = null;
    this.destination = null;
    this.fromIndex = -1;
    this.toIndex = -1;
    this.affected = [];
    this.scrollContainer = null;
    this.scrollDirection = null;
    this.scrollAnimation = null;
    this.edgePressure = 0;
    this.pressTimer = undefined;
    this.isScrolling = false;
    this.startPosition = null;
    this.touchStart = null;
    this.hasMoved = false;
    this.hasTouchMoved = false;
  }

  /** @see ISortum.refresh */
  refresh(options: SortumOptions = {}): void {
    this.destroy();

    Object.assign(
      this,
      {
        group: '',
        swap: false,
        syncSizeOnOverlap: true,
        duration: 420,
        easing: 'cubic-bezier(0.6, 0, 0.6, 1)',
        scale: 1.0,
        opacity: 0.8,
        pressDuration: 15,
        dropOnContainer: true,
        dragThreshold: 0,
        scrollThreshold: 8,
        edgeThreshold: 50,
        scrollSpeed: 10,
        zIndex: 2147483647,
        containerSelector: '.sortum',
        itemsSelector: '*',
        ignoredSelector: '.sortum-ignore',
        handleSelector: '',
        noDropSelector: '',
        noDragSelector: `:is(input, select, textarea, button, label, [contenteditable=""], [contenteditable="true"], [tabindex]:not([tabindex^="-"]), a[href]:not(a[href]=""), area[href]):not(:disabled)`,
        ghostClass: 'is-sortum-ghost',
        activeClass: 'is-sortum-active',
        touchClass: 'is-sortum-touch',
        draggingClass: 'is-sortum-grab',
        targetClass: 'is-sortum-target',
        animatedClass: 'is-sortum-animated',
        dropAnimationClass: 'is-sortum-animated-drop',
        invalidClass: 'is-sortum-invalid',
      },
      options,
    );

    this.reset();

    const containerClass = this.containerSelector.replace(/^\./, '');
    if (this.containerSelector.startsWith('.') && !this.container.matches(this.containerSelector)) {
      addClass(this.container, containerClass);
      this.shouldRemoveContainerClass = true;
    }

    this.itemsSelector = (this.itemsSelector ?? '*').replace(/^(?! *>)/, '> $&');
    this.fullItemsSelector = `${this.containerSelector}${this.itemsSelector}${this.ignoredSelector ? `:not(${this.ignoredSelector})` : ''}`;

    on(this.container, 'touchstart.sortum', (evt: TouchEvent) => this.onTouchStart(evt));
    on(this.container, 'touchmove.sortum', (evt: TouchEvent) => this.onTouchMove(evt));
    on(this.container, 'pointerdown.sortum', (evt: PointerEvent) => this.onPointerDown(evt));
    on(this.container, 'pointermove.sortum', (evt: PointerEvent) => this.onPointerMove(evt));
    on(this.container, 'pointerup.sortum', (evt: PointerEvent) => this.onPointerUp(evt));
    on(this.container, 'pointercancel.sortum', (evt: PointerEvent) => this.onPointerUp(evt));

    if (this.group) {
      attr(this.container, 'data-sortum-group', this.group);
    }
  }

  /** @see ISortum.destroy */
  destroy(): void {
    this.removeGhost();
    off(this.container, 'touchstart.sortum');
    off(this.container, 'touchmove.sortum');
    off(this.container, 'pointerdown.sortum');
    off(this.container, 'pointermove.sortum');
    off(this.container, 'pointerup.sortum');
    off(this.container, 'pointercancel.sortum');
    if (this.group) removeAttr(this.container, 'data-sortum-group');
    if (this.shouldRemoveContainerClass) removeClass(this.container, this.containerSelector.replace(/^\./, ''));
  }
}
