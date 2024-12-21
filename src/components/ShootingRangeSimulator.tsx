import { useRef, useEffect, useCallback, useState } from "react";
import cv from "@techstark/opencv-js";

/** Types **/
type LaserPoint = {
  x: number;
  y: number;
  timestamp: number; // Use timestamp as a number for performance
};

type GroupedShot = {
  points: LaserPoint[];
  center: { x: number; y: number };
};

const ShootingRangeSimulator = () => {
  /** References **/
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** States **/
  const [laserPoints, setLaserPoints] = useState<LaserPoint[]>([]);
  const [groupedShots, setGroupedShots] = useState<GroupedShot[]>([]);

  /** Variables **/
  const processingWidth = 640;
  const processingHeight = 360;
  const spatialThreshold = 10; // Max distance in pixels
  const temporalThreshold = 300; // Max time difference in milliseconds

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

  const groupLaserPoints = useCallback((points: LaserPoint[]): GroupedShot[] => {
    const groups: GroupedShot[] = [];

    points.forEach((point) => {
      let added = false;

      for (const group of groups) {
        const lastPoint = group.points[group.points.length - 1];
        const distance = Math.sqrt((point.x - group.center.x) ** 2 + (point.y - group.center.y) ** 2);
        const timeDiff = Math.abs(point.timestamp - lastPoint.timestamp);

        if (distance <= spatialThreshold && timeDiff <= temporalThreshold) {
          group.points.push(point);
          group.center.x = (group.center.x * (group.points.length - 1) + point.x) / group.points.length;
          group.center.y = (group.center.y * (group.points.length - 1) + point.y) / group.points.length;
          added = true;
          break;
        }
      }

      if (!added) {
        groups.push({ points: [point], center: { x: point.x, y: point.y } });
      }
    });

    return groups;
  }, [spatialThreshold, temporalThreshold]);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || video.readyState !== 4) return;

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
    const timestamp = Date.now(); // Use timestamp in milliseconds

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
      const grouped = groupLaserPoints(updatedPoints);
      setGroupedShots(grouped);
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
  }, [groupLaserPoints, processingWidth, processingHeight]);

  useEffect(() => {
    startCamera();
    const interval = setInterval(processFrame, 50);
    return () => clearInterval(interval);
  }, [startCamera, processFrame]);

  /** Render **/
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
      <div
        style={{
          width: "640px",
          height: "360px",
          backgroundColor: "black",
          position: "relative",
        }}
      >
        <video
          ref={videoRef}
          style={{ width: "0%", height: "0%", objectFit: "contain", position: "absolute" }}
        />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute" }}
        />
      </div>

      <h3>Disparos Agrupados:</h3>
      <div style={{ maxHeight: "360px", overflowY: "auto", width: "100%" }}>
        {groupedShots.map((group, index) => (
          <details key={index} style={{ marginBottom: "10px", cursor: "pointer" }}>
            <summary>Disparo #{index + 1} - {group.points.length} impactos detectados en X: {group.center.x.toFixed(2)} Y: {group.center.y.toFixed(2)}

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
                    <td>{new Date(point.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </div>
    </div>
  );
};

export default ShootingRangeSimulator;