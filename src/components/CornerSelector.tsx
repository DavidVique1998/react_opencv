import { useRef, useEffect, useCallback, useState } from "react";
import cv from "@techstark/opencv-js";

type LaserPoint = {
  x: number;
  y: number;
};

const CornerSelector = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeCorner, setActiveCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right" | null>(null);
  const [cornerPositions, setCornerPositions] = useState<Record<string, LaserPoint | null>>({
    "top-left": null,
    "top-right": null,
    "bottom-left": null,
    "bottom-right": null,
  });

  const [currentLaserPoint, setCurrentLaserPoint] = useState<LaserPoint | null>(null);
  const [isLaserDetected, setIsLaserDetected] = useState(false);
  const [cameraInfo, setCameraInfo] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>("N/A");

  const startCamera = useCallback(async () => {
    if (videoRef.current) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevice = devices.find((device) => device.kind === "videoinput");

        if (videoDevice) {
          setCameraInfo(videoDevice.label); // Guarda el nombre de la cámara detectada
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const videoWidth = videoRef.current!.videoWidth;
            const videoHeight = videoRef.current!.videoHeight;

            canvas.width = videoWidth;
            canvas.height = videoHeight;

            setResolution(`${videoWidth}x${videoHeight}`); // Guarda la resolución del video
          }
        };
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    }
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || video.readyState !== 4) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    const src = cv.imread(canvas);
    const hsv = new cv.Mat();
    const mask = new cv.Mat();

    cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);

    const lowerRed = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 120, 120, 0]);
    const upperRed = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [10, 255, 255, 255]);

    cv.inRange(hsv, lowerRed, upperRed, mask);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let detectedPoint: LaserPoint | null = null;
    let laserDetected = false;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      detectedPoint = { x: centerX, y: centerY };
      cv.circle(src, { x: centerX, y: centerY }, 10, [255, 0, 0, 255], 2);
      laserDetected = true;
      contour.delete();
    }

    setCurrentLaserPoint(detectedPoint);
    setIsLaserDetected(laserDetected);

    cv.imshow(canvas, src);

    src.delete();
    hsv.delete();
    mask.delete();
    lowerRed.delete();
    upperRed.delete();
    contours.delete();
    hierarchy.delete();
  }, []);

  const captureCorner = useCallback(() => {
    if (activeCorner && currentLaserPoint) {
      setCornerPositions((prev) => ({
        ...prev,
        [activeCorner]: currentLaserPoint,
      }));
      setActiveCorner(null);
    }
  }, [activeCorner, currentLaserPoint]);

  useEffect(() => {
    startCamera();
    const interval = setInterval(processFrame, 50);
    return () => clearInterval(interval);
  }, [startCamera, processFrame]);

  return (
    <div style={{ textAlign: "center" }}>
      {/* Información de la cámara */}
      <div style={{ marginBottom: "20px", textAlign: "left", padding: "10px", border: "1px solid #ccc" }}>
        <h4>Información de la Cámara</h4>
        <p><strong>Cámara:</strong> {cameraInfo || "No detectada"}</p>
        <p><strong>Resolución:</strong> {resolution}</p>
        <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
      </div>

      {/* Botones para seleccionar esquinas */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
          <button
            key={corner}
            onClick={() => setActiveCorner(corner as "top-left" | "top-right" | "bottom-left" | "bottom-right")}
            disabled={Boolean(cornerPositions[corner])}
          >
            {corner.replace("-", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {/* Vista del video y canvas */}
      <div
        style={{
          width: "100%",
          maxWidth: "1280px",
          margin: "20px auto",
          backgroundColor: "black",
          position: "relative",
        }}
      >
        <video ref={videoRef} style={{ display: "none" }} />
        <canvas ref={canvasRef} style={{ width: "100%" }} />
      </div>

      {/* Botón de captura */}
      <button
        onClick={captureCorner}
        disabled={!isLaserDetected}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          fontWeight: "bold",
          border: `2px solid ${isLaserDetected ? "green" : "red"}`,
          color: "white",
          cursor: isLaserDetected ? "pointer" : "not-allowed",
          borderRadius: "5px",
        }}
      >
        {isLaserDetected ? "Capturar Esquina" : "Esperando Láser"}
      </button>

      {/* Información de esquinas capturadas */}
      <div style={{ marginTop: "20px", textAlign: "left", padding: "10px", border: "1px solid #ccc" }}>
        <h3>Esquinas detectadas:</h3>
        <pre>{JSON.stringify(cornerPositions, null, 2)}</pre>
      </div>
    </div>
  );
};

export default CornerSelector;
