import { useEffect, useRef } from "react";
import parkForeground from "../assets/park-layers/foreground.svg";
import parkGround from "../assets/park-layers/ground.svg";
import parkSky from "../assets/park-layers/sky.svg";
import parkSkyline from "../assets/park-layers/skyline.svg";
import parkTrees from "../assets/park-layers/trees.svg";
import philadelphiaPark from "../assets/philadelphia-park.svg";
import type { StatusContent } from "./status-content";

const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
const ART_WIDTH = 1200;
const ART_HEIGHT = 720;
const RASTER_WIDTH = 900;
const RASTER_HEIGHT = 540;
const PLANE_WIDTH = 12;
const PLANE_HEIGHT = 7.2;

interface VectorLike {
  x: number;
  y: number;
  z: number;
  set: (x: number, y: number, z: number) => void;
}

interface Object3DLike {
  position: VectorLike;
  scale: VectorLike;
}

interface CameraLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  position: VectorLike;
  updateProjectionMatrix: () => void;
}

interface SceneLike {
  add: (...objects: Object3DLike[]) => void;
}

interface Disposable {
  dispose: () => void;
}

interface TextureLike extends Disposable {
  colorSpace: unknown;
}

interface RendererLike extends Disposable {
  setClearColor: (color: number, alpha?: number) => void;
  setPixelRatio: (ratio: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  render: (scene: SceneLike, camera: CameraLike) => void;
}

interface ThreeRuntime {
  Scene: new () => SceneLike;
  OrthographicCamera: new (
    left: number,
    right: number,
    top: number,
    bottom: number,
    near: number,
    far: number
  ) => CameraLike;
  WebGLRenderer: new (options: {
    canvas: HTMLCanvasElement;
    antialias: boolean;
    alpha: boolean;
    powerPreference: "high-performance";
  }) => RendererLike;
  PlaneGeometry: new (width: number, height: number) => Disposable;
  MeshBasicMaterial: new (options: Record<string, unknown>) => Disposable;
  Mesh: new (geometry: Disposable, material: Disposable) => Object3DLike;
  CanvasTexture: new (canvas: HTMLCanvasElement) => TextureLike;
  SRGBColorSpace: unknown;
}

const toneOpacity: Record<StatusContent["tone"], number> = {
  neutral: 0.045,
  positive: 0.03,
  warning: 0.052,
  critical: 0.06
};

const layerSources = [
  {
    key: "sky",
    depth: -4,
    parallaxX: -0.025,
    parallaxY: 0.012,
    source: parkSky
  },
  {
    key: "skyline",
    depth: -3,
    parallaxX: -0.055,
    parallaxY: 0.022,
    source: parkSkyline
  },
  {
    key: "ground",
    depth: -2,
    parallaxX: 0.018,
    parallaxY: -0.01,
    source: parkGround
  },
  {
    key: "trees",
    depth: -1,
    parallaxX: 0.065,
    parallaxY: -0.022,
    source: parkTrees
  },
  {
    key: "foreground",
    depth: 0,
    parallaxX: 0.105,
    parallaxY: -0.036,
    source: parkForeground
  }
] as const;

interface LayerMesh {
  mesh: Object3DLike;
  parallaxX: number;
  parallaxY: number;
  baseX: number;
  baseY: number;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load park layer: ${source}`));
    image.src = source;
  });
}

export function CoolingParkScene({ tone }: { tone: StatusContent["tone"] }) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;

    if (
      !host ||
      !canvas ||
      window.matchMedia("(max-width: 1100px)").matches ||
      import.meta.env.VITE_DISABLE_THREE === "true"
    ) {
      return;
    }

    let cancelled = false;
    let cleanupScene: (() => void) | undefined;

    void (async () => {
      try {
        const importedModule: unknown = await import(/* @vite-ignore */ THREE_MODULE_URL);
        if (cancelled) return;

        const THREE = importedModule as ThreeRuntime;
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-6, 6, 3.6, -3.6, 0.1, 100);
        camera.position.set(0, 0, 10);

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        });
        renderer.setClearColor(0xe9f6f4, 1);

        const planeGeometry = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
        const resources: Disposable[] = [planeGeometry];

        const images = await Promise.all(layerSources.map((layer) => loadImage(layer.source)));
        if (cancelled) return;

        const textures = images.map((image) => {
          const raster = document.createElement("canvas");
          raster.width = RASTER_WIDTH;
          raster.height = RASTER_HEIGHT;
          const context = raster.getContext("2d", { alpha: true });
          if (!context) throw new Error("Unable to rasterize park layer");
          context.clearRect(0, 0, RASTER_WIDTH, RASTER_HEIGHT);
          context.drawImage(image, 0, 0, RASTER_WIDTH, RASTER_HEIGHT);

          const texture = new THREE.CanvasTexture(raster);
          texture.colorSpace = THREE.SRGBColorSpace;
          resources.push(texture);
          return texture;
        });

        const layers: LayerMesh[] = [];

        layerSources.forEach((layer, index) => {
          const material = new THREE.MeshBasicMaterial({
            map: textures[index],
            transparent: layer.key !== "sky",
            depthWrite: false,
            depthTest: false
          });
          resources.push(material);
          const mesh = new THREE.Mesh(planeGeometry, material);
          mesh.position.set(0, 0, layer.depth);
          scene.add(mesh);
          layers.push({
            mesh,
            parallaxX: layer.parallaxX,
            parallaxY: layer.parallaxY,
            baseX: 0,
            baseY: 0
          });
        });

        const washMaterial = new THREE.MeshBasicMaterial({
          color: tone === "positive" ? "#dff3eb" : "#ffffff",
          transparent: true,
          opacity: toneOpacity[tone],
          depthWrite: false,
          depthTest: false
        });
        resources.push(washMaterial);
        const wash = new THREE.Mesh(planeGeometry, washMaterial);
        wash.position.set(0, 0, 0.2);
        scene.add(wash);

        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        let frameId = 0;
        let running = false;
        let intersecting = true;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        const resize = () => {
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          const aspect = width / height;
          const artAspect = ART_WIDTH / ART_HEIGHT;
          const halfHeight = PLANE_HEIGHT / 2;
          const halfWidth = halfHeight * aspect;

          camera.left = -halfWidth;
          camera.right = halfWidth;
          camera.top = halfHeight;
          camera.bottom = -halfHeight;

          if (aspect > artAspect) {
            const visibleHeight = PLANE_WIDTH / aspect / 2;
            camera.top = visibleHeight;
            camera.bottom = -visibleHeight;
            camera.left = -PLANE_WIDTH / 2;
            camera.right = PLANE_WIDTH / 2;
          }

          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          renderer.setSize(width, height, false);
          camera.updateProjectionMatrix();
        };

        const render = (time = 0) => {
          const seconds = time * 0.001;
          currentX += (targetX - currentX) * 0.055;
          currentY += (targetY - currentY) * 0.055;

          layers.forEach((layer, index) => {
            const idle = index === 3 ? Math.sin(seconds * 0.24) * 0.006 : 0;
            layer.mesh.position.x = layer.baseX + currentX * layer.parallaxX + idle;
            layer.mesh.position.y = layer.baseY + currentY * layer.parallaxY;
          });

          renderer.render(scene, camera);
        };

        const animate = (time: number) => {
          if (!running) return;
          render(time);
          frameId = window.requestAnimationFrame(animate);
        };

        const syncAnimation = () => {
          const shouldRun =
            intersecting && document.visibilityState === "visible" && !reduceMotion.matches;

          if (shouldRun === running) {
            if (!shouldRun) render();
            return;
          }

          running = shouldRun;
          window.cancelAnimationFrame(frameId);
          if (running) frameId = window.requestAnimationFrame(animate);
          else render();
        };

        const handlePointerMove = (event: PointerEvent) => {
          const bounds = host.getBoundingClientRect();
          targetX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
          targetY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * -2;
          targetX = Math.max(-1, Math.min(1, targetX));
          targetY = Math.max(-1, Math.min(1, targetY));
        };

        const resizeObserver = new ResizeObserver(resize);
        const intersectionObserver = new IntersectionObserver(([entry]) => {
          intersecting = entry?.isIntersecting ?? false;
          syncAnimation();
        });

        resizeObserver.observe(host);
        intersectionObserver.observe(host);
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        document.addEventListener("visibilitychange", syncAnimation);
        reduceMotion.addEventListener("change", syncAnimation);

        resize();
        render();
        host.dataset.ready = "true";
        syncAnimation();

        cleanupScene = () => {
          running = false;
          window.cancelAnimationFrame(frameId);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();
          window.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("visibilitychange", syncAnimation);
          reduceMotion.removeEventListener("change", syncAnimation);
          for (const resource of resources) resource.dispose();
          renderer.dispose();
          delete host.dataset.ready;
        };
      } catch {
        delete host.dataset.ready;
      }
    })();

    return () => {
      cancelled = true;
      cleanupScene?.();
    };
  }, [tone]);

  return (
    <figure className="cooling-park-scene" ref={hostRef} aria-hidden="true">
      <img className="cooling-park-scene__fallback" src={philadelphiaPark} alt="" />
      <canvas ref={canvasRef} />
    </figure>
  );
}
