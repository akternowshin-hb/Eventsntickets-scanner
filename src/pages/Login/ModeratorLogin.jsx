import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Shield,
} from "lucide-react";
import { toast } from "react-toastify";
import serverURL from "../../ServerConfig";
import logo from "../../assets/logo.png";

// Keyframe animation for fade in effect
const fadeInUp = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translate3d(0, 30px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}
`;

const ModeratorLogin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate input
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      console.log("Attempting moderator login with:", { email });

      const response = await fetch(`${serverURL.url}moderator/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      console.log("API Response status:", response.status);

      const responseText = await response.text();
      console.log("API Response text:", responseText);

      // Parse the response
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("API Response parsed:", data);
      } catch (parseError) {
        console.error("Error parsing response as JSON:", parseError);
        throw new Error("Invalid response from server. Please try again.");
      }

      if (!data.success) {
        console.error("API reported failure:", data.message);
        throw new Error(data.message || "Login failed");
      }

      // Extract moderator data and token from response
      const moderatorData = data.moderator || data.data || data.user || {};
      const token = data.token;

      // Validate that we received necessary data
      if (!token) {
        throw new Error("No authentication token received");
      }

      // Store authentication data in localStorage
      localStorage.setItem("moderator-token", token);
      localStorage.setItem("moderator-data", JSON.stringify(moderatorData));
      console.log("Moderator data stored:", moderatorData);

      // Show success message
      toast.success(data.message || "Login successful!");

      // Navigate to scanner page
      setTimeout(() => {
        navigate("/moderator/scanner");
      }, 500);
    } catch (err) {
      console.error("Login error:", err);

      let errorMessage = err.message || "Login failed. Please try again.";

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{fadeInUp}</style>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-gray-900 via-orange-500 to-yellow-400 relative overflow-hidden px-4">
        <div className="absolute top-10 left-10 w-72 h-72 bg-orange-400 opacity-30 rounded-full blur-3xl animate-pulse -z-10"></div>
        <div className="absolute bottom-20 right-20 w-60 h-60 bg-yellow-300 opacity-20 rounded-full blur-2xl -z-10"></div>

        <div className="bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl p-8 w-full max-w-md mx-auto">
          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div className="bg-gradient-to-br from-orange-100 to-orange-300 text-white p-4 rounded-full shadow-lg mb-4">
              <img className="w-12 h-12" src={logo} alt="Logo" />
            </div>
            <h2 className="text-3xl font-bold text-white text-center drop-shadow-lg mb-2">
              Moderator Portal
            </h2>
            <p className="text-sm text-orange-50 text-center">
              Sign in to access the ticket scanner system
            </p>
          </div>

          {error && (
            <div className="bg-red-500/30 backdrop-blur-sm border border-red-400 text-white p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-5">
            <div className="form-control">
              <label
                className="block text-white font-medium mb-2"
                htmlFor="email"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="w-5 h-5 text-orange-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="moderator@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-10 w-full py-3 px-4 rounded-lg bg-white/90 border border-orange-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-300 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <div className="form-control">
              <label
                className="block text-white font-medium mb-2"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="w-5 h-5 text-orange-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-10 w-full py-3 px-4 rounded-lg bg-white/90 border border-orange-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-300 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="show-password"
                type="checkbox"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
              />
              <label
                htmlFor="show-password"
                className="ml-2 block text-sm text-white"
              >
                Show password
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium shadow-lg hover:shadow-orange-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Sign In as Moderator
                </>
              )}
            </button>

            <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-400/50 rounded-lg p-4 mt-4">
              <div className="flex items-start">
                <Shield
                  className="text-blue-300 mr-3 mt-0.5 flex-shrink-0"
                  size={20}
                />
                <p className="text-sm text-blue-50">
                  Use the credentials provided by the administrator to access
                  the ticket scanner.
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="absolute bottom-6 text-center w-full text-sm text-white/70">
          <p>© 2025 Ticket Scanner System</p>
          <p className="mt-1">Secure Moderator Access</p>
        </div>
      </div>
    </>
  );
};

export default ModeratorLogin;