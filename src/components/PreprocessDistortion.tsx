import { useRef, useEffect, useCallback, useState } from "react";
import cv from "@techstark/opencv-js";

/** Types **/
type LaserPoint = {
  x: number;
  y: number;
  timestamp: number;
};

type Resolution = {
  width: number;
  height: number;
};

type CalibrationData = {
  cameraId: string;
  resolution: Resolution;
  timestamp: string; // ISO format
  corners: LaserPoint[];
};

type PreprocessDistortionProps = {
  processingWidth: number;
  processingHeight: number;
};

const PreprocessDistortion: React.FC<PreprocessDistortionProps> = ({
  processingWidth,
  processingHeight,
}) => {
  /** References **/
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** States **/
  const [cornerPoints, setCornerPoints] = useState<LaserPoint[]>([]);
  const [homographyMatrix, setHomographyMatrix] = useState<cv.Mat | null>(null);

  /** Constants **/
  const cameraId = "CAM12345"; // Replace with your unique camera ID.

  /** Utility Functions **/
  const saveCalibrationData = (data: CalibrationData) => {
    localStorage.setItem("calibrationData", JSON.stringify(data));
  };

  const loadCalibrationData = (): CalibrationData | null => {
    const data = localStorage.getItem("calibrationData");
    return data ? JSON.parse(data) : null;
  };

  const isCalibrationValid = (
    storedData: CalibrationData | null,
    currentResolution: Resolution,
    currentCameraId: string
  ): boolean => {
    if (!storedData) return false;

    const { cameraId, resolution, timestamp } = storedData;

    if (cameraId !== currentCameraId) return false;
    if (resolution.width !== currentResolution.width || resolution.height !== currentResolution.height) return false;

    const calibrationDate = new Date(timestamp);
    const now = new Date();
    const diffInDays = (now.getTime() - calibrationDate.getTime()) / (1000 * 60 * 60 * 24);

    return diffInDays <= 30;
  };

  const computeHomography = useCallback(
    (points: LaserPoint[]) => {
      if (points.length !== 4) {
        alert("You need exactly 4 points to compute homography.");
        return;
      }

      const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, points.flatMap(({ x, y }) => [x, y]));
      const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        processingWidth, 0,
        processingWidth, processingHeight,
        0, processingHeight,
      ]);

      const hMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
      setHomographyMatrix(hMatrix);

      srcPoints.delete();
      dstPoints.delete();
    },
    [processingWidth, processingHeight]
  );

  const applyDistortion = useCallback(() => {
    if (!homographyMatrix || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) return;

    const src = cv.imread(canvas);
    const dst = new cv.Mat();

    cv.warpPerspective(src, dst, homographyMatrix, new cv.Size(processingWidth, processingHeight));

    cv.imshow(canvas, dst);

    src.delete();
    dst.delete();
  }, [homographyMatrix, processingWidth, processingHeight]);

  const addPoint = useCallback((point: LaserPoint) => {
    setCornerPoints((prev) => {
      if (prev.length >= 4) {
        alert("You already have 4 points. Remove one if you want to add another.");
        return prev;
      }
      return [...prev, point];
    });
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cornerPoints.length >= 4) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || videoRef.current?.readyState !== 4) return;

    if (canvas.width !== processingWidth || canvas.height !== processingHeight) {
      canvas.width = processingWidth;
      canvas.height = processingHeight;
    }

    ctx.drawImage(videoRef.current, 0, 0, processingWidth, processingHeight);

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

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      addPoint({ x: centerX, y: centerY, timestamp: Date.now() }); // Use addPoint here
      contour.delete();
    }

    src.delete();
    hsv.delete();
    mask.delete();
    lowerRed.delete();
    upperRed.delete();
    contours.delete();
    hierarchy.delete();
  }, [cornerPoints, addPoint, processingWidth, processingHeight]);

  useEffect(() => {
    const startCamera = async () => {
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
    };

    startCamera();

    const interval = setInterval(() => {
      if (homographyMatrix) {
        applyDistortion();
      } else {
        processFrame();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [applyDistortion, processFrame, homographyMatrix]);

  /** Render **/
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
      <div
        style={{
          width: `${processingWidth}px`,
          height: `${processingHeight}px`,
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
      <div>
        <p>{cornerPoints.length}/4 corners captured</p>
        <ul>
          {cornerPoints.map((point, index) => (
            <li key={index}>
              Corner {index + 1}: X={point.x.toFixed(2)}, Y={point.y.toFixed(2)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PreprocessDistortion;
