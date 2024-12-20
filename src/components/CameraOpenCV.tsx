import { useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import cv from "@techstark/opencv-js";

const CameraOpenCV = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processFrame = useCallback(() => {
    if (
      webcamRef.current &&
      webcamRef.current.video &&
      canvasRef.current
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true }); // <- Solución aquí

      if (ctx && video.readyState === 4) {
        // Obtener el fotograma actual del video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Procesar la imagen con OpenCV
        const src = cv.imread(canvas);
        const dst = new cv.Mat();
        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY); // Convertir a escala de grises

        // Mostrar el resultado en el canvas
        cv.imshow(canvas, dst);

        // Liberar memoria
        src.delete();
        dst.delete();
      }
    }
  }, []);

  useEffect(() => {
    // Procesar la cámara en tiempo real
    const interval = setInterval(processFrame, 30); // Procesar cada 30ms (~33 FPS)
    return () => clearInterval(interval);
  }, [processFrame]);

  return (
    <div>
      <h1>React + OpenCV.js con Cámara</h1>
      <div style={{ display: "flex", gap: "20px" }}>
        <div>
          <h3>Cámara en vivo</h3>
          <Webcam ref={webcamRef} mirrored={true} style={{ width: "640px", height: "480px" }} />
        </div>
        <div>
          <h3>Procesamiento con OpenCV</h3>
          <canvas ref={canvasRef} style={{ width: "640px", height: "480px" }} />
        </div>
      </div>
    </div>
  );
};

export default CameraOpenCV;
