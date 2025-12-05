import React, { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import "./App.css";

function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // 1. Resize logic to upload faster
  const resizeImage = (file, maxWidth = 640) => {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          const resizedFile = new File([blob], file.name, { type: "image/jpeg" });
          resolve(resizedFile);
        }, "image/jpeg", 0.8);
      };
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setPredictions([]); // Clear old boxes
      const resizedFile = await resizeImage(file);
      sendImageToApi(resizedFile);
    }
  };

  const capture = useCallback(async () => {
    const screenshot = webcamRef.current.getScreenshot();
    setImageSrc(screenshot);
    setIsCameraOpen(false);
    setPredictions([]); // Clear old boxes

    const res = await fetch(screenshot);
    const blob = await res.blob();
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    const resizedFile = await resizeImage(file);
    sendImageToApi(resizedFile);
  }, [webcamRef]);

  const sendImageToApi = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // NOTE: Replace with your actual Space URL
      const response = await axios.post(
        "https://farikhan-metropolitan-logistics.hf.space/predict",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setPredictions(response.data.detections);
    } catch (error) {
      console.error(error);
      alert("Error processing image");
    } finally {
      setLoading(false);
    }
  };

  // 2. The Drawing Logic
  // This runs automatically whenever 'predictions' or 'imageSrc' changes
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;

    if (img && canvas && predictions.length > 0) {
      // Logic: Match canvas size to the REAL image size
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw boxes
      predictions.forEach((pred) => {
        const [x1, y1, x2, y2] = pred.box;
        const width = x2 - x1;
        const height = y2 - y1;

        // Draw Box
        ctx.strokeStyle = "#00FF00"; // Green box
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, width, height);

        // Draw Background for Text
        ctx.fillStyle = "#00FF00";
        const text = `${pred.class_name} ${(pred.confidence * 100).toFixed(0)}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);

        // Draw Text
        ctx.fillStyle = "#000000";
        ctx.font = "bold 18px Arial";
        ctx.fillText(text, x1 + 5, y1 - 7);
      });
    } else if (canvas) {
        // Clear canvas if no predictions
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [predictions, imageSrc]);

  return (
    <div className="container">
      <h1>📦 Logistics Object Detection</h1>

      <div className="controls">
        <button onClick={() => fileInputRef.current.click()} className="btn secondary">
          📂 Upload
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
          accept="image/*"
        />
        <button onClick={() => setIsCameraOpen(!isCameraOpen)} className="btn primary">
          {isCameraOpen ? "❌ Close" : "📸 Camera"}
        </button>
      </div>

      {isCameraOpen && (
        <div className="camera-container">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width="100%"
            videoConstraints={{ facingMode: "environment" }}
          />
          <button onClick={capture} className="btn capture-btn">Capture</button>
        </div>
      )}

      {loading && <p className="loading">⏳ Processing...</p>}

      {!isCameraOpen && imageSrc && (
        <div className="result-container">
          {/* Wrapper is RELATIVE so we can stack Absolute Canvas on top */}
          <div className="image-wrapper" style={{ position: "relative" }}>
            
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Preview"
              className="preview-image"
              // Crucial: Wait for image to load before drawing
              onLoad={() => {
                  if(canvasRef.current) {
                      canvasRef.current.width = imgRef.current.naturalWidth;
                      canvasRef.current.height = imgRef.current.naturalHeight;
                  }
              }}
            />
            
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;