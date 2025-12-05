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

  // Resize image for faster upload
  const resizeImage = (file, maxWidth = 800) => {
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
        }, "image/jpeg", 0.9);
      };
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setPredictions([]);
      const resizedFile = await resizeImage(file);
      sendImageToApi(resizedFile);
    }
  };

  const capture = useCallback(async () => {
    const screenshot = webcamRef.current.getScreenshot();
    setImageSrc(screenshot);
    setIsCameraOpen(false);
    setPredictions([]);

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
      // REPLACE WITH YOUR HUGGING FACE URL
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

  // --- PROFESSIONAL DRAWING LOGIC ---
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;

    if (img && canvas && predictions.length > 0) {
      // 1. Set Canvas size to match High-Res Image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. Calculate Dynamic Sizes based on Image Width
      // This ensures text is readable on 4K images AND thumbnails
      const scaleFactor = Math.max(1, img.naturalWidth / 600); 
      const lineWidth = Math.max(3, 4 * scaleFactor);
      const fontSize = Math.max(16, 24 * scaleFactor);
      const padding = 6 * scaleFactor;

      predictions.forEach((pred) => {
        const [x1, y1, x2, y2] = pred.box;
        const width = x2 - x1;
        const height = y2 - y1;

        // A. Draw Semi-Transparent Fill (Glass effect)
        ctx.fillStyle = "rgba(0, 180, 255, 0.15)"; 
        ctx.fillRect(x1, y1, width, height);

        // B. Draw Border
        ctx.strokeStyle = "#00b4ff"; // Bright Blue
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x1, y1, width, height);

        // C. Prepare Text
        const text = `${pred.class_name.toUpperCase()} ${(pred.confidence * 100).toFixed(0)}%`;
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
        const textWidth = ctx.measureText(text).width;
        const textHeight = fontSize * 1.2;

        // D. Draw Label Background (Pill shape)
        ctx.fillStyle = "#00b4ff";
        // Check if label fits above, otherwise draw inside
        const labelY = y1 - textHeight > 0 ? y1 - textHeight : y1;
        
        ctx.fillRect(x1, labelY, textWidth + (padding * 2), textHeight);

        // E. Draw Text
        ctx.fillStyle = "#FFFFFF"; // White text
        ctx.textBaseline = "top";
        ctx.fillText(text, x1 + padding, labelY + (padding/2));
      });
    } else if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [predictions, imageSrc]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>📦 Logistics AI</h1>
        <p>Detect packages & cargo instantly</p>
      </header>

      <div className="controls">
        <button onClick={() => fileInputRef.current.click()} className="btn btn-secondary">
          📂 Gallery
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
          accept="image/*"
        />
        <button onClick={() => setIsCameraOpen(!isCameraOpen)} className="btn btn-primary">
          {isCameraOpen ? "❌ Close" : "📸 Camera"}
        </button>
      </div>

      {isCameraOpen && (
        <div className="camera-wrapper">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width="100%"
            videoConstraints={{ facingMode: "environment" }}
          />
          <button onClick={capture} className="btn btn-capture">Capture Photo</button>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Analyzing Cargo...</p>
        </div>
      )}

      {!isCameraOpen && imageSrc && (
        <div className="result-card">
          <div className="image-container">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Preview"
              className="preview-image"
              onLoad={() => {
                  // Trigger re-render to draw canvas
                  setPredictions([...predictions]);
              }}
            />
            <canvas ref={canvasRef} className="drawing-canvas" />
          </div>
          
          {/* Stats Section */}
          {!loading && predictions.length > 0 && (
            <div className="stats-panel">
               <h3>Detected Items ({predictions.length})</h3>
               <div className="tags-container">
                 {predictions.map((p, i) => (
                   <span key={i} className="tag">
                     {p.class_name} <small>{(p.confidence * 100).toFixed(0)}%</small>
                   </span>
                 ))}
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;