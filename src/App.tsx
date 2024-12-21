import './App.css'
import cv from "@techstark/opencv-js"
import { useEffect } from 'react'
import CornerSelector from './components/CornerSelector'

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
      <CornerSelector />
    </>
  )
}

export default App
