import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
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
  const [scanMode, setScanMode] = useState("ocr"); // 'camera', 'manual', 'ocr'
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


  // Auto-start OCR camera on mount
  useEffect(() => {
    if (scanMode === "ocr" && !ocrScanning) {
      // Small delay to ensure refs are ready
      const timer = setTimeout(() => {
        startOcrCamera();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);
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
      }, 8000); // Scan every 9 seconds
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
      stopOcrCamera();
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setOcrStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        
        videoRef.current.onloadedmetadata = () => {
          setOcrScanning(true);
          setOcrStatus("Camera active - Point at ticket code");
          toast.success("OCR Camera started - Focus on ticket code");
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

  // Capture and scan with OCR.space API
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isLoading) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState !== 4) {
      return;
    }

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        setOcrStatus("Scanning...");
        await processImageWithOCR(blob);
      }
    }, "image/jpeg", 0.9);
  };

  // Process image with OCR.space API (FREE!)
  const processImageWithOCR = async (imageBlob) => {
    if (isLoading) return;

    try {
      // Create FormData for OCR.space API
      const formData = new FormData();
      formData.append("base64Image", await blobToBase64(imageBlob));
      formData.append("apikey", "K87899142388957"); // FREE API KEY
      formData.append("language", "eng");
      formData.append("isOverlayRequired", "false");
      formData.append("detectOrientation", "true");
      formData.append("scale", "true");
      formData.append("OCREngine", "2"); // Engine 2 is better

      // Call OCR.space API
      const response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      });

      const ocrResult = await response.json();
      
      console.log("🔍 OCR Result:", ocrResult);

      if (ocrResult.IsErroredOnProcessing) {
        setOcrStatus("Error scanning - try again");
        return;
      }

      if (ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0) {
        const extractedText = ocrResult.ParsedResults[0].ParsedText;
        console.log("📝 Extracted text:", extractedText);
        
        const ticketCode = extractTicketCode(extractedText);
        
        if (ticketCode && ticketCode !== lastScannedCode) {
          console.log("✅ Detected ticket code:", ticketCode);
          setLastScannedCode(ticketCode);
          setData(ticketCode);
          setOcrStatus(`Found: ${ticketCode}`);
          
          // Automatically verify the ticket
          await processTicket(ticketCode);
          
          // Clear last scanned after 5 seconds
          setTimeout(() => {
            setLastScannedCode("");
            setOcrStatus("Ready for next ticket");
          }, 3000);
        } else {
          setOcrStatus("Looking for ticket code...");
        }
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setOcrStatus("Scanning...");
    }
  };

  // Convert blob to base64 for OCR.space API
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data URL prefix to get just base64 string
        const base64 = reader.result.split(',')[1];
        resolve("data:image/jpeg;base64," + base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Extract ticket code from OCR text
  const extractTicketCode = (text) => {
    if (!text) return null;
    
    // Clean text - remove whitespace and special chars
    const cleanedText = text.replace(/[\s\r\n]+/g, "").toUpperCase();
    
    console.log("🧹 Cleaned text:", cleanedText);
    
    // CUSTOMIZE THESE PATTERNS FOR YOUR TICKET FORMAT
    const patterns = [
      /\b[A-Z0-9]{10,}\b/g,          // 10+ alphanumeric (most ticket codes)
      /\b[A-Z0-9]{8,}\b/g,           // 8+ alphanumeric
      /\b\d{8,}\b/g,                 // 8+ digits only
      /\b[A-Z]{2,}\d{6,}\b/g,        // Letters + 6+ numbers
      /\b\d{6,}[A-Z]{2,}\b/g,        // 6+ numbers + letters
    ];
    
    for (const pattern of patterns) {
      const matches = cleanedText.match(pattern);
      if (matches && matches.length > 0) {
        // Filter out common garbage patterns
        const validMatches = matches.filter(match => {
          // Must have at least some numbers
          const hasNumbers = /\d/.test(match);
          // Should not be all same character
          const notAllSame = !/^(.)\1+$/.test(match);
          // Minimum length 6
          const longEnough = match.length >= 6;
          
          return hasNumbers && notAllSame && longEnough;
        });
        
        if (validMatches.length > 0) {
          // Return longest valid match
          return validMatches.sort((a, b) => b.length - a.length)[0];
        }
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

  const processTicket = async (code) => {
    if (!code || isLoading) return;

    setData(code);
    setScanning(false);
    setIsLoading(true);

    try {
      console.log("🔍 Scanning ticket:", code);

      const response = await fetch(`${serverURL.url}moderator/scan-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${moderatorToken}`,
        },
        body: JSON.stringify({
          ticketCode: code,
          moderatorId: moderatorData?._id || moderatorData?.id,
        }),
      });

      const responseText = await response.text();
      console.log("📥 API Response:", responseText);

      let ticketResult;
      try {
        ticketResult = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error("Invalid response from server");
      }

      if (ticketResult.verificationResult?.event && !eventInfo) {
        setEventInfo(ticketResult.verificationResult.event);
      }

      const formattedResult = {
        status: ticketResult.status,
        message: ticketResult.message,
        scanTime: new Date().toLocaleString(),
        verificationResult: ticketResult.verificationResult,
      };

      setResult(formattedResult);
      updateStats(ticketResult.status);

      if (ticketResult.status === "valid") {
        playSound("success");
        toast.success("✅ Valid Ticket!");
      } else {
        playSound("error");
        if (ticketResult.status === "used") {
          toast.warning("⚠️ Ticket Already Used");
        } else {
          toast.error("❌ Invalid Ticket");
        }
      }

      setScanHistory((prev) => [
        {
          code,
          result: formattedResult,
          timestamp: new Date(),
        },
        ...prev.slice(0, 19),
      ]);
    } catch (error) {
      console.error("❌ Error verifying ticket:", error);
      const errorResult = {
        status: "invalid",
        message: error.message || "Server Error",
        scanTime: new Date().toLocaleString(),
      };
      setResult(errorResult);
      updateStats("invalid");
      playSound("error");
      toast.error("Error scanning ticket");
    } finally {
      setIsLoading(false);

      setTimeout(() => {
        if (scanMode === "camera") {
          setScanning(true);
          setResult(null);
          setData("");
        }
      }, 3000);
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
    <div className="min-h-screen text-gray-800 bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-50 ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 w-10" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Ticket Scanner</h1>
                {moderatorData && (
                  <p className="text-xs text-gray-600 flex items-center"><Shield className="w-4 h-4"></Shield>  {moderatorData.name}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 items-center">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg transition-all ${
                    soundEnabled ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
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
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              {/* <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>OCR.space Powered</span>
              </div> */}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scanner */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mode Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Scanning Mode</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* <button
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
                </button> */}
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
                  <Scan className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-semibold text-gray-700">Barcode</p>
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
                            <p className="text-lg font-semibold">Click Start to begin</p>
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

                {/* OCR Scanner Mode */}
                {scanMode === "ocr" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-800">BARCODE SCANNER</h3>
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
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />

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

                      {isLoading && (
                        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                          <div className="text-center text-white">
                            <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
                            <p className="text-sm">Verifying ticket...</p>
                          </div>
                        </div>
                      )}

                      {!ocrScanning && !ocrStream && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center text-white">
                            <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold mb-2">Click Start</p>
                            {/* <p className="text-sm opacity-75">OCR.space API (FREE!)</p> */}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Scanner Tips:
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Point directly at ticket code</li>
                        <li>Hold steady for 10 seconds</li>
                        <li>Good lighting required</li>
                        <li>Auto-scans every 10 seconds</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Manual Entry Mode */}
                {scanMode === "manual" && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase">Manual Entry</h3>
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