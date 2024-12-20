import './App.css'
import cv from "@techstark/opencv-js"
import { useEffect } from 'react'
import CameraOpenCV from './components/CameraOpenCV'

function App() {

  useEffect(() => {
    if (cv) {
      console.log("OpenCV.js está cargado correctamente.");
    } else {
      console.error("Error al cargar OpenCV.js");
    }
  }, []);

  return (
    <>
      <div>
      <h1>React con OpenCV.js</h1>
      <CameraOpenCV />
    </div>
    </>
  )
}

export default App
