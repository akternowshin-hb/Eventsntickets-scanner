import React, { useState, useEffect } from "react";
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
  
  // Get moderator data from localStorage
  const [moderatorData, setModeratorData] = useState(null);
  const [moderatorToken, setModeratorToken] = useState(null);
  
  // Scanner states
  const [data, setData] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false); // Changed default to false
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
  const [scanMode, setScanMode] = useState("camera"); // 'camera' or 'manual'
  const [manualCode, setManualCode] = useState("");
  
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

    // Fetch stats and recent scans
    if (parsedData?._id || parsedData?.id) {
      fetchTodayStats(parsedData._id || parsedData.id, token);
      fetchRecentScans(parsedData._id || parsedData.id, token);
    }
  }, [navigate]);

  // Fetch today's stats from API
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
        console.log("📊 Stats from API:", data);
        
        // Update stats from API response
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

  // Fetch recent scans from API
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
        console.log("📜 Recent scans from API:", data);
        
        // Update scan history from API response
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

        // Set event info if available
        if (data.recentScans && data.recentScans.length > 0 && data.recentScans[0].verificationResult?.event) {
          setEventInfo(data.recentScans[0].verificationResult.event);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching recent scans:", error);
    }
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

      // Store event info from first successful scan
      if (ticketResult.verificationResult?.event && !eventInfo) {
        setEventInfo(ticketResult.verificationResult.event);
      }

      // Format the result
      const formattedResult = {
        status: ticketResult.status,
        message: ticketResult.message,
        scanTime: new Date().toLocaleString(),
        verificationResult: ticketResult.verificationResult,
      };

      setResult(formattedResult);
      updateStats(ticketResult.status);

      // Play sound feedback
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

      // Add to scan history
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
    }

    setIsLoading(false);

    // Auto-resume scanning after 3 seconds for camera mode
    setTimeout(() => {
      if (scanMode === "camera") {
        setScanning(true);
        setResult(null);
        setData("");
      }
    }, 3000);
  };

  const downloadLogs = () => {
    // Create a better formatted CSV with proper structure
    let csvContent = '';
    
    // Add Summary Section
    csvContent += 'SCAN SUMMARY REPORT\n';
    csvContent += '\n';
    csvContent += `Report Generated:,${new Date().toLocaleString()}\n`;
    csvContent += `Moderator:,${moderatorData?.name || 'Unknown'}\n`;
    csvContent += `Event:,${eventInfo?.title || 'N/A'}\n`;
    csvContent += '\n';
    
    // Add Statistics
    csvContent += 'STATISTICS\n';
    csvContent += `Total Scanned:,${stats.totalScanned}\n`;
    csvContent += `Valid Tickets:,${stats.validTickets}\n`;
    csvContent += `Already Used:,${stats.usedTickets}\n`;
    csvContent += `Invalid Tickets:,${stats.invalidTickets}\n`;
    csvContent += '\n';
    
    // Add Detailed Scan History Header
    csvContent += 'DETAILED SCAN HISTORY\n';
    csvContent += 'Ticket Code,Status,Buyer Name,Buyer Email,Event Title,Event Date,Event Time,Event Location,Purchase Date,Scan Time,Scanned By\n';
    
    // Add scan history data
    scanHistory.forEach(scan => {
      const verification = scan.result.verificationResult;
      
      // Helper function to clean CSV values
      const cleanValue = (value) => {
        if (!value) return 'N/A';
        const str = String(value);
        // Wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const row = [
        cleanValue(scan.code),
        cleanValue(scan.result.status.toUpperCase()),
        cleanValue(verification?.buyer?.name),
        cleanValue(verification?.buyer?.email),
        cleanValue(verification?.event?.title),
        verification?.event?.date ? cleanValue(new Date(verification.event.date).toLocaleDateString()) : 'N/A',
        cleanValue(verification?.event?.time),
        cleanValue(verification?.event?.location),
        verification?.purchaseDate ? cleanValue(new Date(verification.purchaseDate).toLocaleDateString()) : 'N/A',
        verification?.scanTime ? cleanValue(new Date(verification.scanTime).toLocaleString()) : cleanValue(scan.timestamp.toLocaleString()),
        cleanValue(verification?.scannedBy || moderatorData?.name)
      ];
      
      csvContent += row.join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Scan_Logs_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('CSV file downloaded successfully');
  };

  const handleLogout = () => {
    localStorage.removeItem("moderator-token");
    localStorage.removeItem("moderator-data");
    toast.info("Logged out successfully");
    navigate("/");
  };

  const getStatusIcon = (status) => {
    if (status === "valid") {
      return <CheckCircle className="h-6 w-6 text-green-600" />;
    } else if (status === "used") {
      return <AlertCircle className="h-6 w-6 text-red-600" />;
    }
    return <XCircle className="h-6 w-6 text-gray-600" />;
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-semibold";
    if (status === "valid") {
      return <span className={`${baseClasses} bg-green-100 text-green-700`}>VALID</span>;
    } else if (status === "used") {
      return <span className={`${baseClasses} bg-red-100 text-red-700`}>USED</span>;
    }
    return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>INVALID</span>;
  };

  const toggleScanMode = (mode) => {
    setScanMode(mode);
    setScanning(mode === "camera");
    setResult(null);
    setData("");
    setManualCode("");
  };

  if (!moderatorData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 text-gray-800">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between py-4 gap-4">
            {/* Logo and Moderator Info */}
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Ticket Scanner</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">{moderatorData.name}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 sm:p-3 rounded-lg transition-all ${
                  soundEnabled
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                }`}
                title={soundEnabled ? "Mute Sound" : "Enable Sound"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 sm:px-6 sm:py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2 text-sm sm:text-base"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Event Title Banner - Now visible after first scan */}
          {eventInfo && (
            <div className="py-3 sm:py-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <div className="text-center sm:text-left">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">{eventInfo.title}</h2>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {new Date(eventInfo.date).toLocaleDateString()} at {eventInfo.time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 text-center sm:text-right">
                  <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span className="line-clamp-1">{eventInfo.location}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Scanner */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Scan Mode Toggle */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Scanning Mode</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => toggleScanMode("camera")}
                  className={`p-4 sm:p-6 rounded-xl border-2 transition-all ${
                    scanMode === "camera"
                      ? "border-orange-500 bg-orange-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <Camera className={`h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 ${
                    scanMode === "camera" ? "text-orange-500" : "text-gray-400"
                  }`} />
                  <p className={`font-semibold text-sm sm:text-base ${
                    scanMode === "camera" ? "text-orange-700" : "text-gray-600"
                  }`}>
                    Camera Scan
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Scan QR codes with camera</p>
                </button>
                <button
                  onClick={() => toggleScanMode("manual")}
                  className={`p-4 sm:p-6 rounded-xl border-2 transition-all ${
                    scanMode === "manual"
                      ? "border-orange-500 bg-orange-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <Keyboard className={`h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 ${
                    scanMode === "manual" ? "text-orange-500" : "text-gray-400"
                  }`} />
                  <p className={`font-semibold text-sm sm:text-base ${
                    scanMode === "manual" ? "text-orange-700" : "text-gray-600"
                  }`}>
                    Manual Entry
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Type ticket code manually</p>
                </button>
              </div>
            </div>

            {/* Scanner Area */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="space-y-4">
                {/* Camera Mode */}
                {scanMode === "camera" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-800">Camera Scanner</h3>
                      <button
                        onClick={() => setScanning(!scanning)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm ${
                          scanning
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-green-500 hover:bg-green-600 text-white"
                        }`}
                      >
                        {scanning ? (
                          <>
                            <Square className="h-4 w-4" />
                            <span className="hidden sm:inline">Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            <span className="hidden sm:inline">Start</span>
                          </>
                        )}
                      </button>
                    </div>

                    {scanning && !isLoading ? (
                      <div className="relative">
                        <BarcodeScannerComponent
                          width="100%"
                          height={300}
                          onUpdate={handleScan}
                          stopStream={!scanning}
                        />
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-4 left-4 w-8 h-8 sm:w-12 sm:h-12 border-l-4 border-t-4 border-orange-500"></div>
                          <div className="absolute top-4 right-4 w-8 h-8 sm:w-12 sm:h-12 border-r-4 border-t-4 border-orange-500"></div>
                          <div className="absolute bottom-4 left-4 w-8 h-8 sm:w-12 sm:h-12 border-l-4 border-b-4 border-orange-500"></div>
                          <div className="absolute bottom-4 right-4 w-8 h-8 sm:w-12 sm:h-12 border-r-4 border-b-4 border-orange-500"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[300px] bg-gray-100 rounded-xl flex items-center justify-center">
                        {isLoading ? (
                          <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
                        ) : (
                          <div className="text-center p-4">
                            <Scan className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600 font-medium">Camera Stopped</p>
                            <p className="text-sm text-gray-500 mt-1">Click Start to begin scanning</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Mode */}
                {scanMode === "manual" && (
                  <div className="space-y-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Manual Entry</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleManualScan()}
                        placeholder="Enter ticket code..."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base font-mono"
                        disabled={isLoading}
                      />
                      <button
                        onClick={handleManualScan}
                        disabled={!manualCode.trim() || isLoading}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Scan className="h-5 w-5" />
                            Verify Ticket
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {data && (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-600">Last Scanned Code:</p>
                    <p className="font-mono text-xs sm:text-sm bg-orange-50 border border-orange-200 p-3 rounded-lg break-all">
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