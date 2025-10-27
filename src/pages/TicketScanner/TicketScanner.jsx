import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import Tesseract from "tesseract.js";
import {
  CheckCircle,
  XCircle,
  Scan,
  User,
  Calendar,
  Loader2,
  LogOut,
  Download,
  Square,
  Play,
  Volume2,
  VolumeX,
  Keyboard,
  MapPin,
  Clock,
  Mail,
  Shield,
  AlertCircle,
  Camera,
} from "lucide-react";
import { toast } from "react-toastify";
import serverURL from "../../ServerConfig";
import logo from "../../assets/logo.png";

const TicketScanner = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  
  // Get moderator data from localStorage
  const [moderatorData, setModeratorData] = useState(null);
  const [moderatorToken, setModeratorToken] = useState(null);
  
  // Scanner states
  const [data, setData] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [stats, setStats] = useState({
    totalScanned: 0,
    validTickets: 0,
    usedTickets: 0,
    invalidTickets: 0,
  });
  
  // Settings states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanMode, setScanMode] = useState("camera"); // 'camera', 'manual', 'ocr'
  const [manualCode, setManualCode] = useState("");
  
  // OCR states
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrStream, setOcrStream] = useState(null);
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [ocrStatus, setOcrStatus] = useState("Ready to scan");
  
  // Event info state
  const [eventInfo, setEventInfo] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("moderator-token");
    const data = localStorage.getItem("moderator-data");

    if (!token || !data) {
      toast.error("Please login as moderator first");
      navigate("/");
      return;
    }

    setModeratorToken(token);
    const parsedData = JSON.parse(data);
    setModeratorData(parsedData);

    if (parsedData?._id || parsedData?.id) {
      fetchTodayStats(parsedData._id || parsedData.id, token);
      fetchRecentScans(parsedData._id || parsedData.id, token);
    }
  }, [navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopOcrCamera();
    };
  }, []);

  // Auto-scan effect when OCR camera is active
  useEffect(() => {
    if (ocrScanning && videoRef.current && videoRef.current.readyState === 4) {
      scanIntervalRef.current = setInterval(() => {
        captureAndScan();
      }, 2000); // Scan every 2 seconds
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [ocrScanning]);

  const fetchTodayStats = async (moderatorId, token) => {
    try {
      const response = await fetch(`${serverURL.url}moderator/stats/${moderatorId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setStats({
            totalScanned: data.stats.totalScanned || 0,
            validTickets: data.stats.validTickets || 0,
            usedTickets: data.stats.usedTickets || 0,
            invalidTickets: data.stats.invalidTickets || 0,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error fetching stats:", error);
    }
  };

  const fetchRecentScans = async (moderatorId, token) => {
    try {
      const response = await fetch(`${serverURL.url}moderator/recent/${moderatorId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.recentScans && Array.isArray(data.recentScans)) {
          const formattedHistory = data.recentScans.map(scan => ({
            code: scan.ticketCode,
            result: {
              status: scan.status,
              message: scan.message || `Ticket ${scan.status}`,
              verificationResult: scan.verificationResult,
            },
            timestamp: new Date(scan.scanTime || scan.createdAt),
          }));
          setScanHistory(formattedHistory);
        }

        if (data.recentScans && data.recentScans.length > 0 && data.recentScans[0].verificationResult?.event) {
          setEventInfo(data.recentScans[0].verificationResult.event);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching recent scans:", error);
    }
  };

  // Start OCR Camera with continuous feed
  const startOcrCamera = async () => {
    try {
      stopOcrCamera(); // Stop any existing stream
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setOcrStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setOcrScanning(true);
          setOcrStatus("Camera active - Point at ticket");
          toast.success("Camera started - Hold ticket steady");
        };
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      toast.error("Failed to start camera. Please check permissions.");
      setOcrStatus("Camera failed to start");
    }
  };

  const stopOcrCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (ocrStream) {
      ocrStream.getTracks().forEach(track => track.stop());
      setOcrStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setOcrScanning(false);
    setOcrStatus("Camera stopped");
  };

  // Capture and scan automatically
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isLoading) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is ready
    if (video.readyState !== 4) {
      return;
    }

    const context = canvas.getContext("2d");
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        setOcrStatus("Scanning...");
        await processImageWithOCR(blob);
      }
    }, "image/jpeg", 0.8);
  };

  // Process image with OCR
  const processImageWithOCR = async (imageBlob) => {
    if (isLoading) return;

    try {
      const result = await Tesseract.recognize(
        imageBlob,
        "eng",
        {
          logger: () => {}, // Silent logging for continuous scanning
        }
      );

      const extractedText = result.data.text;
      const ticketCode = extractTicketCode(extractedText);
      
      if (ticketCode && ticketCode !== lastScannedCode) {
        console.log("✅ Detected ticket code:", ticketCode);
        setLastScannedCode(ticketCode);
        setData(ticketCode);
        setOcrStatus(`Found: ${ticketCode}`);
        
        // Automatically verify the ticket
        await processTicket(ticketCode);
        
        // Clear last scanned after 5 seconds to allow re-scanning
        setTimeout(() => {
          setLastScannedCode("");
          setOcrStatus("Ready for next ticket");
        }, 5000);
      } else {
        setOcrStatus("Looking for ticket code...");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setOcrStatus("Scanning...");
    }
  };

  // Extract ticket code from text
  const extractTicketCode = (text) => {
    if (!text) return null;
    
    // Remove all whitespace and convert to uppercase
    const cleanedText = text.replace(/\s+/g, "").toUpperCase();
    
    // Try multiple patterns to find ticket codes
    const patterns = [
      /\b[A-Z0-9]{8,}\b/g,           // 8+ alphanumeric characters
      /\b\d{6,}\b/g,                 // 6+ digits only
      /\b[A-Z]{2,}\d{4,}\b/g,        // Letters + Numbers
      /\b\d{4,}[A-Z]{2,}\b/g,        // Numbers + Letters
    ];
    
    for (const pattern of patterns) {
      const matches = cleanedText.match(pattern);
      if (matches && matches.length > 0) {
        // Return the longest match (most likely to be the ticket code)
        const longestMatch = matches.sort((a, b) => b.length - a.length)[0];
        return longestMatch;
      }
    }
    
    return null;
  };

  // Sound effects
  const playSound = (type) => {
    if (!soundEnabled) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === "success") {
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    } else {
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
    }

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const updateStats = (status) => {
    setStats((prev) => ({
      totalScanned: prev.totalScanned + 1,
      validTickets: prev.validTickets + (status === "valid" ? 1 : 0),
      usedTickets: prev.usedTickets + (status === "used" ? 1 : 0),
      invalidTickets: prev.invalidTickets + (status === "invalid" ? 1 : 0),
    }));
  };

  const handleScan = async (err, scannedData) => {
    if (scannedData && scanning && !isLoading && scanMode === "camera") {
      await processTicket(scannedData.text);
    }
  };

  const handleManualScan = async () => {
    if (manualCode.trim()) {
      await processTicket(manualCode.trim());
      setManualCode("");
    }
  };

  const processTicket = async (ticketCode) => {
    if (!ticketCode || isLoading) return;

    setIsLoading(true);
    setData(ticketCode);

    try {
      const response = await fetch(`${serverURL.url}moderator/verify-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${moderatorToken}`,
        },
        body: JSON.stringify({
          ticketCode: ticketCode,
          moderatorId: moderatorData._id || moderatorData.id,
        }),
      });

      const responseData = await response.json();
      console.log("Verification response:", responseData);

      if (response.ok) {
        playSound("success");
        setResult(responseData);
        updateStats(responseData.status);

        const newScan = {
          code: ticketCode,
          result: responseData,
          timestamp: new Date(),
        };
        setScanHistory((prev) => [newScan, ...prev]);

        if (responseData.verificationResult?.event) {
          setEventInfo(responseData.verificationResult.event);
        }

        toast.success(responseData.message);
      } else {
        playSound("error");
        setResult(responseData);
        updateStats(responseData.status || "invalid");

        const newScan = {
          code: ticketCode,
          result: responseData,
          timestamp: new Date(),
        };
        setScanHistory((prev) => [newScan, ...prev]);

        toast.error(responseData.message || "Ticket verification failed");
      }
    } catch (error) {
      console.error("Error verifying ticket:", error);
      playSound("error");
      toast.error("Network error. Please try again.");
      
      const errorResult = {
        status: "invalid",
        message: "Network error occurred",
      };
      setResult(errorResult);
      updateStats("invalid");
    } finally {
      setIsLoading(false);
      
      // Auto-clear result after 5 seconds for continuous scanning
      if (scanMode === "ocr" || scanMode === "camera") {
        setTimeout(() => {
          setResult(null);
          setData("");
        }, 5000);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("moderator-token");
    localStorage.removeItem("moderator-data");
    toast.success("Logged out successfully");
    navigate("/");
  };

  const downloadLogs = () => {
    const logs = scanHistory.map((scan) => ({
      code: scan.code,
      status: scan.result.status,
      message: scan.result.message,
      timestamp: scan.timestamp.toISOString(),
      buyer: scan.result.verificationResult?.buyer,
      event: scan.result.verificationResult?.event,
    }));

    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticket-scans-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Logs downloaded successfully");
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />;
      case "used":
        return <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-500 flex-shrink-0" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      valid: "bg-green-100 text-green-800 border-green-200",
      used: "bg-red-100 text-red-800 border-red-200",
      invalid: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold border ${badges[status] || badges.invalid}`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 w-10" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Ticket Scanner</h1>
                {moderatorData && (
                  <p className="text-xs text-gray-600">Moderator: {moderatorData.name}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py- text-gray-800">
        {/* Event Info Banner */}
        {eventInfo && (
          <div className="mb-6 bg-gradient-to-r from-orange-500 to-blue-500 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-6 w-6" />
              <h2 className="text-xl font-bold">{eventInfo.title}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {new Date(eventInfo.date).toLocaleDateString()} at {eventInfo.time}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{eventInfo.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Secure Verification</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scanner */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mode Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Scanning Mode</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setScanMode("camera");
                    setScanning(true);
                    stopOcrCamera();
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    scanMode === "camera"
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-orange-300"
                  }`}
                >
                  <Scan className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                  <p className="text-sm font-semibold text-gray-700">Barcode</p>
                </button>
                <button
                  onClick={() => {
                    setScanMode("ocr");
                    setScanning(false);
                    startOcrCamera();
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    scanMode === "ocr"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <Camera className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-semibold text-gray-700">OCR Scan</p>
                </button>
                <button
                  onClick={() => {
                    setScanMode("manual");
                    setScanning(false);
                    stopOcrCamera();
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    scanMode === "manual"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-green-300"
                  }`}
                >
                  <Keyboard className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-semibold text-gray-700">Manual</p>
                </button>
              </div>

              {/* Settings */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Sound Effects</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg transition-all ${
                    soundEnabled ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Scanner Interface */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="space-y-4">
                {/* Barcode Scanner Mode */}
                {scanMode === "camera" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-800">Barcode Scanner</h3>
                      <button
                        onClick={() => setScanning(!scanning)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                          scanning
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }`}
                      >
                        {scanning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {scanning ? "Stop" : "Start"}
                      </button>
                    </div>
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                      {scanning ? (
                        <BarcodeScannerComponent
                          width="100%"
                          height="100%"
                          onUpdate={handleScan}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center text-white">
                            <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold">Click Start to begin scanning</p>
                          </div>
                        </div>
                      )}
                      {isLoading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <Loader2 className="h-12 w-12 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OCR Scanner Mode - Continuous Camera */}
                {scanMode === "ocr" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-800">OCR Scanner</h3>
                      <button
                        onClick={ocrScanning ? stopOcrCamera : startOcrCamera}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                          ocrScanning
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                        }`}
                      >
                        {ocrScanning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {ocrScanning ? "Stop" : "Start"}
                      </button>
                    </div>

                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                      {/* Live Camera Feed */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Hidden canvas for capturing frames */}
                      <canvas ref={canvasRef} className="hidden" />

                      {/* Status Overlay */}
                      <div className="absolute top-4 left-4 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          {ocrScanning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                          <span className="text-sm font-semibold">{ocrStatus}</span>
                        </div>
                      </div>

                      {/* Processing Overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                          <div className="text-center text-white">
                            <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
                            <p className="text-sm">Verifying ticket...</p>
                          </div>
                        </div>
                      )}

                      {/* Default State */}
                      {!ocrScanning && !ocrStream && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center text-white">
                            <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold mb-2">Click Start to scan tickets</p>
                            <p className="text-sm opacity-75">Point camera at ticket code</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* OCR Instructions */}
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        OCR Scanning Tips:
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Point camera directly at ticket code</li>
                        <li>Hold steady for 2-3 seconds</li>
                        <li>Ensure good lighting</li>
                        <li>Keep code in center of frame</li>
                        <li>System scans automatically!</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Manual Entry Mode */}
                {scanMode === "manual" && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Manual Entry</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === "Enter" && handleManualScan()}
                        placeholder="Enter ticket code"
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-lg"
                        disabled={isLoading}
                      />
                      <button
                        onClick={handleManualScan}
                        disabled={!manualCode.trim() || isLoading}
                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Scan className="h-5 w-5" />
                        )}
                        Verify
                      </button>
                    </div>
                  </div>
                )}

                {/* Scanned Data Display */}
                {data && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Ticket Code:</p>
                    <p className="text-xl font-mono font-bold text-gray-900 break-all">
                      {data}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Result */}
            {result && (
              <div
                className={`rounded-2xl shadow-lg p-4 sm:p-6 transition-all duration-300 ${
                  result.status === "valid"
                    ? "bg-green-50 border-2 border-green-200"
                    : result.status === "used"
                      ? "bg-red-50 border-2 border-red-200"
                      : "bg-gray-50 border-2 border-gray-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Verification Result</h3>
                  </div>
                  {getStatusBadge(result.status)}
                </div>

                <p className="text-base sm:text-lg font-medium text-gray-900 mb-4">{result.message}</p>

                {result.verificationResult && (
                  <>
                    <div className="border-t border-gray-200 my-4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Buyer Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <User className="h-4 w-4 text-orange-500" />
                          Buyer Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-gray-600">Name</p>
                              <p className="font-medium text-gray-900">
                                {result.verificationResult.buyer?.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Mail className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-600">Email</p>
                              <p className="font-medium text-gray-900 break-all">
                                {result.verificationResult.buyer?.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Event Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-orange-500" />
                          Event Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-gray-600">Event</p>
                              <p className="font-medium text-gray-900">
                                {result.verificationResult.event?.title}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-gray-600">Date & Time</p>
                              <p className="font-medium text-gray-900">
                                {new Date(result.verificationResult.event?.date).toLocaleDateString()} at{" "}
                                {result.verificationResult.event?.time}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-600">Location</p>
                              <p className="font-medium text-gray-900 break-words">
                                {result.verificationResult.event?.location}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Scan Information */}
                    <div className="border-t border-gray-200 my-4"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Purchase Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(result.verificationResult.purchaseDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Scan Time</p>
                        <p className="font-medium text-gray-900">
                          {new Date(result.verificationResult.scanTime).toLocaleString()}
                        </p>
                      </div>
                      {result.verificationResult.scannedBy && (
                        <div>
                          <p className="text-gray-600">Scanned By</p>
                          <p className="font-medium text-gray-900">{result.verificationResult.scannedBy}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Stats & History */}
          <div className="space-y-4 sm:space-y-6">
            {/* Stats Card */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Today's Stats</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalScanned}</p>
                  <p className="text-xs text-blue-600 mt-1">Total Scanned</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.validTickets}</p>
                  <p className="text-xs text-green-600 mt-1">Valid Tickets</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl sm:text-3xl font-bold text-red-600">{stats.usedTickets}</p>
                  <p className="text-xs text-red-600 mt-1">Already Used</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-600">{stats.invalidTickets}</p>
                  <p className="text-xs text-gray-600 mt-1">Invalid</p>
                </div>
              </div>
              <button
                onClick={downloadLogs}
                className="w-full mt-4 py-2 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Download className="h-4 w-4" />
                Download Logs
              </button>
            </div>

            {/* Recent Scans */}
            {scanHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Recent Scans</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {scanHistory.slice(0, 10).map((scan, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStatusIcon(scan.result.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-gray-600 truncate">{scan.code}</p>
                          <p className="text-xs text-gray-500">{scan.timestamp.toLocaleTimeString()}</p>
                        </div>
                      </div>
                      {getStatusBadge(scan.result.status)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketScanner;