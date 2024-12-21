import { useRef, useEffect, useCallback, useState } from "react";
import cv from "@techstark/opencv-js";

/** Types **/
type LaserPoint = {
  x: number;
  y: number;
  timestamp: string;
};

type GroupedPoints = {
  key: string;
  points: LaserPoint[];
  count: number;
};

type PerformanceStats = {
  frameTime: number;
  pointsPerSecond: number;
  totalPoints: number;
  fps: number;
  resolution: string;
};

const CameraOpenCV = () => {
  /** References **/
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** States **/
  const [isOriginalLarge, setIsOriginalLarge] = useState(true);
  const [laserPoints, setLaserPoints] = useState<LaserPoint[]>([]);
  const [groupedPoints, setGroupedPoints] = useState<GroupedPoints[]>([]);
  const [stats, setStats] = useState<PerformanceStats>({
    frameTime: 0,
    pointsPerSecond: 0,
    totalPoints: 0,
    fps: 0,
    resolution: "640x360",
  });

  /** Variables **/
  const processingWidth = 640;
  const processingHeight = 360;

  /** Functions **/

  const startCamera = useCallback(async () => {
    if (videoRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    }
  }, []);

  const groupPoints = useCallback((points: LaserPoint[]): GroupedPoints[] => {
    const grouped = points.reduce<Record<string, { points: LaserPoint[]; count: number }>>(
      (acc, point) => {
        const key = `${Math.floor(point.x / 100)}-${Math.floor(point.y / 100)}-${point.timestamp.slice(0, 19)}`;
        if (!acc[key]) acc[key] = { points: [], count: 0 };
        acc[key].points.push(point);
        acc[key].count++;
        return acc;
      },
      {}
    );
    return Object.entries(grouped).map(([key, value]) => ({ key, ...value }));
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || video.readyState !== 4) return;

    const start = performance.now();

    if (canvas.width !== processingWidth || canvas.height !== processingHeight) {
      canvas.width = processingWidth;
      canvas.height = processingHeight;
    }

    ctx.drawImage(video, 0, 0, processingWidth, processingHeight);

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

    const newLaserPoints: LaserPoint[] = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      newLaserPoints.push({ x: centerX, y: centerY, timestamp });
      cv.circle(src, { x: centerX, y: centerY }, 10, [255, 0, 0, 255], 2);
      contour.delete();
    }

    setLaserPoints((prevPoints) => {
      const updatedPoints = [...prevPoints, ...newLaserPoints];
      setGroupedPoints(groupPoints(updatedPoints));

      // Update performance stats
      const frameTime = performance.now() - start;
      const fps = frameTime > 0 ? (1000 / frameTime) : 0;
      setStats({
        frameTime,
        pointsPerSecond: newLaserPoints.length / (frameTime / 1000),
        totalPoints: updatedPoints.length,
        fps,
        resolution: `${processingWidth}x${processingHeight}`,
      });

      return updatedPoints;
    });

    cv.imshow(canvas, src);

    src.delete();
    hsv.delete();
    mask.delete();
    lowerRed.delete();
    upperRed.delete();
    contours.delete();
    hierarchy.delete();
  }, [groupPoints, processingWidth, processingHeight]);

  useEffect(() => {
    startCamera();
    const interval = setInterval(processFrame, 50);
    return () => clearInterval(interval);
  }, [startCamera, processFrame]);

  const toggleView = () => {
    setIsOriginalLarge((prev) => !prev);
  };

  /** Render **/
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        <div
          style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", cursor: "pointer" }}
          onClick={toggleView}
        >
          <div
            style={{
              width: isOriginalLarge ? "1280px" : "320px",
              height: isOriginalLarge ? "720px" : "180px",
              backgroundColor: "black",
              transition: "width 0.3s, height 0.3s",
            }}
          >
            <video
              ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          <div
            style={{
              width: isOriginalLarge ? "320px" : "1280px",
              height: isOriginalLarge ? "180px" : "720px",
              backgroundColor: "black",
              transition: "width 0.3s, height 0.3s",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <p>React + OpenCV. (Haz clic en la vista pequeña para intercambiar tamaños)</p>

        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: "20px" }}>
          <div style={{ flex: 1 }}>
            <h3>Estadísticas de Rendimiento</h3>
            <ul>
              <li>Tiempo por fotograma: {stats.frameTime.toFixed(2)} ms</li>
              <li>FPS (Frames por segundo): {stats.fps.toFixed(2)}</li>
              <li>Resolución de procesamiento: {stats.resolution}</li>
              <li>Puntos detectados por segundo: {stats.pointsPerSecond.toFixed(2)}</li>
              <li>Total de puntos detectados: {stats.totalPoints}</li>
            </ul>
          </div>

          <div style={{ flex: 1 }}>
            <h3>Puntos Agrupados</h3>
            {groupedPoints.map((group, index) => (
              <details key={index} style={{ marginBottom: "10px" }}>
                <summary>
                  Grupo {index + 1} - {group.count} puntos
                </summary>
                <table border={1} style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>X</th>
                      <th>Y</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.points.map((point, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{point.x.toFixed(2)}</td>
                        <td>{point.y.toFixed(2)}</td>
                        <td>{point.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraOpenCV;
