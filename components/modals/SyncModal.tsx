import React, { useState, useRef } from "react";
import { useChoresApp } from "../ChoresAppContext";
import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';
import pako from 'pako';

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SyncModal({ open, onClose }: SyncModalProps) {
  const { state, dispatch } = useChoresApp();
  const [qrCode, setQrCode] = useState("");
  const [importData, setImportData] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  React.useEffect(() => {
    if (showScanner && videoRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          setImportData(result.data);
          setShowScanner(false);
          if (scannerRef.current) {
            scannerRef.current.stop();
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      scannerRef.current.start();
    } else if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current = null;
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
    };
  }, [showScanner]);

  if (!open) return null;

  const generateQRCode = async () => {
    try {
      // Complete app state export
      const exportData = {
        children: state.children,
        chores: state.chores,
        choreTemplates: state.choreTemplates,
        parentSettings: {
          pin: state.parentSettings.pin,
          approvals: state.parentSettings.approvals
        },
        completedTasks: state.completedTasks,
        oneOffTasks: state.oneOffTasks
      };
      
      const jsonString = JSON.stringify(exportData);
      
      // Compress the data
      const compressed = pako.deflate(jsonString);
      // Convert `compressed` Uint8Array<ArrayBuffer> to string
      const compressedString = String.fromCharCode(...compressed);
      const encodedData = btoa(compressedString);
      
      try {
        // Try QR code with compressed data
        const qrCodeDataURL = await QRCode.toDataURL(encodedData, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'L'
        });
        setQrCode(qrCodeDataURL);
      } catch {
        // Fallback to text if still too large
        console.warn('Compressed data still too large for QR code, showing text instead');
        setQrCode(`TEXT:${encodedData}`);
      }
    } catch (error) {
      console.error('QR Code generation error:', error);
      setError('Failed to generate configuration data.');
    }
  };

  const importConfiguration = () => {
    if (!importData.trim()) {
      setError("Please paste configuration data");
      return;
    }

    try {
      let parsedData;
      try {
        // Try compressed data first
        const compressed = atob(importData);
        // Convert string back to Uint8Array
        const compressedArray = new Uint8Array(compressed.length);
        for (let i = 0; i < compressed.length; i++) {
          compressedArray[i] = compressed.charCodeAt(i);
        }
        const decompressed = pako.inflate(compressedArray);
        // Convert Uint8Array back to string
        const decompressedString = String.fromCharCode(...decompressed);
        parsedData = JSON.parse(decompressedString);
      } catch {
        try {
          // Try legacy base64 decode
          const decodedString = decodeURIComponent(atob(importData));
          parsedData = JSON.parse(decodedString);
        } catch {
          // Try direct JSON parse
          parsedData = JSON.parse(importData);
        }
      }

      if (!parsedData.children) {
        throw new Error("Invalid configuration format");
      }

      // Import complete state
      const newState = {
        children: parsedData.children || [],
        chores: parsedData.chores || [],
        choreTemplates: parsedData.choreTemplates || [],
        parentSettings: parsedData.parentSettings || state.parentSettings,
        completedTasks: parsedData.completedTasks || {},
        oneOffTasks: parsedData.oneOffTasks || {}
      };

      dispatch({
        type: "SET_STATE",
        payload: newState
      });

      setImportData("");
      setError("");
      alert("Configuration imported successfully!");
      onClose();
    } catch (error) {
      console.error('Import error:', error);
      setError('Error importing configuration. Please check the data format.');
    }
  };



  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>📱 Sync Data</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          {error && (
            <div className="error-message" style={{ marginBottom: '20px' }}>
              {error}
              <button 
                style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setError('')}
              >
                ×
              </button>
            </div>
          )}
          <div className="sync-section">
            <h3>Share Configuration</h3>
            <p>Generate configuration data to share with other devices:</p>
            <button className="btn btn-primary" onClick={generateQRCode}>
              Generate Config Data
            </button>
            {qrCode && (
              <div className="qr-container">
                {qrCode.startsWith('TEXT:') ? (
                  <div>
                    <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "10px" }}>
                      Configuration data (too large for QR code):
                    </p>
                    <textarea
                      readOnly
                      value={qrCode.substring(5)}
                      style={{ width: "100%", height: "100px", fontFamily: "monospace", fontSize: "12px" }}
                    />
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => navigator.clipboard.writeText(qrCode.substring(5))}
                      style={{ marginTop: "10px" }}
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={qrCode} 
                      alt="QR Code for configuration data"
                      style={{ maxWidth: "100%", height: "auto", border: "1px solid #e2e8f0" }}
                    />
                    <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "10px" }}>
                      Scan this QR code with another device to import the configuration
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="sync-section">
            <h3>Import Configuration</h3>
            <div className="import-options">
              <button className="btn btn-primary" onClick={() => setShowScanner(!showScanner)}>
                {showScanner ? "Stop" : "📷 Scan QR Code"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowImport(!showImport)}>
                {showImport ? "Hide" : "✏️ Manual Entry"}
              </button>
            </div>
            
            {showScanner && (
              <div className="qr-scanner" style={{ marginTop: "15px" }}>
                <video 
                  ref={videoRef}
                  style={{ width: "100%", maxWidth: "400px", height: "auto" }}
                />
                <p style={{ textAlign: "center", marginTop: "10px" }}>Position QR code within the camera view</p>
              </div>
            )}
            
            {showImport && (
              <div style={{ marginTop: "15px" }}>
                <p>Paste configuration data from another device:</p>
                <textarea
                  placeholder="Paste configuration data here..."
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  style={{ width: "100%", height: "120px", fontFamily: "monospace" }}
                />
                <button className="btn btn-primary" onClick={importConfiguration}>
                  Import Data
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
