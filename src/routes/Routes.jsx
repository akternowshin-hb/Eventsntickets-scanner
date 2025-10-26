import { Navigate, createBrowserRouter } from "react-router-dom";
import Main from "../layouts/Main";
import ErrorPage from "../layouts/ErrorPage";
import Home from "../pages/Home/Home/Home";
import ModeratorLogin from "../pages/Login/ModeratorLogin";



export const router = createBrowserRouter([
  {
    path: "/",
    element: <ModeratorLogin />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/",
        element:<Home />, 
      },
    ],
  },
]);