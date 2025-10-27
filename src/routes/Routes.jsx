import { Navigate, createBrowserRouter } from "react-router-dom";
import Main from "../layouts/Main";
import ErrorPage from "../layouts/ErrorPage";
import Home from "../pages/Home/Home/Home";
import ModeratorLogin from "../pages/Login/ModeratorLogin";
import TicketScanner from "../pages/TicketScanner/TicketScanner";
import ProtectedModeratorRoute from "./ProtectedModeratorRoute";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <ModeratorLogin />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/moderator/scanner",
    element: (
      <ProtectedModeratorRoute>
        <TicketScanner />
      </ProtectedModeratorRoute>
    ),
    errorElement: <ErrorPage />,
  },
]);