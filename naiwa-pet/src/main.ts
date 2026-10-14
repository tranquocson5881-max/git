import { invoke } from "@tauri-apps/api/core";
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize, PhysicalPosition } from "@tauri-apps/api/window";
import "./styles.css";

type PetManifest = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  idleFrame: string;
  framePattern: string;
  audio: string;
};

const DEFAULT_PET_ID = "naiwa";
const APP_NAME = "奶蛙";
const PET_SIZE_OPTIONS = [
  { id: "max", label: "超大号", width: 360, height: 480 },
  { id: "large", label: "大号", width: 240, height: 320 },
  { id: "medium", label: "中号", width: 180, height: 240 },
  { id: "small", label: "小号", width: 120, height: 160 },
  { id: "tiny", label: "极小", width: 90, height: 120 },
  { id: "mini", label: "迷你", width: 60, height: 80 },
] as const;

type PetSizeId = (typeof PET_SIZE_OPTIONS)[number]["id"];

const appWindow = getCurrentWindow();
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

const pet = document.createElement("img");
pet.className = "pet";
pet.alt = "Naiwa desktop pet";
pet.draggable = false;

const hint = document.createElement("div");
hint.className = "loading";
hint.textContent = "Loading...";

app.append(hint, pet);

const isPetSizeId = (value: string | null): value is PetSizeId =>
  PET_SIZE_OPTIONS.some((size) => size.id === value);

const getPetSize = (sizeId: PetSizeId) => PET_SIZE_OPTIONS.find((size) => size.id === sizeId) ?? PET_SIZE_OPTIONS[0];

const getInitialPetSizeId = (): PetSizeId => {
  const size = new URLSearchParams(window.location.search).get("size");
  return isPetSizeId(size) ? size : "medium";
};

let currentPetSizeId: PetSizeId = getInitialPetSizeId();
let contextMenuPromise: Promise<Menu> | null = null;
let lastContextMenuPosition = { x: 64, y: 64 };
const petSizeItems = new Map<PetSizeId, CheckMenuItem>();
let freeMovement = false;
let movementItem: CheckMenuItem | null = null;
let movementTimer: ReturnType<typeof setTimeout> | null = null;
let hoveringPet = false;
let menuOpen = false;
let movementGeneration = 0;
let direction = Math.random() * Math.PI * 2;
let nextTurn = 0;

const setFreeMovement = async (enabled: boolean) => {
  freeMovement = enabled;
  const generation = ++movementGeneration;
  if (movementTimer !== null) clearTimeout(movementTimer);
  movementTimer = null;
  await movementItem?.setChecked(enabled);
  if (enabled && generation === movementGeneration) void movePet(generation);
};

const movePet = async (generation: number): Promise<void> => {
  try {
    if (!freeMovement || generation !== movementGeneration) return;
    if (!hoveringPet && !menuOpen) {
      const [monitor, position, size] = await Promise.all([
        currentMonitor(), appWindow.outerPosition(), appWindow.outerSize(),
      ]);
      if (!freeMovement || generation !== movementGeneration) return;
      if (monitor) {
        const area = monitor.workArea;
        const minX = area.position.x;
        const minY = area.position.y;
        const maxX = Math.max(minX, minX + area.size.width - size.width);
        const maxY = Math.max(minY, minY + area.size.height - size.height);
        if (Date.now() >= nextTurn) {
          direction += (Math.random() - 0.5) * Math.PI;
          nextTurn = Date.now() + 2500 + Math.random() * 3500;
        }
        const step = 10 * monitor.scaleFactor;
        const x = position.x + Math.cos(direction) * step;
        const y = position.y + Math.sin(direction) * step;
        if (x < minX || x > maxX) direction = Math.PI - direction;
        if (y < minY || y > maxY) direction = -direction;
        await appWindow.setPosition(new PhysicalPosition(
          Math.round(Math.min(maxX, Math.max(minX, x))),
          Math.round(Math.min(maxY, Math.max(minY, y))),
        ));
      }
    }
  } catch (error) {
    console.error("Failed to move pet", error);
    if (generation === movementGeneration) {
      freeMovement = false;
      await movementItem?.setChecked(false);
    }
  } finally {
    if (freeMovement && generation === movementGeneration) {
      movementTimer = setTimeout(() => { void movePet(generation); }, 200);
    }
  }
};

pet.addEventListener("pointerenter", () => { hoveringPet = true; });
pet.addEventListener("pointerleave", () => { hoveringPet = false; });
window.addEventListener("pagehide", () => {
  freeMovement = false;
  movementGeneration++;
  if (movementTimer !== null) clearTimeout(movementTimer);
});

const syncPetSizeChecks = async () => {
  await Promise.all(
    PET_SIZE_OPTIONS.map((size) => petSizeItems.get(size.id)?.setChecked(size.id === currentPetSizeId)),
  );
};

const setPetSize = async (sizeId: PetSizeId) => {
  const size = getPetSize(sizeId);

  currentPetSizeId = sizeId;
  await appWindow.setSize(new LogicalSize(size.width, size.height));
  await syncPetSizeChecks();
};

const createAnotherPet = () => {
  const size = getPetSize(currentPetSizeId);
  const label = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const window = new WebviewWindow(label, {
    url: `/?size=${currentPetSizeId}`,
    title: APP_NAME,
    width: size.width,
    height: size.height,
    x: lastContextMenuPosition.x + 24,
    y: lastContextMenuPosition.y + 24,
    resizable: false,
    decorations: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    shadow: false,
  });

  window.once("tauri://error", (event) => {
    console.error("Failed to create pet window", event.payload);
  });
};

const createContextMenu = async () => {
  const addPetItem = await MenuItem.new({
    id: "add-pet",
    text: "再来一只",
    action: createAnotherPet,
  });

  const removePetItem = await MenuItem.new({
    id: "remove-pet",
    text: "减少一只",
    action: () => {
      void appWindow.close().catch((error) => {
        console.error("Failed to close pet window", error);
      });
    },
  });

  const sizeItems = await Promise.all(
    PET_SIZE_OPTIONS.map(async (size) => {
      const item = await CheckMenuItem.new({
        id: `pet-size-${size.id}`,
        text: size.label,
        checked: size.id === currentPetSizeId,
        action: () => {
          void setPetSize(size.id);
        },
      });

      petSizeItems.set(size.id, item);
      return item;
    }),
  );

  movementItem = await CheckMenuItem.new({
    id: "free-movement",
    text: "自由移动",
    checked: freeMovement,
    action: () => { void setFreeMovement(!freeMovement); },
  });

  // 1. 尺寸设定只包含尺寸相关的选项
  const sizeMenu = await Submenu.new({
    id: "pet-size-menu",
    text: "尺寸设定",
    items: sizeItems, 
  });

  const closeItem = await MenuItem.new({
    id: "close-app",
    text: "关闭",
    action: () => {
      void invoke("close_app").catch((error) => {
        console.error("Failed to close pet app", error);
      });
    },
  });

  // Pet count controls, followed by size settings.
  return Menu.new({ 
    items: [
      addPetItem,
      removePetItem,
      movementItem,
      await PredefinedMenuItem.new({ item: "Separator" }), 
      sizeMenu,
      await PredefinedMenuItem.new({ item: "Separator" }),
      closeItem
    ] 
  });
};

const getContextMenu = () => {
  contextMenuPromise ??= createContextMenu();
  return contextMenuPromise;
};

const enableContextMenu = () => {
  app.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    lastContextMenuPosition = { x: event.screenX, y: event.screenY };

    const menu = await getContextMenu();
    await syncPetSizeChecks();
    menuOpen = true;
    try {
      await menu.popup(new LogicalPosition(event.clientX, event.clientY), appWindow);
    } finally {
      menuOpen = false;
    }
  });
};

const loadManifest = async (petId: string): Promise<PetManifest> => {
  const response = await fetch(`/pets/${petId}/manifest.json`);
  if (!response.ok) {
    throw new Error(`Failed to load pet manifest: ${response.status}`);
  }

  return response.json() as Promise<PetManifest>;
};

const formatFramePath = (manifest: PetManifest, index: number) => {
  const frameIndex = String(index).padStart(4, "0");
  return `/pets/${manifest.id}/${manifest.framePattern.replace("{index}", frameIndex)}`;
};

const preloadImages = async (manifest: PetManifest) => {
  const promises = Array.from({ length: manifest.frameCount }, (_, index) => {
    const image = new Image();
    image.decoding = "async";
    image.src = formatFramePath(manifest, index);
    return image.decode().catch(() => undefined);
  });

  await Promise.all(promises);
};

const loadImage = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const createPetPlayer = async (manifest: PetManifest) => {
  const audio = new Audio(`/pets/${manifest.id}/${manifest.audio}`);
  audio.preload = "auto";

  const idleSrc = `/pets/${manifest.id}/${manifest.idleFrame}`;
  let animationFrame = 0;
  let playing = false;
  let startTime = 0;

  const setIdle = () => {
    playing = false;
    window.cancelAnimationFrame(animationFrame);
    pet.src = idleSrc;
  };

  const render = (now: number) => {
    const elapsed = now - startTime;
    const frame = Math.floor((elapsed / 1000) * manifest.fps);

    if (frame >= manifest.frameCount) {
      setIdle();
      return;
    }

    pet.src = formatFramePath(manifest, frame);
    animationFrame = window.requestAnimationFrame(render);
  };

  const play = async () => {
    window.cancelAnimationFrame(animationFrame);
    audio.pause();
    audio.currentTime = 0;
    playing = true;
    startTime = performance.now();
    pet.src = formatFramePath(manifest, 0);
    animationFrame = window.requestAnimationFrame(render);

    try {
      await audio.play();
    } catch {
      // Browser policies should allow click-triggered playback, but animation still works if audio is blocked.
    }
  };

  audio.addEventListener("ended", () => {
    if (!playing) {
      audio.currentTime = 0;
    }
  });

  setIdle();

  return play;
};

const enablePetInteraction = (play: () => Promise<void>) => {
  let press: { pointerId: number; x: number; y: number; dragging: boolean } | null = null;

  const releaseCapture = (pointerId: number) => {
    if (pet.hasPointerCapture(pointerId)) {
      pet.releasePointerCapture(pointerId);
    }
  };

  pet.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || press) return;
    press = { pointerId: event.pointerId, x: event.screenX, y: event.screenY, dragging: false };
    pet.setPointerCapture(event.pointerId);
  });

  pet.addEventListener("pointermove", (event) => {
    if (!press || press.pointerId !== event.pointerId || press.dragging) return;
    if (Math.hypot(event.screenX - press.x, event.screenY - press.y) < 6) return;
    press.dragging = true;
    void setFreeMovement(false);
    releaseCapture(event.pointerId);
    void appWindow.startDragging().catch((error) => {
      console.error("Failed to drag pet window", error);
    });
  });

  pet.addEventListener("pointerup", (event) => {
    if (!press || press.pointerId !== event.pointerId || event.button !== 0) return;
    const shouldPlay = !press.dragging;
    press = null;
    releaseCapture(event.pointerId);
    if (shouldPlay) void play();
  });

  pet.addEventListener("pointercancel", () => { press = null; });
  pet.addEventListener("lostpointercapture", () => { press = null; });
};

const boot = async () => {
  try {
    const manifest = await loadManifest(DEFAULT_PET_ID);
    document.documentElement.style.setProperty("--pet-aspect", `${manifest.width} / ${manifest.height}`);
    pet.style.aspectRatio = `${manifest.width} / ${manifest.height}`;
    const idleSrc = `/pets/${manifest.id}/${manifest.idleFrame}`;
    await loadImage(idleSrc);
    pet.src = idleSrc;
    const play = await createPetPlayer(manifest);

    hint.remove();
    pet.classList.add("is-ready");
    enablePetInteraction(play);
    enableContextMenu();
    void preloadImages(manifest);
  } catch (error) {
    hint.textContent = error instanceof Error ? error.message : "Failed to load pet";
  }
};

void boot();



