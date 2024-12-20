import React, { useEffect, useRef, useState } from "react";
import cv from "@techstark/opencv-js";

let faceCascade: cv.CascadeClassifier | null = null;

/**
 * Función para cargar el modelo Haar-cascade para la detección de rostros.
 */
export async function loadHaarFaceModels(): Promise<void> {
  console.log("======= Iniciando descarga de modelos Haar-cascade =======");
  const modelUrl = "models/haarcascade_frontalface_default.xml";

  return fetch(modelUrl)
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      const data = new Uint8Array(buffer);
      cv.FS_createDataFile("/", "haarcascade_frontalface_default.xml", data, true, false, false);
    })
    .then(() => {
      faceCascade = new cv.CascadeClassifier();
      faceCascade.load("haarcascade_frontalface_default.xml");
      console.log("======= Modelos Haar-cascade descargados =======");
    })
    .catch((error) => {
      console.error("Error al cargar el modelo Haar-cascade:", error);
    });
}

/**
 * Componente principal: Muestra el video de la cámara y detecta rostros.
 */
const HaarCascadeFaceDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opencvReady, setOpenCVReady] = useState(false);

  useEffect(() => {
    // Esperar a que OpenCV esté listo
    cv.onRuntimeInitialized = async () => {
      console.log("OpenCV está listo");
      await loadHaarFaceModels(); // Cargar el modelo Haar-cascade
      setOpenCVReady(true);
    };
  }, []);

  useEffect(() => {
    if (!opencvReady || !faceCascade) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            detectFaces();
          };
        }
      } catch (error) {
        console.error("Error al acceder a la cámara:", error);
      }
    };

    const detectFaces = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const cap = new cv.VideoCapture(video);
        const src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
        const gray = new cv.Mat();
        const faces = new cv.RectVector();

        const processFrame = () => {
          cap.read(src);
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

          // Detección de rostros
          faceCascade!.detectMultiScale(gray, faces, 1.1, 3, 0);

          // Dibujar rectángulos alrededor de los rostros detectados
          for (let i = 0; i < faces.size(); i++) {
            const face = faces.get(i);
            const point1 = new cv.Point(face.x, face.y);
            const point2 = new cv.Point(face.x + face.width, face.y + face.height);
            cv.rectangle(src, point1, point2, [255, 0, 0, 255]);
          }

          cv.imshow(canvas, src);
          requestAnimationFrame(processFrame);
        };

        processFrame();

        // Limpiar recursos al desmontar el componente
        return () => {
          src.delete();
          gray.delete();
          faces.delete();
        };
      }
    };

    startCamera();
  }, [opencvReady]);

  return (
    <div>
      {!opencvReady && <p>Cargando OpenCV y modelos Haar-cascade...</p>}
      <video ref={videoRef} autoPlay playsInline style={{ display: "none" }}></video>
      <canvas ref={canvasRef} style={{ border: "1px solid black" }}></canvas>
    </div>
  );
};

export default HaarCascadeFaceDetection;
