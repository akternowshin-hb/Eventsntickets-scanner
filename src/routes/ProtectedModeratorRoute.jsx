import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedModeratorRoute = ({ children }) => {
  const moderatorToken = localStorage.getItem("moderator-token");
  const moderatorData = localStorage.getItem("moderator-data");

  if (!moderatorToken || !moderatorData) {
    // Redirect to login if not authenticated
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedModeratorRoute;