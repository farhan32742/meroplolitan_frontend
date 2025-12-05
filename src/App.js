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

  // 1. Resize Image Logic
  // CHANGED: maxWidth is now 640 to match YOLOv8 native size for best speed/accuracy
  const resizeImage = (file, maxWidth = 640) => {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const url = URL.createObjectURL(file); // Create URL from file
      img.src = url;
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const scale = maxWidth / img.width;
        
        // Set new dimensions
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        
        // Draw resized image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert back to file
        canvas.toBlob((blob) => {
          const resizedFile = new File([blob], file.name, { type: "image/jpeg" });
          resolve(resizedFile);
        }, "image/jpeg", 0.9);
      };
    });
  };

  // 2. Handle Gallery Upload
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      setPredictions([]); // Clear old boxes

      // A. Resize FIRST
      const resizedFile = await resizeImage(file);
      
      // B. Display the RESIZED image (Fixes the coordinate mismatch)
      const resizedUrl = URL.createObjectURL(resizedFile);
      setImageSrc(resizedUrl);
      
      // C. Send the RESIZED image
      sendImageToApi(resizedFile);
    }
  };

  // 3. Handle Camera Capture
  const capture = useCallback(async () => {
    const screenshot = webcamRef.current.getScreenshot();
    setIsCameraOpen(false);
    setLoading(true);
    setPredictions([]);

    // Convert base64 screenshot to File
    const res = await fetch(screenshot);
    const blob = await res.blob();
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    
    // A. Resize FIRST
    const resizedFile = await resizeImage(file);

    // B. Display the RESIZED image
    const resizedUrl = URL.createObjectURL(resizedFile);
    setImageSrc(resizedUrl);

    // C. Send the RESIZED image
    sendImageToApi(resizedFile);
  }, [webcamRef]);

  // 4. Send to Backend
  const sendImageToApi = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Make sure this URL is correct for your Space
      const response = await axios.post(
        "https://farikhan-metropolitan-logistics.hf.space/predict",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setPredictions(response.data.detections);
    } catch (error) {
      console.error(error);
      alert("Error connecting to server. Is the Hugging Face space running?");
    } finally {
      setLoading(false);
    }
  };

  // 5. Draw Boxes on Canvas
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;

    if (img && canvas && predictions.length > 0) {
      // Match canvas size to image size
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dynamic scaling for text/lines based on image width
      const scaleFactor = Math.max(1, img.naturalWidth / 600); 
      const lineWidth = Math.max(3, 4 * scaleFactor);
      const fontSize = Math.max(14, 20 * scaleFactor);
      const padding = 6 * scaleFactor;

      predictions.forEach((pred) => {
        const [x1, y1, x2, y2] = pred.box;
        const width = x2 - x1;
        const height = y2 - y1;

        // Draw Box Fill
        ctx.fillStyle = "rgba(0, 180, 255, 0.2)"; 
        ctx.fillRect(x1, y1, width, height);

        // Draw Box Border
        ctx.strokeStyle = "#00b4ff"; 
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x1, y1, width, height);

        // Prepare Text
        const text = `${pred.class_name.toUpperCase()} ${(pred.confidence * 100).toFixed(0)}%`;
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
        const textWidth = ctx.measureText(text).width;
        const textHeight = fontSize * 1.2;

        // Draw Label Background
        const labelY = y1 - textHeight > 0 ? y1 - textHeight : y1;
        ctx.fillStyle = "#00b4ff";
        ctx.fillRect(x1, labelY, textWidth + (padding * 2), textHeight);

        // Draw Label Text
        ctx.fillStyle = "#FFFFFF"; 
        ctx.textBaseline = "top";
        ctx.fillText(text, x1 + padding, labelY + (padding/2));
      });
    } else if (canvas) {
        // Clear canvas if no predictions
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
              // Crucial: Wait for image to load before drawing
              onLoad={() => setPredictions([...predictions])}
            />
            <canvas ref={canvasRef} className="drawing-canvas" />
          </div>
          
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